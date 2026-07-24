// UI-only gating — mirrors the rules enforced server-side by the
// enforce_drink_update_permissions() trigger and drinks_* RLS policies
// in supabase/migrations/20260714042613_multi_inventory_sharing.sql, and
// the add_subsection/reorder_subsections RPCs in
// supabase/migrations/20260715004840_inventory_subsections.sql, and the
// pack_size_presets_* RLS policies in
// supabase/migrations/20260723200000_pack_size_presets.sql.
// Keep both in sync; this file only hides/disables controls, it is not
// itself a security boundary.

export function canAddItems(role) {
  return role === 'owner' || role === 'editor' || role === 'contributor'
}

export function canIncreaseQty(role) {
  return role === 'owner' || role === 'editor' || role === 'contributor'
}

export function canDecreaseQty(role) {
  return role === 'owner' || role === 'editor'
}

export function canEditDetails(role) {
  return role === 'owner' || role === 'editor'
}

export function canDeleteItems(role) {
  return role === 'owner' || role === 'editor'
}

export function canManageMembers(role) {
  return role === 'owner'
}

export function canManageSubsections(role) {
  return role === 'owner' || role === 'editor'
}

export function canManagePackSizes(role) {
  return role === 'owner' || role === 'editor'
}
