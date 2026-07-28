import { describe, it, expect, beforeAll } from 'vitest'
import { addSubsection } from '../../src/lib/subsections.js'
import { savePackSizes } from '../../src/lib/packSizes.js'
import { inviteMember } from '../../src/lib/inventories.js'
import { asUser } from './helpers/asUser.js'
import { createTestUser } from './helpers/testUsers.js'
import { createInventoryWithRoles } from './helpers/testInventories.js'
import { insertDrink, updateDrink, deleteDrink } from './helpers/drinks.js'
import { adminClient } from './helpers/adminClient.js'

// The highest-value file in this suite: mirrors the permission matrix
// documented in CLAUDE.md, driven through the real client code path (RLS +
// RPC + trigger together). This is the shape of test that would have caught
// the historical contributor-quantity trigger bug (fixed in migration
// 20260724060000) — that bug was invisible from either RLS or permissions.js
// in isolation, only visible when the two disagreed at runtime.

let inv

beforeAll(async () => {
  inv = await createInventoryWithRoles(['editor', 'contributor', 'viewer'])
}, 30000)

async function ownerInsertDrink(overrides = {}) {
  const { data, error } = await asUser(inv.members.owner.session, () =>
    insertDrink({
      drink_name: 'Test Drink',
      quantity: 5,
      inventory_id: inv.inventoryId,
      subsection_id: inv.uncategorized.id,
      ...overrides,
    })
  )
  expect(error).toBeNull()
  return data
}

async function currentQuantity(id) {
  const { data } = await adminClient.from('drinks').select('quantity').eq('id', id).single()
  return data.quantity
}

async function stillExists(id) {
  const { data } = await adminClient.from('drinks').select('id').eq('id', id).maybeSingle()
  return data !== null
}

describe('add items', () => {
  it.each(['owner', 'editor', 'contributor'])('%s can add an item', async role => {
    const { data, error } = await asUser(inv.members[role].session, () =>
      insertDrink({
        drink_name: `Added by ${role}`,
        inventory_id: inv.inventoryId,
        subsection_id: inv.uncategorized.id,
      })
    )
    expect(error).toBeNull()
    expect(data).toMatchObject({ drink_name: `Added by ${role}` })
  })

  it('viewer cannot add an item', async () => {
    const { data, error } = await asUser(inv.members.viewer.session, () =>
      insertDrink({
        drink_name: 'Added by viewer',
        inventory_id: inv.inventoryId,
        subsection_id: inv.uncategorized.id,
      })
    )
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })
})

describe('increase quantity', () => {
  it.each(['owner', 'editor', 'contributor'])('%s can increase quantity', async role => {
    const drink = await ownerInsertDrink()
    const { data, error } = await asUser(inv.members[role].session, () =>
      updateDrink(drink.id, { quantity: 6 })
    )
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data[0].quantity).toBe(6)
  })

  it('viewer cannot increase quantity (silently filtered by RLS, not an error)', async () => {
    const drink = await ownerInsertDrink()
    const { data, error } = await asUser(inv.members.viewer.session, () =>
      updateDrink(drink.id, { quantity: 6 })
    )
    expect(error).toBeNull()
    expect(data).toEqual([])
    expect(await currentQuantity(drink.id)).toBe(5)
  })
})

describe('decrease quantity — the historical bug case', () => {
  it.each(['owner', 'editor'])('%s can decrease quantity', async role => {
    const drink = await ownerInsertDrink()
    const { data, error } = await asUser(inv.members[role].session, () =>
      updateDrink(drink.id, { quantity: 3 })
    )
    expect(error).toBeNull()
    expect(data[0].quantity).toBe(3)
  })

  it('contributor CANNOT decrease quantity — RLS allows the request through, the trigger must reject it', async () => {
    const drink = await ownerInsertDrink()
    const { data, error } = await asUser(inv.members.contributor.session, () =>
      updateDrink(drink.id, { quantity: 3 })
    )
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error.message).toContain('CONTRIBUTOR_CANNOT_DECREASE')
    expect(await currentQuantity(drink.id)).toBe(5)
  })

  it('viewer cannot decrease quantity (RLS-filtered)', async () => {
    const drink = await ownerInsertDrink()
    const { data, error } = await asUser(inv.members.viewer.session, () =>
      updateDrink(drink.id, { quantity: 3 })
    )
    expect(error).toBeNull()
    expect(data).toEqual([])
    expect(await currentQuantity(drink.id)).toBe(5)
  })
})

describe('edit item details', () => {
  it.each(['owner', 'editor'])('%s can edit drink_name', async role => {
    const drink = await ownerInsertDrink()
    const { data, error } = await asUser(inv.members[role].session, () =>
      updateDrink(drink.id, { drink_name: 'Renamed' })
    )
    expect(error).toBeNull()
    expect(data[0].drink_name).toBe('Renamed')
  })

  it('contributor CAN change quantity but CANNOT change drink_name', async () => {
    const drink = await ownerInsertDrink()
    const { data, error } = await asUser(inv.members.contributor.session, () =>
      updateDrink(drink.id, { drink_name: 'Renamed by contributor' })
    )
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error.message).toContain('CONTRIBUTOR_CANNOT_EDIT_DETAILS')
  })

  it('viewer cannot edit drink_name (RLS-filtered)', async () => {
    const drink = await ownerInsertDrink()
    const { data, error } = await asUser(inv.members.viewer.session, () =>
      updateDrink(drink.id, { drink_name: 'Renamed by viewer' })
    )
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})

describe('delete items', () => {
  it.each(['owner', 'editor'])('%s can delete an item', async role => {
    const drink = await ownerInsertDrink()
    const { error } = await asUser(inv.members[role].session, () => deleteDrink(drink.id))
    expect(error).toBeNull()
    expect(await stillExists(drink.id)).toBe(false)
  })

  it.each(['contributor', 'viewer'])('%s cannot delete an item (RLS-filtered)', async role => {
    const drink = await ownerInsertDrink()
    const { error } = await asUser(inv.members[role].session, () => deleteDrink(drink.id))
    expect(error).toBeNull()
    expect(await stillExists(drink.id)).toBe(true)
  })
})

describe('manage subsections', () => {
  it.each(['owner', 'editor'])('%s can add a subsection', async role => {
    const row = await asUser(inv.members[role].session, () =>
      addSubsection(inv.inventoryId, null, `${role}'s subsection ${Date.now()}`)
    )
    expect(row).toMatchObject({ inventory_id: inv.inventoryId })
  })

  it.each(['contributor', 'viewer'])('%s cannot add a subsection', async role => {
    await expect(
      asUser(inv.members[role].session, () => addSubsection(inv.inventoryId, null, `nope ${Date.now()}`))
    ).rejects.toThrow('Only owners and editors can manage subsections.')
  })
})

describe('manage pack sizes', () => {
  it.each(['owner', 'editor'])('%s can set pack sizes', async role => {
    await expect(
      asUser(inv.members[role].session, () => savePackSizes(inv.inventoryId, 'beer', [6, 12]))
    ).resolves.not.toThrow()
  })

  it.each(['contributor', 'viewer'])('%s cannot set pack sizes', async role => {
    await expect(
      asUser(inv.members[role].session, () => savePackSizes(inv.inventoryId, 'beer', [6, 12]))
    ).rejects.toBeTruthy()
  })
})

describe('manage members / invite', () => {
  it('owner can invite a member', async () => {
    const invitee = await createTestUser()
    await expect(
      asUser(inv.members.owner.session, () => inviteMember(inv.inventoryId, invitee.email, 'viewer'))
    ).resolves.not.toThrow()
  })

  it.each(['editor', 'contributor', 'viewer'])('%s cannot invite a member', async role => {
    const invitee = await createTestUser()
    await expect(
      asUser(inv.members[role].session, () => inviteMember(inv.inventoryId, invitee.email, 'viewer'))
    ).rejects.toThrow('Only the inventory owner can invite members.')
  })
})
