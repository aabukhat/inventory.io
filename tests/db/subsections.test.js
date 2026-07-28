import { describe, it, expect, beforeAll } from 'vitest'
import { addSubsection, reorderSubsections, deleteSubsection, moveDrinks, listSubsections } from '../../src/lib/subsections.js'
import { asUser } from './helpers/asUser.js'
import { createInventoryWithRoles } from './helpers/testInventories.js'
import { insertDrink } from './helpers/drinks.js'
import { adminClient } from './helpers/adminClient.js'

let inv

beforeAll(async () => {
  inv = await createInventoryWithRoles([])
}, 30000)

describe('subsections', () => {
  it('add + reorder + delete a subsection round-trip', async () => {
    const fridge = await asUser(inv.members.owner.session, () =>
      addSubsection(inv.inventoryId, null, `Fridge ${Date.now()}`)
    )
    const freezer = await asUser(inv.members.owner.session, () =>
      addSubsection(inv.inventoryId, null, `Freezer ${Date.now()}`)
    )

    const all = await asUser(inv.members.owner.session, () => listSubsections(inv.inventoryId))
    const ids = all.map(s => s.id)
    const reversed = [...ids].reverse()
    await asUser(inv.members.owner.session, () => reorderSubsections(inv.inventoryId, reversed))

    const reordered = await asUser(inv.members.owner.session, () => listSubsections(inv.inventoryId))
    expect(reordered.map(s => s.id)).toEqual(reversed)

    await asUser(inv.members.owner.session, () => deleteSubsection(fridge.id))
    await asUser(inv.members.owner.session, () => deleteSubsection(freezer.id))
    const afterDelete = await asUser(inv.members.owner.session, () => listSubsections(inv.inventoryId))
    expect(afterDelete.find(s => s.id === fridge.id)).toBeUndefined()
  })

  it('the Uncategorized subsection cannot be deleted', async () => {
    await expect(
      asUser(inv.members.owner.session, () => deleteSubsection(inv.uncategorized.id))
    ).rejects.toThrow("The Uncategorized section can't be deleted.")
  })

  it('deleting a subsection reassigns its drinks to Uncategorized rather than deleting them', async () => {
    const custom = await asUser(inv.members.owner.session, () =>
      addSubsection(inv.inventoryId, null, `Reassign test ${Date.now()}`)
    )
    const { data: drink, error } = await asUser(inv.members.owner.session, () =>
      insertDrink({ drink_name: 'Orphan-to-be', inventory_id: inv.inventoryId, subsection_id: custom.id })
    )
    expect(error).toBeNull()

    await asUser(inv.members.owner.session, () => deleteSubsection(custom.id))

    const { data: after } = await adminClient.from('drinks').select('subsection_id').eq('id', drink.id).single()
    expect(after.subsection_id).toBe(inv.uncategorized.id)
  })

  it('reorder_subsections rejects an id list that does not match the inventory\'s actual subsection count', async () => {
    const currentIds = (await asUser(inv.members.owner.session, () => listSubsections(inv.inventoryId))).map(s => s.id)
    await expect(
      asUser(inv.members.owner.session, () => reorderSubsections(inv.inventoryId, [...currentIds, crypto.randomUUID()]))
    ).rejects.toThrow()
  })

  it('move_drinks moves items to another subsection within the same inventory', async () => {
    const target = await asUser(inv.members.owner.session, () =>
      addSubsection(inv.inventoryId, null, `Move target ${Date.now()}`)
    )
    const { data: drink } = await asUser(inv.members.owner.session, () =>
      insertDrink({ drink_name: 'Movable', inventory_id: inv.inventoryId, subsection_id: inv.uncategorized.id })
    )

    await asUser(inv.members.owner.session, () => moveDrinks([drink.id], target.id))

    const { data: after } = await adminClient.from('drinks').select('subsection_id').eq('id', drink.id).single()
    expect(after.subsection_id).toBe(target.id)
  })

  it('move_drinks rejects moving into a subsection belonging to a different inventory', async () => {
    const other = await createInventoryWithRoles([])
    const { data: drink } = await asUser(inv.members.owner.session, () =>
      insertDrink({ drink_name: 'Cross-inventory attempt', inventory_id: inv.inventoryId, subsection_id: inv.uncategorized.id })
    )

    await expect(
      asUser(inv.members.owner.session, () => moveDrinks([drink.id], other.uncategorized.id))
    ).rejects.toThrow()
  }, 15000)
})
