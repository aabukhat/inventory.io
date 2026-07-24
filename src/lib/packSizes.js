import { supabase } from './supabase'

export const DEFAULT_PACK_SIZES = {
  beer: [6, 12, 24],
  seltzer: [6, 12, 24],
  cider: [6, 12, 24],
  liquor: [],
  other: [],
}

// packSizes is a { type: number[] } map of only explicitly-configured
// types — a stored empty array ("no buttons for this type") must be
// distinguished from no row at all ("use the default"), so this falls
// through on null/undefined only, never on an empty (but present) array.
export function resolvePackSizes(packSizes, type) {
  const sizes = packSizes?.[type] ?? DEFAULT_PACK_SIZES[type] ?? []
  return [...sizes].sort((a, b) => a - b)
}

export async function listPackSizes(inventoryId) {
  const { data, error } = await supabase
    .from('pack_size_presets')
    .select('type, sizes')
    .eq('inventory_id', inventoryId)
  if (error) throw error
  return data
}

export async function savePackSizes(inventoryId, type, sizes) {
  const cleaned = [...new Set(sizes.filter(n => Number.isInteger(n) && n > 0))].sort((a, b) => a - b)
  const { error } = await supabase
    .from('pack_size_presets')
    .upsert({ inventory_id: inventoryId, type, sizes: cleaned }, { onConflict: 'inventory_id,type' })
  if (error) throw error
}

// Distinct from savePackSizes(id, type, []) — deleting the row falls back
// to whatever DEFAULT_PACK_SIZES says at read-time, whereas saving an
// empty array permanently shadows any future change to the default.
export async function resetPackSizes(inventoryId, type) {
  const { error } = await supabase
    .from('pack_size_presets')
    .delete()
    .eq('inventory_id', inventoryId)
    .eq('type', type)
  if (error) throw error
}
