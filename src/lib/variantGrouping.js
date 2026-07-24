// Groups inventory rows that are variants of the same base drink (same
// brand + drink_name, within the same subsection) into a single collapsible
// row. Items without a brand never group — that's what makes every
// pre-existing (pre-migration) row render as a normal single item.

export function parseLastChange(str) {
  if (!str) return 0
  const after = str.split('·').pop()?.trim()
  if (!after) return 0
  const year = new Date().getFullYear()
  return new Date(after.replace(',', `, ${year}`)).getTime() || 0
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

export function latestChange(variants) {
  let best = null
  let bestTime = -1
  for (const v of variants) {
    const t = parseLastChange(v.last_change)
    if (t > bestTime) { bestTime = t; best = v.last_change }
  }
  return best
}
