-- Epic 4 / Story 4.1: group drink variants into collapsible rows.
--
-- Splits the free-text drinks.name into brand + drink_name (the grouping
-- key) + optional flavor. name -> drink_name is a straight rename (no data
-- loss, no backfill script needed); brand/flavor start null on existing rows
-- and stay null until a user fills them in via the edit modal — that's also
-- exactly what makes every pre-existing row render as an ungrouped single
-- item on day one (grouping requires a non-null brand).
--
-- brand is required by the app on add/edit, but deliberately NOT enforced
-- with a DB check constraint: Postgres re-validates check constraints on
-- every UPDATE of a row, not just when the constrained column changes, so a
-- `check (brand is not null)` would break quantity-only updates on every
-- legacy null-brand row the moment it's added.

alter table public.drinks rename column name to drink_name;
alter table public.drinks add column brand text;
alter table public.drinks add column flavor text;

-- =========================================================================
-- Batch move, replacing the single-id move_drink.
-- =========================================================================
-- A collapsed group's "move to subsection" / drag-and-drop must move all of
-- its variant rows atomically. move_drink has exactly one caller in the
-- codebase (src/lib/subsections.js), so it's replaced outright rather than
-- kept alongside a new batch RPC — one code path handles both a single item
-- (array of length 1) and a whole group.

create or replace function public.move_drinks(p_drink_ids uuid[], p_subsection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory_id uuid;
  v_target_inventory_id uuid;
  v_found_count int;
  v_distinct_inventories int;
begin
  if p_drink_ids is null or array_length(p_drink_ids, 1) is null then
    raise exception 'DRINK_NOT_FOUND';
  end if;

  -- uuid has no built-in min()/max() aggregate, so distinctness and an
  -- arbitrary representative id are fetched separately rather than via
  -- count(distinct ...), min(...) in one pass.
  select count(distinct inventory_id), count(*)
    into v_distinct_inventories, v_found_count
    from public.drinks where id = any(p_drink_ids);

  if v_found_count is distinct from array_length(p_drink_ids, 1) then
    raise exception 'DRINK_NOT_FOUND';
  end if;

  if v_distinct_inventories <> 1 then
    raise exception 'MIXED_INVENTORY';
  end if;

  select inventory_id into v_inventory_id
  from public.drinks where id = any(p_drink_ids) limit 1;

  if public.current_user_role(v_inventory_id) not in ('owner','editor','contributor') then
    raise exception 'INSUFFICIENT_ROLE';
  end if;

  select inventory_id into v_target_inventory_id
  from public.inventory_subsections where id = p_subsection_id;

  if v_target_inventory_id is distinct from v_inventory_id then
    raise exception 'SUBSECTION_NOT_IN_INVENTORY';
  end if;

  update public.drinks set subsection_id = p_subsection_id where id = any(p_drink_ids);
end;
$$;
revoke all on function public.move_drinks(uuid[], uuid) from public, anon;
grant execute on function public.move_drinks(uuid[], uuid) to authenticated;

drop function if exists public.move_drink(uuid, uuid);
