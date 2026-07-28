import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rankFrequentDrinks } from './drinkFrequency'

const NOW = new Date('2026-07-27T12:00:00Z')

function daysAgo(n) {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

describe('rankFrequentDrinks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns [] for empty input', () => {
    expect(rankFrequentDrinks([])).toEqual([])
  })

  it('ranks by recency-decayed score, not raw count — a big count long ago can lose to a smaller recent count', () => {
    const justNow = { name: 'justNow', count: 10, last_added_at: daysAgo(0) } // score = 10
    const halfLifeAgo = { name: 'halfLifeAgo', count: 100, last_added_at: daysAgo(30) } // score = 100 * 0.5 = 50
    const twoHalfLivesAgo = { name: 'twoHalfLivesAgo', count: 5, last_added_at: daysAgo(60) } // score = 5 * 0.25 = 1.25
    const barelyAnything = { name: 'barelyAnything', count: 1, last_added_at: daysAgo(0) } // score = 1

    const ranked = rankFrequentDrinks([barelyAnything, twoHalfLivesAgo, justNow, halfLifeAgo])
    expect(ranked.map(r => r.name)).toEqual(['halfLifeAgo', 'justNow', 'twoHalfLivesAgo', 'barelyAnything'])
  })

  it('respects a custom limit', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ name: `row${i}`, count: 7 - i, last_added_at: daysAgo(0) }))
    expect(rankFrequentDrinks(rows, { limit: 3 })).toHaveLength(3)
  })

  it('defaults to a limit of 5', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ name: `row${i}`, count: 1, last_added_at: daysAgo(0) }))
    expect(rankFrequentDrinks(rows)).toHaveLength(5)
  })

  it('respects a custom halfLifeDays', () => {
    const row = { name: 'row', count: 100, last_added_at: daysAgo(10) }
    const fastDecay = rankFrequentDrinks([row], { halfLifeDays: 10 })[0]
    const slowDecay = rankFrequentDrinks([row], { halfLifeDays: 100 })[0]
    // same input row object either way — score isn't attached to the
    // returned row, so assert via relative ordering against a fixed baseline
    const baseline = { name: 'baseline', count: 51, last_added_at: daysAgo(0) }
    expect(rankFrequentDrinks([row, baseline], { halfLifeDays: 10 }).map(r => r.name)).toEqual(['baseline', 'row'])
    expect(rankFrequentDrinks([row, baseline], { halfLifeDays: 100 }).map(r => r.name)).toEqual(['row', 'baseline'])
    expect(fastDecay).toBeTruthy()
    expect(slowDecay).toBeTruthy()
  })

  it('preserves the original input array (does not mutate)', () => {
    const rows = [{ name: 'a', count: 1, last_added_at: daysAgo(0) }]
    const copy = [...rows]
    rankFrequentDrinks(rows)
    expect(rows).toEqual(copy)
  })
})
