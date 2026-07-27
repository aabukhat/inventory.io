import { supabase } from './supabase'
import { formatDrinkLabel } from './variantGrouping'

export const CAN_SIZES = ['8oz', '10oz', '11oz', '12oz', '14.9oz', '16oz', '19.2oz', '24oz', '25oz', '32oz']
export const BOTTLE_SIZES = ['7oz', '8oz', '10oz', '11.2oz', '12oz', '14.9oz', '16oz', '22oz', '24oz', '32oz', '40oz']

export const LIQUOR_UNIT_SIZE_MAP = {
  'shooter':   '50ml',
  'half pint': '200ml',
  'pint':      '375ml',
  'fifth':     '750ml',
  'liter':     '1L',
  'handle':    '1.75L',
}
export const LIQUOR_UNITS = Object.keys(LIQUOR_UNIT_SIZE_MAP)

// The product catalog (brand/drink_name/flavor, beer/seltzer/cider
// structured, liquor unstructured — see the products-catalog migration)
// backs the single add/edit-item autosuggest field. It's static reference
// data that only changes via a reviewed migration/regeneration, so it's
// fetched once and cached here rather than re-queried per keystroke or
// per modal open.
let _cache = null

export async function fetchProducts() {
  if (_cache) return _cache
  const { data, error } = await supabase.from('products').select('*')
  if (error) throw error
  _cache = data
  return data
}

export function searchProducts(products, query) {
  if (!query || query.trim().length < 1) return []
  const q = query.toLowerCase()
  return products
    .filter(p => formatDrinkLabel(p).toLowerCase().includes(q))
    .slice(0, 8)
}
