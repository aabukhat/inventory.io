-- Epic 3 / Story 3.1: replace ad-hoc, client-written "last change" text with
-- a server-computed, denormalized actor snapshot (display name + avatar),
-- plus a generic audit_log table covering drinks, subsections, members, and
-- pack sizes for future activity-feed work.
--
-- last_change was previously a free-text column set directly by the client
-- (Inventory.jsx interpolating displayName() into a string) — any client
-- could write an arbitrary string there, including impersonating another
-- member. Moving this to a trigger driven by auth.uid() closes that gap.
--
-- No per-event history exists prior to this migration (last_change is
-- overwritten on every change, and drinks has no updated_at), so the
-- backfill below can only synthesize one legacy audit_log entry per drink —
-- its current last_change string — not a full history.

-- =========================================================================
-- 1. audit_log table
-- =========================================================================

create table public.audit_log (
  id                 uuid primary key default gen_random_uuid(),
  inventory_id       uuid not null references public.inventories(id) on delete cascade,
  actor_user_id      uuid references auth.users(id) on delete set null,
  actor_display_name text not null,
  actor_avatar_url   text,
  action             text not null check (action in (
                        'drink_added','drink_qty_increased','drink_qty_decreased',
                        'drink_edited','drink_deleted','subsection_added','subsection_deleted',
                        'member_invited','member_role_changed','member_removed',
                        'pack_sizes_updated')),
  target_label       text,
  detail             jsonb,
  created_at         timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create index audit_log_inventory_id_idx on public.audit_log(inventory_id, created_at desc);

-- Select-only RLS — no insert/update/delete policy. Every row is written by
-- one of the SECURITY DEFINER triggers below, never by a direct client
-- write; same "select-only, privileged-write-path" shape as drink_frequency,
-- justified the same way: the actor identity is the entire point of this
-- table, so a client-writable insert path would defeat it.
create policy "audit_log_select_member" on public.audit_log for select
  using (public.current_user_role(inventory_id) is not null);

-- Not added to supabase_realtime: no live consumer yet (this pass only
-- enhances the existing inline last-change display on drinks, which rides
-- along on the drinks table's own realtime subscription). Add it here when
-- a future story adds a browsable activity view.

-- =========================================================================
-- 2. Denormalized last-change snapshot on drinks (replaces last_change text)
-- =========================================================================

alter table public.drinks
  add column last_change_actor_user_id      uuid references auth.users(id) on delete set null,
  add column last_change_actor_display_name text,
  add column last_change_actor_avatar_url   text,
  add column last_change_action             text check (last_change_action in ('added','qty_increased','qty_decreased','edited')),
  add column last_change_delta              int,
  add column last_change_at                 timestamptz;

-- =========================================================================
-- 3. Trigger: drinks
-- =========================================================================

create or replace function public.log_drink_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name   text;
  v_actor_avatar text;
  v_action       text;
  v_delta        int;
begin
  if auth.uid() is null then
    -- no authenticated end-user session (migration script, dashboard SQL
    -- editor, service-role/admin context) — nothing to attribute, skip.
    return coalesce(new, old);
  end if;

  select display_name, avatar_url into v_actor_name, v_actor_avatar
    from public.profiles where id = auth.uid();
  v_actor_name := coalesce(v_actor_name, 'Unknown user');

  if tg_op = 'INSERT' then
    new.last_change_actor_user_id := auth.uid();
    new.last_change_actor_display_name := v_actor_name;
    new.last_change_actor_avatar_url := v_actor_avatar;
    new.last_change_action := 'added';
    new.last_change_delta := null;
    new.last_change_at := now();

    insert into public.audit_log (inventory_id, actor_user_id, actor_display_name, actor_avatar_url, action, target_label)
      values (new.inventory_id, auth.uid(), v_actor_name, v_actor_avatar, 'drink_added', new.drink_name);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.brand is distinct from old.brand
       or new.drink_name is distinct from old.drink_name
       or new.flavor is distinct from old.flavor
       or new.type is distinct from old.type
       or new.unit is distinct from old.unit
       or new.unit_size is distinct from old.unit_size then
      v_action := 'edited';
      v_delta := null;
    elsif new.quantity is distinct from old.quantity then
      v_delta := new.quantity - old.quantity;
      v_action := case when v_delta > 0 then 'qty_increased' else 'qty_decreased' end;
    else
      -- no meaningful change (e.g. a subsection move via move_drinks, or a
      -- no-op update) — nothing to log.
      return new;
    end if;

    new.last_change_actor_user_id := auth.uid();
    new.last_change_actor_display_name := v_actor_name;
    new.last_change_actor_avatar_url := v_actor_avatar;
    new.last_change_action := v_action;
    new.last_change_delta := v_delta;
    new.last_change_at := now();

    insert into public.audit_log (inventory_id, actor_user_id, actor_display_name, actor_avatar_url, action, target_label, detail)
      values (
        new.inventory_id, auth.uid(), v_actor_name, v_actor_avatar,
        case v_action when 'edited' then 'drink_edited' when 'qty_increased' then 'drink_qty_increased' else 'drink_qty_decreased' end,
        new.drink_name,
        case when v_delta is not null then jsonb_build_object('delta', v_delta) else null end
      );
    return new;
  end if;

  -- DELETE
  insert into public.audit_log (inventory_id, actor_user_id, actor_display_name, actor_avatar_url, action, target_label)
    values (old.inventory_id, auth.uid(), v_actor_name, v_actor_avatar, 'drink_deleted', old.drink_name);
  return old;
end;
$$;

create trigger before_drink_change
  before insert or update or delete on public.drinks
  for each row execute function public.log_drink_change();

-- =========================================================================
-- 4. Trigger: inventory_subsections
-- =========================================================================

create or replace function public.log_subsection_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name   text;
  v_actor_avatar text;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if (tg_op = 'INSERT' and new.is_uncategorized) or (tg_op = 'DELETE' and old.is_uncategorized) then
    -- system bootstrap row (created by handle_new_user / create_shared_inventory
    -- / add_subsection's own uncategorized-ensure step), not a user action.
    return coalesce(new, old);
  end if;

  select display_name, avatar_url into v_actor_name, v_actor_avatar
    from public.profiles where id = auth.uid();
  v_actor_name := coalesce(v_actor_name, 'Unknown user');

  if tg_op = 'INSERT' then
    insert into public.audit_log (inventory_id, actor_user_id, actor_display_name, actor_avatar_url, action, target_label)
      values (new.inventory_id, auth.uid(), v_actor_name, v_actor_avatar, 'subsection_added', new.name);
    return new;
  end if;

  insert into public.audit_log (inventory_id, actor_user_id, actor_display_name, actor_avatar_url, action, target_label)
    values (old.inventory_id, auth.uid(), v_actor_name, v_actor_avatar, 'subsection_deleted', old.name);
  return old;
end;
$$;

create trigger after_subsection_change
  after insert or delete on public.inventory_subsections
  for each row execute function public.log_subsection_change();

-- =========================================================================
-- 5. Trigger: inventory_members
-- =========================================================================

create or replace function public.log_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name   text;
  v_actor_avatar text;
  v_target_user  uuid;
  v_target_label text;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  v_target_user := coalesce(new.user_id, old.user_id);
  select display_name into v_target_label from public.profiles where id = v_target_user;
  v_target_label := coalesce(v_target_label, 'Unknown user');

  select display_name, avatar_url into v_actor_name, v_actor_avatar
    from public.profiles where id = auth.uid();
  v_actor_name := coalesce(v_actor_name, 'Unknown user');

  if tg_op = 'INSERT' then
    if new.role = 'owner' then
      -- bootstrap membership (create_shared_inventory / handle_new_user),
      -- not an invite — invite_member never allows role='owner'.
      return new;
    end if;
    insert into public.audit_log (inventory_id, actor_user_id, actor_display_name, actor_avatar_url, action, target_label)
      values (new.inventory_id, auth.uid(), v_actor_name, v_actor_avatar, 'member_invited', v_target_label);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.role is distinct from new.role then
      insert into public.audit_log (inventory_id, actor_user_id, actor_display_name, actor_avatar_url, action, target_label, detail)
        values (new.inventory_id, auth.uid(), v_actor_name, v_actor_avatar, 'member_role_changed', v_target_label,
                jsonb_build_object('from', old.role, 'to', new.role));
    end if;
    return new;
  end if;

  -- DELETE: skip the owner's own row (protect_owner_membership already
  -- blocks this directly; only reachable here via the inventory-deletion
  -- cascade, which is filtered out by the exists() check below anyway), and
  -- skip entirely when the inventory itself no longer exists — same
  -- "still exists" guard protect_owner_membership uses for the same cascade.
  if old.role = 'owner' then
    return old;
  end if;
  if not exists (select 1 from public.inventories where id = old.inventory_id) then
    return old;
  end if;
  insert into public.audit_log (inventory_id, actor_user_id, actor_display_name, actor_avatar_url, action, target_label)
    values (old.inventory_id, auth.uid(), v_actor_name, v_actor_avatar, 'member_removed', v_target_label);
  return old;
end;
$$;

create trigger after_member_change
  after insert or update or delete on public.inventory_members
  for each row execute function public.log_member_change();

-- =========================================================================
-- 6. Trigger: pack_size_presets
-- =========================================================================

create or replace function public.log_pack_size_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name   text;
  v_actor_avatar text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select display_name, avatar_url into v_actor_name, v_actor_avatar
    from public.profiles where id = auth.uid();
  v_actor_name := coalesce(v_actor_name, 'Unknown user');

  insert into public.audit_log (inventory_id, actor_user_id, actor_display_name, actor_avatar_url, action, target_label, detail)
    values (new.inventory_id, auth.uid(), v_actor_name, v_actor_avatar, 'pack_sizes_updated', new.type,
            jsonb_build_object('sizes', new.sizes));
  return new;
end;
$$;

create trigger after_pack_size_change
  after insert or update on public.pack_size_presets
  for each row execute function public.log_pack_size_change();

-- =========================================================================
-- 7. Backfill: one legacy audit_log entry per drink from its current
--    last_change text, matched to a registered user by display-name prefix
--    within the drink's own inventory. Ambiguous (0 or >1 match) rows fall
--    back to a "Legacy activity" placeholder rather than guessing.
-- =========================================================================

do $$
declare
  d              record;
  v_match_count  int;
  v_actor_id     uuid;
  v_actor_name   text;
  v_actor_avatar text;
  v_rest         text;
  v_action       text;
  v_delta        int;
  v_at           timestamptz;
  v_date_part    text;
begin
  for d in select id, inventory_id, drink_name, last_change, created_at from public.drinks where last_change is not null loop

    select count(*) into v_match_count
      from public.inventory_members im
      join public.profiles p on p.id = im.user_id
      where im.inventory_id = d.inventory_id
        and length(trim(coalesce(p.display_name, ''))) > 0
        and left(d.last_change, length(p.display_name)) = p.display_name;

    if v_match_count = 1 then
      select p.id, p.display_name, p.avatar_url into v_actor_id, v_actor_name, v_actor_avatar
        from public.inventory_members im
        join public.profiles p on p.id = im.user_id
        where im.inventory_id = d.inventory_id
          and length(trim(coalesce(p.display_name, ''))) > 0
          and left(d.last_change, length(p.display_name)) = p.display_name;
      v_rest := trim(substring(d.last_change from length(v_actor_name) + 1));
    else
      v_actor_id := null;
      v_actor_name := 'Legacy activity';
      v_actor_avatar := null;
      v_rest := d.last_change;
    end if;

    if v_rest like '+%' or v_rest like '-%' then
      v_delta := (regexp_match(v_rest, '^([+-]\d+)'))[1]::int;
      v_action := case when v_delta > 0 then 'qty_increased' else 'qty_decreased' end;
    elsif v_rest ilike '%edited%' then
      v_action := 'edited';
      v_delta := null;
    else
      v_action := 'added';
      v_delta := null;
    end if;

    -- Best-effort timestamp: parse "Mon DD, H:MM AM/PM" after the '·',
    -- appending the current year (same lossy assumption the client-side
    -- parseLastChange helper made), falling back to created_at on failure.
    v_date_part := trim(split_part(d.last_change, '·', 2));
    v_at := null;
    begin
      v_at := to_timestamp(v_date_part || ', ' || extract(year from now())::text, 'Mon DD, HH12:MI AM, YYYY');
    exception when others then
      v_at := null;
    end;
    if v_at is null then
      v_at := d.created_at;
    end if;

    insert into public.audit_log (inventory_id, actor_user_id, actor_display_name, actor_avatar_url, action, target_label, detail, created_at)
      values (
        d.inventory_id, v_actor_id, v_actor_name, v_actor_avatar,
        case v_action when 'added' then 'drink_added' when 'edited' then 'drink_edited'
             when 'qty_increased' then 'drink_qty_increased' else 'drink_qty_decreased' end,
        d.drink_name,
        case when v_delta is not null then jsonb_build_object('delta', v_delta) else null end,
        v_at
      );

    update public.drinks set
      last_change_actor_user_id = v_actor_id,
      last_change_actor_display_name = v_actor_name,
      last_change_actor_avatar_url = v_actor_avatar,
      last_change_action = v_action,
      last_change_delta = v_delta,
      last_change_at = v_at
      where id = d.id;
  end loop;
end $$;

alter table public.drinks drop column last_change;
