-- Epic 3 / Story 3.2: personalized frequent-drink quick-picks.
--
-- Personalized per user, scoped per inventory (not aggregated across an
-- inventory's contributors, not global across a user's inventories) — the
-- latter matches how every other per-context feature already works here
-- (pack_size_presets, inventory_subsections are both keyed by inventory_id
-- alone; each inventory is a fully walled context). Known trade-off: a
-- user with rich history in one inventory sees zero quick-picks the first
-- time they add to a different inventory. That's the model working as
-- designed, not a bug.
--
-- Table + RPC, not the direct-client-upsert pattern used for drinks/
-- pack_size_presets: this write needs an atomic `count = count + 1`
-- referencing the row's own prior state, which PostgREST's upsert cannot
-- express (it can only set conflict-path columns to client-supplied
-- literals), and needs the conflict target to be a case-insensitive
-- identity key, which requires either an expression index (inconsistent
-- with every other unique index in this codebase, which target plain
-- columns) or generated stored columns (used here) — supabase-js's
-- `onConflict` must name real columns of a real unique constraint/index
-- either way. So this is a narrow, justified exception to "simple CRUD
-- goes through direct client calls."

create table public.drink_frequency (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  inventory_id  uuid not null references public.inventories(id) on delete cascade,
  brand         text not null,
  drink_name    text not null,
  flavor        text,
  type          text not null,
  unit          text,
  unit_size     text,
  count         int not null default 1,
  last_added_at timestamptz not null default now(),
  norm_brand      text generated always as (lower(trim(brand))) stored,
  norm_drink_name text generated always as (lower(trim(drink_name))) stored,
  norm_flavor     text generated always as (lower(trim(coalesce(flavor, '')))) stored
);
alter table public.drink_frequency enable row level security;

create unique index drink_frequency_unique_key on public.drink_frequency
  (user_id, inventory_id, norm_brand, norm_drink_name, norm_flavor);
create index drink_frequency_lookup_idx on public.drink_frequency(user_id, inventory_id);

-- Select-only RLS policy — no insert/update policies. With RLS enabled and
-- none declared, direct client writes are default-denied; only the RPC
-- below (SECURITY DEFINER, bypasses RLS, does its own role check) can
-- write.
create policy "drink_frequency_select_own" on public.drink_frequency for select
  using (user_id = auth.uid());

create or replace function public.record_drink_frequency(
  p_inventory_id uuid, p_brand text, p_drink_name text, p_flavor text,
  p_type text, p_unit text, p_unit_size text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role(p_inventory_id) not in ('owner','editor','contributor') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  insert into public.drink_frequency
    (user_id, inventory_id, brand, drink_name, flavor, type, unit, unit_size, count, last_added_at)
  values
    (auth.uid(), p_inventory_id, p_brand, p_drink_name, p_flavor, p_type, p_unit, p_unit_size, 1, now())
  on conflict (user_id, inventory_id, norm_brand, norm_drink_name, norm_flavor)
  do update set
    count = drink_frequency.count + 1,
    last_added_at = now(),
    type = excluded.type, unit = excluded.unit, unit_size = excluded.unit_size;
end;
$$;
revoke all on function public.record_drink_frequency(uuid,text,text,text,text,text,text) from public, anon;
grant execute on function public.record_drink_frequency(uuid,text,text,text,text,text,text) to authenticated;
