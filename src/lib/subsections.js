import { supabase } from './supabase'

function friendlySubsectionError(error) {
  const msg = error.message || ''
  if (msg.includes('SUBSECTION_ALREADY_EXISTS')) {
    return new Error('That subsection has already been added.')
  }
  if (msg.includes('INSUFFICIENT_ROLE')) {
    return new Error('Only owners and editors can manage subsections.')
  }
  return error
}

export async function listSubsections(inventoryId) {
  const { data, error } = await supabase
    .from('inventory_subsections')
    .select('id, preset_key, name, position')
    .eq('inventory_id', inventoryId)
    .order('position')
  if (error) throw error
  return data
}

export async function addSubsection(inventoryId, presetKey, name) {
  const { data, error } = await supabase.rpc('add_subsection', {
    p_inventory_id: inventoryId,
    p_preset_key: presetKey,
    p_name: name,
  })
  if (error) throw friendlySubsectionError(error)
  return data
}

export async function reorderSubsections(inventoryId, orderedIds) {
  const { error } = await supabase.rpc('reorder_subsections', {
    p_inventory_id: inventoryId,
    p_ids: orderedIds,
  })
  if (error) throw friendlySubsectionError(error)
}
