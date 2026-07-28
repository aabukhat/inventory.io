-- Epic 3 / Story 3.3: "recently viewed" tier backing the collaborator
-- presence ring. Live presence itself (who's here right now, focused) is
-- ephemeral and lives entirely in a Supabase Realtime Presence channel
-- (src/hooks/usePresence.js) — it vanishes on disconnect, so it can't
-- answer "was this person here 10 minutes ago." This table is that
-- durable, low-resolution complement: one row per (user, inventory),
-- upserted with the current timestamp whenever a client has the inventory
-- open, checked client-side against a 15-minute window.
--
-- Plain-RLS baseline, not an RPC — "upsert my own row" has no cross-row
-- invariant to enforce, same shape as pack_size_presets.

create table public.inventory_views (
  user_id        uuid not null references auth.users(id) on delete cascade,
  inventory_id   uuid not null references public.inventories(id) on delete cascade,
  last_viewed_at timestamptz not null default now(),
  primary key (user_id, inventory_id)
);
alter table public.inventory_views enable row level security;

create policy "inventory_views_select_member" on public.inventory_views for select
  using (public.current_user_role(inventory_id) is not null);
create policy "inventory_views_upsert_own" on public.inventory_views for insert
  with check (user_id = auth.uid());
create policy "inventory_views_update_own" on public.inventory_views for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Not added to supabase_realtime: a 15-minute-resolution signal doesn't
-- need sub-second pushes — src/hooks/useMembers.js polls on an interval
-- instead, the same deliberate omission drink_frequency documents for its
-- own realtime-exemption reasons.
