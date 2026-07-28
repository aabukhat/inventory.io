import { describe, it, expect } from 'vitest'
import { fetchProducts } from '../../src/lib/products.js'
import { asUser } from './helpers/asUser.js'
import { createTestUser } from './helpers/testUsers.js'

describe('products catalog', () => {
  it('an authenticated user can read the product catalog', async () => {
    const user = await createTestUser()
    const products = await asUser(user.session, () => fetchProducts())
    expect(products.length).toBeGreaterThan(0)
    expect(products[0]).toHaveProperty('drink_name')
  })
})
