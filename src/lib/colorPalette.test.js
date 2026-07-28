import { describe, it, expect } from 'vitest'
import { COLOR_PALETTE, hexForToken, hexForId, avatarColor } from './colorPalette'

describe('hexForToken', () => {
  it('resolves every fixed token to its hex value', () => {
    for (const { token, hex } of COLOR_PALETTE) {
      expect(hexForToken(token)).toBe(hex)
    }
  })

  it('returns undefined for an unknown token', () => {
    expect(hexForToken('not-a-real-color')).toBeUndefined()
  })
})

describe('hexForId', () => {
  it('is deterministic — same id always maps to the same color', () => {
    const id = 'user-abc-123'
    expect(hexForId(id)).toBe(hexForId(id))
  })

  it('always returns a hex value from the fixed palette', () => {
    const validHexes = new Set(COLOR_PALETTE.map(c => c.hex))
    for (const id of ['a', 'user-1', 'zzzzzzzz', '00000000-0000-0000-0000-000000000000']) {
      expect(validHexes.has(hexForId(id))).toBe(true)
    }
  })

  it('produces more than one distinct color across a range of ids (non-degenerate distribution)', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `id-${i}`)
    const distinctHexes = new Set(ids.map(hexForId))
    expect(distinctHexes.size).toBeGreaterThan(1)
  })
})

describe('avatarColor', () => {
  it('prefers the profile favorite_color token when set', () => {
    const profile = { id: 'u1', favorite_color: 'lime' }
    expect(avatarColor(profile)).toBe(hexForToken('lime'))
  })

  it('falls back to the id hash when favorite_color is unset', () => {
    const profile = { id: 'u1', favorite_color: null }
    expect(avatarColor(profile)).toBe(hexForId('u1'))
  })

  it('falls back to a fixed placeholder id when profile itself is missing', () => {
    expect(avatarColor(undefined)).toBe(hexForId('?'))
  })

  it('falls back to the id hash when favorite_color is an unrecognized token', () => {
    const profile = { id: 'u1', favorite_color: 'not-a-real-color' }
    expect(avatarColor(profile)).toBe(hexForId('u1'))
  })
})
