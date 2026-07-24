-- Bugfix: deleting a shared inventory always failed with CANNOT_REMOVE_OWNER.
--
-- protect_owner_membership() unconditionally blocked deleting any
-- inventory_members row with role='owner'. But deleting an inventory
-- cascades (on delete cascade) to delete its own inventory_members rows,
-- including the owner's — so the trigger was blocking its own cascade.
-- Only block owner-membership deletion when the inventory still exists
-- (i.e. someone is trying to remove the owner directly, not delete the
-- whole inventory).

create or replace function public.protect_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.role = 'owner' then
    if exists (select 1 from public.inventories where id = old.inventory_id) then
      raise exception 'CANNOT_REMOVE_OWNER';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner' then
    raise exception 'CANNOT_DEMOTE_OWNER';
  end if;
  return coalesce(new, old);
end;
$$;
