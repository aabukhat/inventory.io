-- Epic 2 / Story 2.3: move drinks between subsections.
--
-- "Uncategorized" is a real, persistent subsection per inventory (not a
-- computed view of subsection_id IS NULL), per the Technical Notes'
-- recommendation for simplicity. Every inventory gets exactly one, created
-- alongside the inventory itself and never deletable. drinks.subsection_id
-- is NOT NULL and always points to a real row, so "zero subsections" from
-- the user's point of view (Uncategorized being the only one) is purely a
-- frontend rendering choice (render flat, as before) rather than a
-- different data shape.
--
-- Deleting a non-uncategorized subsection auto-reassigns its items to
-- Uncategorized (no destination prompt) so items are never silently
-- deleted as a side effect.

alter table public.inventory_subsections
  add column is_uncategorized boolean not null default false;

create unique index inventory_subsections_one_uncategorized_per_inventory
  on public.inventory_subsections (inventory_id) where (is_uncategorized);

alter table public.drinks
  add column subsection_id uuid references public.inventory_subsections(id);

-- backfill: one Uncategorized subsection per existing inventory, positioned
-- ahead of anything a user has already added (min - 1), and point all
-- existing drinks at their inventory's Uncategorized subsection.
do $$
declare
  v_inv record;
  v_uncat_id uuid;
begin
  for v_inv in select id from public.inventories loop
    insert into public.inventory_subsections (inventory_id, preset_key, name, position, is_uncategorized)
    select v_inv.id, null, 'Uncategorized',
           coalesce((select min(position) - 1 from public.inventory_subsections where inventory_id = v_inv.id), 0),
           true
    where not exists (
      select 1 from public.inventory_subsections where inventory_id = v_inv.id and is_uncategorized
    )
    returning id into v_uncat_id;

    if v_uncat_id is null then
      select id into v_uncat_id from public.inventory_subsections
      where inventory_id = v_inv.id and is_uncategorized;
    end if;

    update public.drinks set subsection_id = v_uncat_id
    where inventory_id = v_inv.id and subsection_id is null;
  end loop;
end $$;

alter table public.drinks alter column subsection_id set not null;
create index drinks_subsection_id_idx on public.drinks(subsection_id);

-- =========================================================================
-- Auto-create Uncategorized alongside every new inventory
-- =========================================================================

create or replace function public.create_shared_inventory(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_owned_count int;
  v_cap constant int := 10;
begin
  select count(*) into v_owned_count
  from public.inventories
  where owner_id = auth.uid();

  if v_owned_count >= v_cap then
    raise exception 'INVENTORY_CAP_REACHED';
  end if;

  insert into public.inventories (name, type, owner_id)
    values (p_name, 'shared', auth.uid())
    returning id into v_id;
  insert into public.inventory_members (inventory_id, user_id, role, invited_by)
    values (v_id, auth.uid(), 'owner', auth.uid());
  insert into public.inventory_subsections (inventory_id, preset_key, name, position, is_uncategorized)
    values (v_id, null, 'Uncategorized', 0, true);
  return v_id;
end;
$$;
revoke all on function public.create_shared_inventory(text) from public, anon;
grant execute on function public.create_shared_inventory(text) to authenticated;

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

  insert into public.inventory_subsections (inventory_id, preset_key, name, position, is_uncategorized)
    values (v_inv_id, null, 'Uncategorized', 0, true);

  return new;
end;
$$;

-- =========================================================================
-- RPCs
-- =========================================================================

create or replace function public.move_drink(p_drink_id uuid, p_subsection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory_id uuid;
  v_target_inventory_id uuid;
begin
  select inventory_id into v_inventory_id from public.drinks where id = p_drink_id;
  if v_inventory_id is null then
    raise exception 'DRINK_NOT_FOUND';
  end if;

  if public.current_user_role(v_inventory_id) not in ('owner','editor','contributor') then
    raise exception 'INSUFFICIENT_ROLE';
  end if;

  select inventory_id into v_target_inventory_id
  from public.inventory_subsections where id = p_subsection_id;

  if v_target_inventory_id is distinct from v_inventory_id then
    raise exception 'SUBSECTION_NOT_IN_INVENTORY';
  end if;

  update public.drinks set subsection_id = p_subsection_id where id = p_drink_id;
end;
$$;
revoke all on function public.move_drink(uuid, uuid) from public, anon;
grant execute on function public.move_drink(uuid, uuid) to authenticated;

create or replace function public.delete_subsection(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory_id uuid;
  v_is_uncategorized boolean;
  v_uncategorized_id uuid;
begin
  select inventory_id, is_uncategorized into v_inventory_id, v_is_uncategorized
  from public.inventory_subsections where id = p_id;

  if v_inventory_id is null then
    raise exception 'SUBSECTION_NOT_FOUND';
  end if;

  if public.current_user_role(v_inventory_id) not in ('owner','editor') then
    raise exception 'INSUFFICIENT_ROLE';
  end if;

  if v_is_uncategorized then
    raise exception 'CANNOT_DELETE_UNCATEGORIZED';
  end if;

  select id into v_uncategorized_id
  from public.inventory_subsections
  where inventory_id = v_inventory_id and is_uncategorized;

  update public.drinks set subsection_id = v_uncategorized_id where subsection_id = p_id;

  delete from public.inventory_subsections where id = p_id;
end;
$$;
revoke all on function public.delete_subsection(uuid) from public, anon;
grant execute on function public.delete_subsection(uuid) to authenticated;
