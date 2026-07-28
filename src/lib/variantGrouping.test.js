import { describe, it, expect } from 'vitest'
import {
  formatLastChange,
  normalizeKey,
  formatDrinkLabel,
  groupItems,
  dominantType,
  sumQuantity,
  latestChange,
} from './variantGrouping'

describe('formatLastChange', () => {
  it('returns null when there is no last_change_at', () => {
    expect(formatLastChange(null)).toBeNull()
    expect(formatLastChange({})).toBeNull()
  })

  it('formats an "added" action', () => {
    const out = formatLastChange({
      last_change_at: '2026-07-23T14:14:00Z',
      last_change_actor_display_name: 'Alice',
      last_change_action: 'added',
    })
    expect(out.startsWith('Alice added · ')).toBe(true)
  })

  it('formats a qty_increased action with a + prefix on the delta', () => {
    const out = formatLastChange({
      last_change_at: '2026-07-23T14:14:00Z',
      last_change_actor_display_name: 'Alice',
      last_change_action: 'qty_increased',
      last_change_delta: 3,
    })
    expect(out.startsWith('Alice +3 · ')).toBe(true)
  })

  it('formats a qty_decreased action by interpolating the delta as stored', () => {
    const out = formatLastChange({
      last_change_at: '2026-07-23T14:14:00Z',
      last_change_actor_display_name: 'Alice',
      last_change_action: 'qty_decreased',
      last_change_delta: -2,
    })
    expect(out.startsWith('Alice -2 · ')).toBe(true)
  })

  it('formats an edited action', () => {
    const out = formatLastChange({
      last_change_at: '2026-07-23T14:14:00Z',
      last_change_actor_display_name: 'Alice',
      last_change_action: 'edited',
    })
    expect(out.startsWith('Alice edited · ')).toBe(true)
  })

  it('falls back to "Unknown user" when the actor snapshot is missing', () => {
    const out = formatLastChange({ last_change_at: '2026-07-23T14:14:00Z', last_change_action: 'added' })
    expect(out.startsWith('Unknown user added · ')).toBe(true)
  })
})

describe('normalizeKey', () => {
  it('is case- and whitespace-insensitive', () => {
    expect(normalizeKey('  Bud Light ', 'lime')).toBe(normalizeKey('bud light', '  LIME  '))
  })

  it('treats missing brand/drink_name as empty strings', () => {
    expect(normalizeKey(null, undefined)).toBe('::')
  })
})

describe('formatDrinkLabel', () => {
  it('joins brand + drink_name + flavor', () => {
    expect(formatDrinkLabel({ brand: 'White Claw', drink_name: 'Hard Seltzer', flavor: 'Mango' }))
      .toBe('White Claw Hard Seltzer Mango')
  })

  it('omits missing fields without leaving extra spaces', () => {
    expect(formatDrinkLabel({ brand: null, drink_name: 'Anejo', flavor: null })).toBe('Anejo')
  })

  it('handles a completely empty input', () => {
    expect(formatDrinkLabel({})).toBe('')
    expect(formatDrinkLabel(undefined)).toBe('')
  })
})

describe('groupItems', () => {
  it('groups same subsection + brand + drink_name (case/whitespace-insensitive) variants together', () => {
    const items = [
      { id: 1, subsection_id: 's1', brand: 'White Claw', drink_name: 'Hard Seltzer', flavor: 'Mango' },
      { id: 2, subsection_id: 's1', brand: '  white claw ', drink_name: 'HARD SELTZER', flavor: 'Lime' },
    ]
    const result = groupItems(items)
    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('group')
    expect(result[0].items).toHaveLength(2)
  })

  it('never groups items with no brand', () => {
    const items = [
      { id: 1, subsection_id: 's1', brand: null, drink_name: 'Cabo Wabo Anejo' },
      { id: 2, subsection_id: 's1', brand: '', drink_name: 'Cabo Wabo Anejo' },
    ]
    const result = groupItems(items)
    expect(result).toEqual([
      { kind: 'single', item: items[0] },
      { kind: 'single', item: items[1] },
    ])
  })

  it('collapses a would-be group of exactly one variant back to a single', () => {
    const items = [{ id: 1, subsection_id: 's1', brand: 'Bud', drink_name: 'Light' }]
    expect(groupItems(items)).toEqual([{ kind: 'single', item: items[0] }])
  })

  it('does not group the same brand+drink_name across different subsections', () => {
    const items = [
      { id: 1, subsection_id: 's1', brand: 'Bud', drink_name: 'Light' },
      { id: 2, subsection_id: 's2', brand: 'Bud', drink_name: 'Light' },
    ]
    const result = groupItems(items)
    expect(result).toHaveLength(2)
    expect(result.every(e => e.kind === 'single')).toBe(true)
  })

  it('preserves first-seen order', () => {
    const items = [
      { id: 1, subsection_id: 's1', brand: 'Z Brand', drink_name: 'A' },
      { id: 2, subsection_id: 's1', brand: 'A Brand', drink_name: 'B' },
    ]
    const result = groupItems(items)
    expect(result[0].item.id).toBe(1)
    expect(result[1].item.id).toBe(2)
  })
})

describe('dominantType', () => {
  it('picks the clear majority type', () => {
    expect(dominantType([{ type: 'beer' }, { type: 'beer' }, { type: 'cider' }])).toBe('beer')
  })

  it('ties break in favor of the first variant\'s type', () => {
    expect(dominantType([{ type: 'cider' }, { type: 'beer' }, { type: 'beer' }, { type: 'cider' }])).toBe('cider')
  })

  it('a single variant is its own dominant type', () => {
    expect(dominantType([{ type: 'liquor' }])).toBe('liquor')
  })
})

describe('sumQuantity', () => {
  it('sums quantities, treating missing quantity as 0', () => {
    expect(sumQuantity([{ quantity: 3 }, { quantity: 2 }, {}])).toBe(5)
  })

  it('returns 0 for an empty array', () => {
    expect(sumQuantity([])).toBe(0)
  })
})

describe('latestChange', () => {
  it('returns the variant with the most recent last_change_at', () => {
    const older = { id: 1, last_change_at: '2026-07-01T00:00:00Z' }
    const newer = { id: 2, last_change_at: '2026-07-23T00:00:00Z' }
    expect(latestChange([older, newer])).toBe(newer)
    expect(latestChange([newer, older])).toBe(newer)
  })

  it('falls back to the first variant when none have a timestamp', () => {
    const a = { id: 1 }
    const b = { id: 2 }
    expect(latestChange([a, b])).toBe(a)
  })
})
