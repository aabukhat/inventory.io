-- Epic 3 / Story 3.1: configurable pack-size quick-add.
--
-- A separate table, not a JSONB column on inventories: the inventories
-- table has a before-update trigger (enforce_inventory_update(), in
-- 20260714042613_multi_inventory_sharing.sql) that rejects any update from
-- a non-owner, but editors must be able to configure pack sizes.
--
-- Keyed by drink type (beer/seltzer/cider/liquor/other), not subsection —
-- subsections aren't chosen at add-time (new items always land in
-- Uncategorized first), so type is the only category signal actually
-- available when a user is adding an item.
--
-- No cross-row invariant here (unlike inventory_subsections' position
-- ordering), so writes go through direct client upserts gated by RLS
-- rather than a SECURITY DEFINER RPC.

create table public.pack_size_presets (
  id           uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventories(id) on delete cascade,
  type         text not null check (type in ('beer','seltzer','cider','liquor','other')),
  sizes        int[] not null default '{}',
  created_at   timestamptz not null default now()
);
alter table public.pack_size_presets enable row level security;

create unique index pack_size_presets_unique_inventory_type
  on public.pack_size_presets (inventory_id, type);
create index pack_size_presets_inventory_id_idx on public.pack_size_presets(inventory_id);

-- select/insert/update/delete for editor+ (upsert needs both insert and
-- update policies: the ON CONFLICT DO UPDATE path evaluates the insert
-- policy's with-check for the attempted insert, then the update policy's
-- using/with-check for the conflict-resolution update).
create policy "pack_size_presets_select_member" on public.pack_size_presets for select
  using (public.current_user_role(inventory_id) is not null);
create policy "pack_size_presets_insert_editor_plus" on public.pack_size_presets for insert
  with check (public.current_user_role(inventory_id) in ('owner','editor'));
create policy "pack_size_presets_update_editor_plus" on public.pack_size_presets for update
  using (public.current_user_role(inventory_id) in ('owner','editor'))
  with check (public.current_user_role(inventory_id) in ('owner','editor'));
create policy "pack_size_presets_delete_editor_plus" on public.pack_size_presets for delete
  using (public.current_user_role(inventory_id) in ('owner','editor'));

alter publication supabase_realtime add table public.pack_size_presets;
