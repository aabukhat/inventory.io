// Groups inventory rows that are variants of the same base drink (same
// brand + drink_name, within the same subsection) into a single collapsible
// row. Items without a brand never group — that's what makes every
// pre-existing (pre-migration) row render as a normal single item.

// Renders an item's denormalized last-change snapshot (set server-side by
// the log_drink_change() trigger, see supabase/migrations/20260726000000_audit_log.sql)
// back into the same "Name +1 · Jul 23, 2:14 PM" text the old free-text
// last_change column used to hold directly.
export function formatLastChange(item) {
  if (!item?.last_change_at) return null
  const name = item.last_change_actor_display_name || 'Unknown user'
  const verb = item.last_change_action === 'added' ? 'added'
    : item.last_change_action === 'edited' ? 'edited'
    : item.last_change_action === 'qty_increased' ? `+${item.last_change_delta}`
    : item.last_change_action === 'qty_decreased' ? `${item.last_change_delta}`
    : ''
  const when = new Date(item.last_change_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return `${name} ${verb} · ${when}`
}

export function normalizeKey(brand, drinkName) {
  return `${(brand || '').trim().toLowerCase()}::${(drinkName || '').trim().toLowerCase()}`
}

// items is the already filtered/sorted array for one subsection's table.
// Returns entries in first-seen order: { kind: 'single', item } or
// { kind: 'group', key, items }. Groups that end up with only one member
// (either because only one variant exists, or brand is unset) are singles.
export function groupItems(items) {
  const entries = []
  const bucketIndex = new Map()

  for (const item of items) {
    if (!item.brand || !item.brand.trim()) {
      entries.push({ kind: 'single', item })
      continue
    }
    const groupKey = `${item.subsection_id}::${normalizeKey(item.brand, item.drink_name)}`
    if (bucketIndex.has(groupKey)) {
      entries[bucketIndex.get(groupKey)].items.push(item)
    } else {
      bucketIndex.set(groupKey, entries.length)
      entries.push({ kind: 'group', key: groupKey, items: [item] })
    }
  }

  return entries.map(entry =>
    entry.kind === 'group' && entry.items.length === 1
      ? { kind: 'single', item: entry.items[0] }
      : entry
  )
}

// Majority-vote type across a group's variants, tie-broken by first-seen.
export function dominantType(variants) {
  const counts = new Map()
  for (const v of variants) counts.set(v.type, (counts.get(v.type) || 0) + 1)
  let best = variants[0].type
  let bestCount = 0
  for (const v of variants) {
    const count = counts.get(v.type)
    if (count > bestCount) { bestCount = count; best = v.type }
  }
  return best
}

export function sumQuantity(variants) {
  return variants.reduce((sum, v) => sum + (v.quantity || 0), 0)
}

// Returns the variant with the most recent last_change_at (the item itself,
// not just its timestamp, so the caller can render its actor snapshot).
export function latestChange(variants) {
  let best = null
  let bestTime = -1
  for (const v of variants) {
    const t = v.last_change_at ? new Date(v.last_change_at).getTime() : 0
    if (t > bestTime) { bestTime = t; best = v }
  }
  return best
}
