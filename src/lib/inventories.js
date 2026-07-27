import { supabase } from './supabase'

export async function listMyInventories() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('inventories')
    .select('id, name, type, emoji, created_at, inventory_members!inner(role)')
    .eq('inventory_members.user_id', user.id)
  if (error) throw error

  return data.map(inv => ({
    id: inv.id,
    name: inv.name,
    type: inv.type,
    emoji: inv.emoji,
    created_at: inv.created_at,
    role: inv.inventory_members[0]?.role,
  }))
}

export async function createSharedInventory(name) {
  const { data, error } = await supabase.rpc('create_shared_inventory', { p_name: name })
  if (error) throw friendlyCreateError(error)
  return data
}

function friendlyCreateError(error) {
  const msg = error.message || ''
  if (msg.includes('INVENTORY_CAP_REACHED')) {
    return new Error("You've reached the limit of 10 inventories during beta.")
  }
  return error
}

export async function renameInventory(id, name) {
  const { error } = await supabase.from('inventories').update({ name }).eq('id', id)
  if (error) throw error
}

// emoji is stored as null (not '') when cleared, so Sidebar's `inv.emoji ||
// initials(inv.name)` fallback works whether it was never set or explicitly
// cleared back to blank.
export async function setInventoryEmoji(id, emoji) {
  const { error } = await supabase.from('inventories').update({ emoji: emoji || null }).eq('id', id)
  if (error) throw error
}

export async function deleteInventory(id) {
  const { error } = await supabase.from('inventories').delete().eq('id', id)
  if (error) throw error
}

function friendlyInviteError(error) {
  const msg = error.message || ''
  if (msg.includes('USER_NOT_FOUND')) {
    return new Error('No account found for that email — they need to sign up first.')
  }
  if (msg.includes('NOT_OWNER')) {
    return new Error('Only the inventory owner can invite members.')
  }
  return error
}

export async function inviteMember(inventoryId, email, role) {
  const { error } = await supabase.rpc('invite_member', {
    p_inventory_id: inventoryId,
    p_email: email,
    p_role: role,
  })
  if (error) throw friendlyInviteError(error)
}

export async function listMembers(inventoryId) {
  const { data: members, error } = await supabase
    .from('inventory_members')
    .select('user_id, role, created_at')
    .eq('inventory_id', inventoryId)
  if (error) throw error
  if (members.length === 0) return []

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url, favorite_color')
    .in('id', members.map(m => m.user_id))
  if (profilesError) throw profilesError

  // "Recently viewed" data (Epic 3 / Story 3.3) — best-effort: a missing
  // row just means that member has no last_viewed_at yet, not an error.
  const { data: views } = await supabase
    .from('inventory_views')
    .select('user_id, last_viewed_at')
    .eq('inventory_id', inventoryId)
  const lastViewedByUser = Object.fromEntries((views || []).map(v => [v.user_id, v.last_viewed_at]))

  const profileById = Object.fromEntries(profiles.map(p => [p.id, p]))
  return members
    .map(m => ({ ...m, profile: profileById[m.user_id], last_viewed_at: lastViewedByUser[m.user_id] || null }))
    .sort((a, b) => a.role.localeCompare(b.role))
}

// Epic 3 / Story 3.3: upserted by usePresence.js on mount and periodically
// while an inventory is open, so other viewers can show a "recently viewed"
// ring for someone who isn't currently present/focused.
export async function recordInventoryView(inventoryId, userId) {
  await supabase
    .from('inventory_views')
    .upsert({ inventory_id: inventoryId, user_id: userId, last_viewed_at: new Date().toISOString() }, { onConflict: 'user_id,inventory_id' })
}

export async function updateMemberRole(inventoryId, userId, role) {
  const { error } = await supabase
    .from('inventory_members')
    .update({ role })
    .eq('inventory_id', inventoryId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function removeMember(inventoryId, userId) {
  const { error } = await supabase
    .from('inventory_members')
    .delete()
    .eq('inventory_id', inventoryId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function leaveInventory(inventoryId) {
  const { data: { user } } = await supabase.auth.getUser()
  return removeMember(inventoryId, user.id)
}
