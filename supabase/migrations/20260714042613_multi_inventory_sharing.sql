-- Multi-inventory sharing: personal + shared inventories with tiered permissions.
-- See /Users/aabukhat/.claude/plans/cozy-dancing-sundae.md for full design rationale.

-- =========================================================================
-- 1. Tables
-- =========================================================================

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table public.inventories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text not null default 'shared' check (type in ('personal','shared')),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.inventories enable row level security;

-- exactly one personal inventory per user
create unique index inventories_one_personal_per_owner
  on public.inventories (owner_id) where (type = 'personal');

create table public.inventory_members (
  inventory_id uuid not null references public.inventories(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('owner','editor','contributor','viewer')),
  invited_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  primary key (inventory_id, user_id)
);
alter table public.inventory_members enable row level security;
create index inventory_members_user_id_idx on public.inventory_members(user_id);

alter table public.drinks add column inventory_id uuid references public.inventories(id) on delete cascade;
create index drinks_inventory_id_idx on public.drinks(inventory_id);

-- =========================================================================
-- 2. Helper function (source of truth for permission checks)
-- =========================================================================

create or replace function public.current_user_role(p_inventory_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.inventory_members
  where inventory_id = p_inventory_id and user_id = auth.uid()
$$;

-- =========================================================================
-- 3. RPCs (all inventories/inventory_members writes go through these)
-- =========================================================================

create or replace function public.create_shared_inventory(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.inventories (name, type, owner_id)
    values (p_name, 'shared', auth.uid())
    returning id into v_id;
  insert into public.inventory_members (inventory_id, user_id, role, invited_by)
    values (v_id, auth.uid(), 'owner', auth.uid());
  return v_id;
end;
$$;
revoke all on function public.create_shared_inventory(text) from public, anon;
grant execute on function public.create_shared_inventory(text) to authenticated;

create or replace function public.invite_member(p_inventory_id uuid, p_email text, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_user_id uuid;
begin
  if public.current_user_role(p_inventory_id) <> 'owner' then
    raise exception 'NOT_OWNER';
  end if;
  if p_role not in ('editor','contributor','viewer') then
    raise exception 'INVALID_ROLE';
  end if;

  select id into v_user_id from public.profiles where lower(email) = lower(p_email);
  if v_user_id is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  insert into public.inventory_members (inventory_id, user_id, role, invited_by)
    values (p_inventory_id, v_user_id, p_role, auth.uid())
  on conflict (inventory_id, user_id) do update set role = excluded.role;
end;
$$;
revoke all on function public.invite_member(uuid, text, text) from public, anon;
grant execute on function public.invite_member(uuid, text, text) to authenticated;

-- =========================================================================
-- 4. New-user bootstrap: profile + personal inventory + owner membership
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_inv_id uuid;
begin
  insert into public.profiles (id, email, display_name)
    values (new.id, new.email, split_part(new.email, '@', 1));

  insert into public.inventories (name, type, owner_id)
    values ('My Inventory', 'personal', new.id)
    returning id into v_inv_id;

  insert into public.inventory_members (inventory_id, user_id, role, invited_by)
    values (v_inv_id, new.id, 'owner', new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- 5. Fine-grained enforcement triggers
--    (RLS can't compare OLD vs NEW within one UPDATE check; triggers can)
-- =========================================================================

create or replace function public.enforce_drink_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_role text;
begin
  if old.inventory_id is not null and new.inventory_id is distinct from old.inventory_id then
    raise exception 'MOVE_NOT_SUPPORTED';
  end if;

  if auth.uid() is null then
    -- no authenticated end-user session (migration script, dashboard SQL
    -- editor, service-role/admin context) — not subject to tier restrictions.
    return new;
  end if;

  v_role := public.current_user_role(old.inventory_id);

  if v_role in ('owner','editor') then
    return new;
  end if;

  if v_role = 'contributor' then
    if new.quantity < old.quantity then
      raise exception 'CONTRIBUTOR_CANNOT_DECREASE';
    end if;
    if new.name is distinct from old.name
       or new.type is distinct from old.type
       or new.unit is distinct from old.unit
       or new.unit_size is distinct from old.unit_size then
      raise exception 'CONTRIBUTOR_CANNOT_EDIT_DETAILS';
    end if;
    return new;
  end if;

  raise exception 'INSUFFICIENT_ROLE';
end;
$$;

create trigger before_drink_update
  before update on public.drinks
  for each row execute function public.enforce_drink_update_permissions();

create or replace function public.enforce_inventory_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role(old.id) <> 'owner' then
    raise exception 'NOT_OWNER';
  end if;
  if new.type is distinct from old.type or new.owner_id is distinct from old.owner_id then
    raise exception 'FIELD_IMMUTABLE';
  end if;
  return new;
end;
$$;
create trigger before_inventory_update
  before update on public.inventories
  for each row execute function public.enforce_inventory_update();

create or replace function public.prevent_personal_inventory_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.type = 'personal' then
    raise exception 'PERSONAL_INVENTORY_NOT_DELETABLE';
  end if;
  return old;
end;
$$;
create trigger before_inventory_delete
  before delete on public.inventories
  for each row execute function public.prevent_personal_inventory_delete();

create or replace function public.protect_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.role = 'owner' then
    raise exception 'CANNOT_REMOVE_OWNER';
  end if;
  if tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner' then
    raise exception 'CANNOT_DEMOTE_OWNER';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger before_membership_change
  before update or delete on public.inventory_members
  for each row execute function public.protect_owner_membership();

-- =========================================================================
-- 6. Backfill existing data
-- =========================================================================

-- 6a. profiles for existing users
insert into public.profiles (id, email, display_name)
select id, email, split_part(email, '@', 1)
from auth.users
on conflict (id) do nothing;

-- 6b. personal inventory + owner membership for existing users
insert into public.inventories (name, type, owner_id)
select 'My Inventory', 'personal', u.id
from auth.users u
where not exists (
  select 1 from public.inventories i where i.owner_id = u.id and i.type = 'personal'
);

insert into public.inventory_members (inventory_id, user_id, role, invited_by)
select i.id, i.owner_id, 'owner', i.owner_id
from public.inventories i
where i.type = 'personal'
  and not exists (
    select 1 from public.inventory_members m
    where m.inventory_id = i.id and m.user_id = i.owner_id
  );

-- 6c. legacy shared inventory holding all pre-existing drinks rows,
--     owned by aabukhat@gmail.com, every other existing user as editor
do $$
declare
  v_owner_id uuid;
  v_legacy_id uuid;
  v_user_count int;
begin
  select count(*) into v_user_count from auth.users;

  if v_user_count = 0 then
    -- fresh/local database with no existing users: nothing to backfill.
    raise notice 'No existing users found; skipping legacy shared inventory backfill.';
    return;
  end if;

  select id into v_owner_id from auth.users where email = 'aabukhat@gmail.com';

  if v_owner_id is null then
    raise exception 'Legacy inventory owner account (aabukhat@gmail.com) not found';
  end if;

  insert into public.inventories (name, type, owner_id)
  values ('Household (legacy shared)', 'shared', v_owner_id)
  returning id into v_legacy_id;

  insert into public.inventory_members (inventory_id, user_id, role, invited_by)
  select v_legacy_id, u.id,
         case when u.id = v_owner_id then 'owner' else 'editor' end,
         v_owner_id
  from auth.users u;

  update public.drinks set inventory_id = v_legacy_id where inventory_id is null;
end $$;

alter table public.drinks alter column inventory_id set not null;

-- =========================================================================
-- 7. RLS policies
-- =========================================================================

create policy "profiles_select_self_or_comember" on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.inventory_members m1
      join public.inventory_members m2 on m1.inventory_id = m2.inventory_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );

create policy "inventories_select_member" on public.inventories for select
  using (public.current_user_role(id) is not null);
create policy "inventories_update_owner" on public.inventories for update
  using (public.current_user_role(id) = 'owner');
create policy "inventories_delete_owner" on public.inventories for delete
  using (public.current_user_role(id) = 'owner');

create policy "members_select_member" on public.inventory_members for select
  using (public.current_user_role(inventory_id) is not null);
create policy "members_update_owner" on public.inventory_members for update
  using (public.current_user_role(inventory_id) = 'owner');
create policy "members_delete_owner_or_self" on public.inventory_members for delete
  using (public.current_user_role(inventory_id) = 'owner' or user_id = auth.uid());

drop policy if exists "auth read" on public.drinks;
drop policy if exists "auth insert" on public.drinks;
drop policy if exists "auth update" on public.drinks;
drop policy if exists "auth delete" on public.drinks;

create policy "drinks_select_member" on public.drinks for select
  using (public.current_user_role(inventory_id) is not null);

create policy "drinks_insert_contributor_plus" on public.drinks for insert
  with check (public.current_user_role(inventory_id) in ('owner','editor','contributor'));

create policy "drinks_update_contributor_plus" on public.drinks for update
  using (public.current_user_role(inventory_id) in ('owner','editor','contributor'))
  with check (public.current_user_role(inventory_id) in ('owner','editor','contributor'));

create policy "drinks_delete_editor_plus" on public.drinks for delete
  using (public.current_user_role(inventory_id) in ('owner','editor'));

-- =========================================================================
-- 8. Realtime
-- =========================================================================

alter publication supabase_realtime add table public.inventories;
alter publication supabase_realtime add table public.inventory_members;
