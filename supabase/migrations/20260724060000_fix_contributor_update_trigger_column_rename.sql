-- Bugfix: enforce_drink_update_permissions() still referenced drinks.name,
-- which was renamed to drink_name in 20260723193000_drink_variants_and_batch_move.sql.
-- The rename didn't propagate into this trigger function body (Postgres
-- doesn't rewrite plpgsql function text on a column rename), so any update
-- to a drinks row by a contributor — including a bare quantity increase,
-- which contributors are otherwise allowed to do — hit
-- `new.name is distinct from old.name` and failed at runtime with
-- "record 'new' has no field 'name'".

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
    if new.drink_name is distinct from old.drink_name
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
