import { describe, it, expect } from 'vitest'
import { createSharedInventory } from '../../src/lib/inventories.js'
import { asUser } from './helpers/asUser.js'
import { createTestUser } from './helpers/testUsers.js'

// create_shared_inventory() caps *owned* inventories (personal + shared) at
// 10 (20260714073424_inventory_cap.sql). Signup already grants one personal
// inventory, so a fresh user can create at most 9 shared ones before hitting
// the cap on the 10th attempt.
describe('inventory cap', () => {
  it('allows up to 9 shared inventories, then rejects the 10th owned inventory', async () => {
    const owner = await createTestUser()

    for (let i = 0; i < 9; i++) {
      await expect(
        asUser(owner.session, () => createSharedInventory(`Shared ${i}`))
      ).resolves.toBeTruthy()
    }

    await expect(
      asUser(owner.session, () => createSharedInventory('One too many'))
    ).rejects.toThrow("You've reached the limit of 10 inventories during beta.")
  }, 30000)
})
