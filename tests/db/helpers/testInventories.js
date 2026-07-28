import { createSharedInventory, inviteMember } from '../../../src/lib/inventories.js'
import { listSubsections } from '../../../src/lib/subsections.js'
import { asUser } from './asUser.js'
import { createTestUser } from './testUsers.js'

// Builds a shared inventory owned by a fresh test user, with one additional
// fresh test user invited per role in `roles` (e.g. ['editor', 'contributor',
// 'viewer']). create_shared_inventory() bootstraps the owner membership +
// Uncategorized subsection in the same RPC call (confirmed by reading its
// definition in supabase/migrations/20260723191859_move_drinks_between_subsections.sql),
// so no separate subsection setup is needed for the common case.
export async function createInventoryWithRoles(roles = []) {
  const owner = await createTestUser()
  const inventoryId = await asUser(owner.session, () =>
    createSharedInventory(`Test Inventory ${Date.now()}`)
  )

  const members = { owner }
  for (const role of roles) {
    const testUser = await createTestUser()
    await asUser(owner.session, () => inviteMember(inventoryId, testUser.email, role))
    members[role] = testUser
  }

  const subsections = await asUser(owner.session, () => listSubsections(inventoryId))
  const uncategorized = subsections.find(s => s.is_uncategorized)

  return { inventoryId, members, uncategorized, subsections }
}
