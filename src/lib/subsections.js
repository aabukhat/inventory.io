import { supabase } from './supabase'

// dataTransfer payload is a JSON-encoded array of drink ids (a single-item
// drag is an array of length 1) so one move path handles both an
// individual row and a whole collapsed variant group.
export const ITEM_DRAG_MIME = 'application/x-drink-id'

function friendlySubsectionError(error) {
  const msg = error.message || ''
  if (msg.includes('SUBSECTION_ALREADY_EXISTS')) {
    return new Error('That subsection has already been added.')
  }
  if (msg.includes('SUBSECTION_NAME_TAKEN')) {
    return new Error('A subsection with that name already exists — use the existing one instead.')
  }
  if (msg.includes('SUBSECTION_NAME_INVALID')) {
    return new Error('Subsection names must be 1–40 characters.')
  }
  if (msg.includes('INSUFFICIENT_ROLE')) {
    return new Error('Only owners and editors can manage subsections.')
  }
  if (msg.includes('CANNOT_DELETE_UNCATEGORIZED')) {
    return new Error('The Uncategorized section can\'t be deleted.')
  }
  return error
}

function friendlyMoveError(error) {
  const msg = error.message || ''
  if (msg.includes('INSUFFICIENT_ROLE')) {
    return new Error('You don\'t have permission to move items in this inventory.')
  }
  return error
}

export async function listSubsections(inventoryId) {
  const { data, error } = await supabase
    .from('inventory_subsections')
    .select('id, preset_key, name, position, is_uncategorized')
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

export async function deleteSubsection(id) {
  const { error } = await supabase.rpc('delete_subsection', { p_id: id })
  if (error) throw friendlySubsectionError(error)
}

export async function moveDrinks(drinkIds, subsectionId) {
  const { error } = await supabase.rpc('move_drinks', {
    p_drink_ids: drinkIds,
    p_subsection_id: subsectionId,
  })
  if (error) throw friendlyMoveError(error)
}
