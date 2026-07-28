import { describe, it, expect, beforeAll } from 'vitest'
import { recordDrinkAdd, listFrequentDrinks } from '../../src/lib/drinkFrequency.js'
import { supabase } from '../../src/lib/supabase.js'
import { asUser } from './helpers/asUser.js'
import { createInventoryWithRoles } from './helpers/testInventories.js'

let inv

beforeAll(async () => {
  inv = await createInventoryWithRoles(['editor'])
}, 30000)

const DRINK = { brand: 'Bud', drink_name: 'Light', flavor: null, type: 'beer', unit: 'can', unit_size: '12oz' }

describe('drink_frequency', () => {
  it('recordDrinkAdd inserts then increments count on repeat adds (atomic upsert)', async () => {
    await asUser(inv.members.owner.session, () => recordDrinkAdd(inv.inventoryId, DRINK))
    await asUser(inv.members.owner.session, () => recordDrinkAdd(inv.inventoryId, DRINK))

    const rows = await asUser(inv.members.owner.session, () => listFrequentDrinks(inv.inventoryId))
    const row = rows.find(r => r.drink_name === 'Light')
    expect(row.count).toBe(2)
  })

  it('a user can only see their own drink_frequency rows (select_own RLS)', async () => {
    await asUser(inv.members.owner.session, () => recordDrinkAdd(inv.inventoryId, DRINK))

    const editorsView = await asUser(inv.members.editor.session, () => listFrequentDrinks(inv.inventoryId))
    expect(editorsView.find(r => r.drink_name === 'Light')).toBeUndefined()
  })

  it('a direct table insert bypassing the RPC is rejected (no insert policy exists)', async () => {
    await asUser(inv.members.owner.session, async () => {
      const { error } = await supabase.from('drink_frequency').insert({
        user_id: inv.members.owner.user.id,
        inventory_id: inv.inventoryId,
        ...DRINK,
      })
      expect(error).not.toBeNull()
    })
  })
})
