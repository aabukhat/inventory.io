import { supabase } from './supabase'

// Non-critical personalization side effect — never throws, since a failure
// here must not block a successful item add.
export async function recordDrinkAdd(inventoryId, { brand, drink_name, flavor, type, unit, unit_size }) {
  const { error } = await supabase.rpc('record_drink_frequency', {
    p_inventory_id: inventoryId,
    p_brand: brand,
    p_drink_name: drink_name,
    p_flavor: flavor,
    p_type: type,
    p_unit: unit,
    p_unit_size: unit_size,
  })
  if (error) console.error('[drinkFrequency] failed to record add', error)
}

export async function listFrequentDrinks(inventoryId) {
  const { data, error } = await supabase
    .from('drink_frequency')
    .select('brand, drink_name, flavor, type, unit, unit_size, count, last_added_at')
    .eq('inventory_id', inventoryId)
    .limit(200)
  if (error) throw error
  return data
}

function daysSince(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
}

// Recency-weighted score, half-life decay — purely a function of `now()`
// at read time, so stale habits fade out without any background job.
export function rankFrequentDrinks(rows, { limit = 5, halfLifeDays = 30 } = {}) {
  return [...rows]
    .map(row => ({ row, score: row.count * Math.pow(0.5, daysSince(row.last_added_at) / halfLifeDays) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }) => row)
}
