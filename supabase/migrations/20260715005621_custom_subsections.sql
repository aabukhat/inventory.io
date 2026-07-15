-- Epic 2 / Story 2.2: custom subsections.
--
-- The table already supports this (preset_key nullable => custom when null),
-- per the Technical Notes' recommended data model from Story 2.1. This
-- migration adds: a length constraint on names, and a case-insensitive
-- uniqueness constraint on name so a custom subsection can't collide with
-- an existing preset or custom subsection's display name in the same
-- inventory (edge case: typing "Beer" as custom when the Beer preset
-- already exists) — enforced as a hard block, not just a client warning.

alter table public.inventory_subsections
  add constraint inventory_subsections_name_length
  check (char_length(btrim(name)) between 1 and 40);

create unique index inventory_subsections_unique_name
  on public.inventory_subsections (inventory_id, lower(name));

create or replace function public.add_subsection(p_inventory_id uuid, p_preset_key text, p_name text)
returns public.inventory_subsections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.inventory_subsections;
  v_next_position int;
  v_constraint text;
begin
  if public.current_user_role(p_inventory_id) not in ('owner','editor') then
    raise exception 'INSUFFICIENT_ROLE';
  end if;

  if char_length(btrim(p_name)) = 0 or char_length(btrim(p_name)) > 40 then
    raise exception 'SUBSECTION_NAME_INVALID';
  end if;

  select coalesce(max(position) + 1, 0) into v_next_position
  from public.inventory_subsections
  where inventory_id = p_inventory_id;

  insert into public.inventory_subsections (inventory_id, preset_key, name, position)
  values (p_inventory_id, p_preset_key, btrim(p_name), v_next_position)
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'inventory_subsections_unique_preset' then
      raise exception 'SUBSECTION_ALREADY_EXISTS';
    else
      raise exception 'SUBSECTION_NAME_TAKEN';
    end if;
end;
$$;
revoke all on function public.add_subsection(uuid, text, text) from public, anon;
grant execute on function public.add_subsection(uuid, text, text) to authenticated;
