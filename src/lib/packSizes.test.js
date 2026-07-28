import { describe, it, expect } from 'vitest'
import { resolvePackSizes, DEFAULT_PACK_SIZES } from './packSizes'

describe('resolvePackSizes', () => {
  it('falls back to the default when packSizes is null', () => {
    expect(resolvePackSizes(null, 'beer')).toEqual([...DEFAULT_PACK_SIZES.beer].sort((a, b) => a - b))
  })

  it('falls back to the default when the type key is absent (undefined)', () => {
    expect(resolvePackSizes({}, 'beer')).toEqual([6, 12, 24])
  })

  it('does NOT fall back when the stored value is an explicit empty array', () => {
    expect(resolvePackSizes({ beer: [] }, 'beer')).toEqual([])
  })

  it('returns a stored populated array, sorted ascending', () => {
    expect(resolvePackSizes({ beer: [24, 6, 12] }, 'beer')).toEqual([6, 12, 24])
  })

  it('a type with no default (liquor) resolves to [] when unset', () => {
    expect(resolvePackSizes(null, 'liquor')).toEqual([])
  })

  it('an unknown type with no packSizes entry and no default resolves to []', () => {
    expect(resolvePackSizes({}, 'unknown-type')).toEqual([])
  })

  it('does not mutate the input array', () => {
    const sizes = [24, 6, 12]
    const packSizes = { beer: sizes }
    resolvePackSizes(packSizes, 'beer')
    expect(sizes).toEqual([24, 6, 12])
  })
})
