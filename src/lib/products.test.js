import { describe, it, expect } from 'vitest'
import { searchProducts } from './products'

const PRODUCTS = [
  { brand: 'White Claw', drink_name: 'Hard Seltzer', flavor: 'Mango' },
  { brand: 'White Claw', drink_name: 'Hard Seltzer', flavor: 'Black Cherry' },
  { brand: null, drink_name: 'Cabo Wabo Anejo', flavor: null },
  { brand: 'Bud', drink_name: 'Light', flavor: null },
]

describe('searchProducts', () => {
  it('returns [] for an empty or missing query', () => {
    expect(searchProducts(PRODUCTS, '')).toEqual([])
    expect(searchProducts(PRODUCTS, '   ')).toEqual([])
    expect(searchProducts(PRODUCTS, undefined)).toEqual([])
  })

  it('matches case-insensitively against the joined brand/drink_name/flavor label', () => {
    const results = searchProducts(PRODUCTS, 'MANGO')
    expect(results).toHaveLength(1)
    expect(results[0].flavor).toBe('Mango')
  })

  it('matches liquor rows with no brand via drink_name alone', () => {
    const results = searchProducts(PRODUCTS, 'cabo wabo')
    expect(results).toHaveLength(1)
  })

  it('caps results at 8', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ brand: 'Brand', drink_name: `Product ${i}`, flavor: null }))
    expect(searchProducts(many, 'product')).toHaveLength(8)
  })
})
