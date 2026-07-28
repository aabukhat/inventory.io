import { describe, it, expect, beforeAll } from 'vitest'
import { addSubsection, deleteSubsection } from '../../src/lib/subsections.js'
import { savePackSizes } from '../../src/lib/packSizes.js'
import { inviteMember, updateMemberRole } from '../../src/lib/inventories.js'
import { asUser } from './helpers/asUser.js'
import { createTestUser } from './helpers/testUsers.js'
import { createInventoryWithRoles } from './helpers/testInventories.js'
import { insertDrink, updateDrink, deleteDrink } from './helpers/drinks.js'
import { adminClient } from './helpers/adminClient.js'
import { supabase } from '../../src/lib/supabase.js'

let inv

beforeAll(async () => {
  inv = await createInventoryWithRoles(['editor'])
}, 30000)

async function latestAuditRow(inventoryId, action) {
  const { data, error } = await adminClient
    .from('audit_log')
    .select('*')
    .eq('inventory_id', inventoryId)
    .eq('action', action)
    .order('created_at', { ascending: false })
    .limit(1)
  expect(error).toBeNull()
  return data[0]
}

describe('audit_log — one representative case per trigger', () => {
  it('drink_added is logged on insert', async () => {
    const { data: drink } = await asUser(inv.members.owner.session, () =>
      insertDrink({ drink_name: 'Audit Test Drink', inventory_id: inv.inventoryId, subsection_id: inv.uncategorized.id })
    )
    const row = await latestAuditRow(inv.inventoryId, 'drink_added')
    expect(row).toMatchObject({ target_label: 'Audit Test Drink', actor_user_id: inv.members.owner.user.id })

    // qty increase + delete, reusing the same drink for the next two cases
    await asUser(inv.members.owner.session, () => updateDrink(drink.id, { quantity: 9 }))
    const increasedRow = await latestAuditRow(inv.inventoryId, 'drink_qty_increased')
    expect(increasedRow.detail).toEqual({ delta: 9 }) // default insert quantity is 0

    await asUser(inv.members.owner.session, () => deleteDrink(drink.id))
    const deletedRow = await latestAuditRow(inv.inventoryId, 'drink_deleted')
    expect(deletedRow.target_label).toBe('Audit Test Drink')
  })

  it('subsection_added / subsection_deleted are logged, but the bootstrap Uncategorized row is not', async () => {
    const name = `Audited Subsection ${Date.now()}`
    const subsection = await asUser(inv.members.owner.session, () => addSubsection(inv.inventoryId, null, name))
    const addedRow = await latestAuditRow(inv.inventoryId, 'subsection_added')
    expect(addedRow.target_label).toBe(name)

    await asUser(inv.members.owner.session, () => deleteSubsection(subsection.id))
    const deletedRow = await latestAuditRow(inv.inventoryId, 'subsection_deleted')
    expect(deletedRow.target_label).toBe(name)

    const { data: uncategorizedRows } = await adminClient
      .from('audit_log')
      .select('id')
      .eq('inventory_id', inv.inventoryId)
      .eq('target_label', 'Uncategorized')
    expect(uncategorizedRows).toHaveLength(0)
  })

  it('member_invited and member_role_changed are logged', async () => {
    const invitee = await createTestUser()
    await asUser(inv.members.owner.session, () => inviteMember(inv.inventoryId, invitee.email, 'viewer'))
    const invitedRow = await latestAuditRow(inv.inventoryId, 'member_invited')
    expect(invitedRow).toBeTruthy()

    await asUser(inv.members.owner.session, () => updateMemberRole(inv.inventoryId, invitee.user.id, 'contributor'))
    const roleChangedRow = await latestAuditRow(inv.inventoryId, 'member_role_changed')
    expect(roleChangedRow.detail).toEqual({ from: 'viewer', to: 'contributor' })
  })

  it('pack_sizes_updated is logged', async () => {
    await asUser(inv.members.owner.session, () => savePackSizes(inv.inventoryId, 'seltzer', [6, 12]))
    const row = await latestAuditRow(inv.inventoryId, 'pack_sizes_updated')
    expect(row.detail).toEqual({ sizes: [6, 12] })
  })

  it('a non-member cannot select the inventory\'s audit_log rows', async () => {
    const outsider = await createTestUser()
    const rows = await asUser(outsider.session, async () => {
      const { data, error } = await supabase.from('audit_log').select('*').eq('inventory_id', inv.inventoryId)
      expect(error).toBeNull()
      return data
    })
    expect(rows).toEqual([])
  })
})
