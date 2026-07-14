-- Beta guardrail: cap the number of inventories a single user can own.
-- Counts personal + shared inventories owned by the caller; personal is
-- always exactly one, so in practice this caps shared inventory creation.

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
  return v_id;
end;
$$;
revoke all on function public.create_shared_inventory(text) from public, anon;
grant execute on function public.create_shared_inventory(text) to authenticated;
