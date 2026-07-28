import { supabase } from '../../../src/lib/supabase.js'

// There's no lib/drinks.js — src/components/Inventory.jsx calls
// supabase.from('drinks') directly (insert/update/delete), so these helpers
// mirror those exact calls to keep DB tests exercising the real app code
// path. Unlike lib/*.js's RPC wrappers, these never throw on failure — they
// return { data, error } like the raw supabase-js client does, matching how
// Inventory.jsx itself receives permission-denial results from the
// enforce_drink_update_permissions() trigger and drinks_* RLS policies.
export async function insertDrink(fields) {
  return supabase.from('drinks').insert(fields).select().single()
}

export async function updateDrink(id, fields) {
  return supabase.from('drinks').update(fields).eq('id', id).select()
}

export async function deleteDrink(id) {
  return supabase.from('drinks').delete().eq('id', id)
}
