-- Epic 2 / Story 2.1: preset inventory subsections.
--
-- Subsections are per-inventory organizational containers (e.g. "Beer",
-- "Liquor") that start empty; assigning existing items into them is out of
-- scope for this story. The preset catalog itself (key -> label) lives in
-- frontend config (src/lib/subsectionPresets.js), not a DB table, since it's
-- short and controlled by the product team. This table only stores which
-- presets a given inventory has added, and in what order.
--
-- Ordering is explicit via a `position` column (assigned on insert, updated
-- on reorder) rather than relying on insertion/created_at order, so the
-- display order survives reordering and is never accidental.

create table public.inventory_subsections (
  id           uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventories(id) on delete cascade,
  preset_key   text,
  name         text not null,
  position     int not null,
  created_at   timestamptz not null default now()
);
alter table public.inventory_subsections enable row level security;

-- prevent adding the same preset twice to the same inventory (custom,
-- non-preset subsections aren't scoped by this story but the schema
-- allows preset_key to be null for them without colliding here)
create unique index inventory_subsections_unique_preset
  on public.inventory_subsections (inventory_id, preset_key) where (preset_key is not null);

create index inventory_subsections_inventory_id_idx on public.inventory_subsections(inventory_id);

-- =========================================================================
-- RPCs
-- =========================================================================

create or replace function public.add_subsection(p_inventory_id uuid, p_preset_key text, p_name text)
returns public.inventory_subsections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.inventory_subsections;
  v_next_position int;
begin
  if public.current_user_role(p_inventory_id) not in ('owner','editor') then
    raise exception 'INSUFFICIENT_ROLE';
  end if;

  select coalesce(max(position) + 1, 0) into v_next_position
  from public.inventory_subsections
  where inventory_id = p_inventory_id;

  insert into public.inventory_subsections (inventory_id, preset_key, name, position)
  values (p_inventory_id, p_preset_key, p_name, v_next_position)
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'SUBSECTION_ALREADY_EXISTS';
end;
$$;
revoke all on function public.add_subsection(uuid, text, text) from public, anon;
grant execute on function public.add_subsection(uuid, text, text) to authenticated;

create or replace function public.reorder_subsections(p_inventory_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if public.current_user_role(p_inventory_id) not in ('owner','editor') then
    raise exception 'INSUFFICIENT_ROLE';
  end if;

  select count(*) into v_count
  from public.inventory_subsections
  where inventory_id = p_inventory_id;

  if v_count is distinct from array_length(p_ids, 1) then
    raise exception 'ID_LIST_MISMATCH';
  end if;

  update public.inventory_subsections s
  set position = t.ord - 1
  from unnest(p_ids) with ordinality as t(id, ord)
  where s.id = t.id and s.inventory_id = p_inventory_id;
end;
$$;
revoke all on function public.reorder_subsections(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_subsections(uuid, uuid[]) to authenticated;

-- =========================================================================
-- RLS policies (writes only via the SECURITY DEFINER RPCs above)
-- =========================================================================

create policy "subsections_select_member" on public.inventory_subsections for select
  using (public.current_user_role(inventory_id) is not null);

create policy "subsections_delete_editor_plus" on public.inventory_subsections for delete
  using (public.current_user_role(inventory_id) in ('owner','editor'));

-- =========================================================================
-- Realtime
-- =========================================================================

alter publication supabase_realtime add table public.inventory_subsections;
