import { describe, it, expect, beforeAll } from 'vitest'
import {
  renameInventory,
  setInventoryEmoji,
  deleteInventory,
  updateMemberRole,
  removeMember,
  leaveInventory,
  listMyInventories,
} from '../../src/lib/inventories.js'
import { supabase } from '../../src/lib/supabase.js'
import { asUser } from './helpers/asUser.js'
import { createInventoryWithRoles } from './helpers/testInventories.js'
import { adminClient } from './helpers/adminClient.js'

let inv

beforeAll(async () => {
  inv = await createInventoryWithRoles(['editor', 'viewer'])
}, 30000)

async function fetchInventory(id) {
  const { data } = await adminClient.from('inventories').select('*').eq('id', id).single()
  return data
}

describe('inventory rename/emoji/delete — owner only', () => {
  it('owner can rename and set emoji', async () => {
    await asUser(inv.members.owner.session, () => renameInventory(inv.inventoryId, 'Renamed by owner'))
    await asUser(inv.members.owner.session, () => setInventoryEmoji(inv.inventoryId, '\u{1F37A}'))
    const row = await fetchInventory(inv.inventoryId)
    expect(row.name).toBe('Renamed by owner')
    expect(row.emoji).toBe('\u{1F37A}')
  })

  it('editor cannot rename the inventory (RLS-filtered, silent no-op)', async () => {
    await asUser(inv.members.editor.session, () => renameInventory(inv.inventoryId, 'Renamed by editor'))
    const row = await fetchInventory(inv.inventoryId)
    expect(row.name).not.toBe('Renamed by editor')
  })

  it('type and owner_id are immutable even for the owner', async () => {
    await asUser(inv.members.owner.session, async () => {
      const { error } = await supabase.from('inventories').update({ type: 'personal' }).eq('id', inv.inventoryId)
      expect(error).not.toBeNull()
      expect(error.message).toContain('FIELD_IMMUTABLE')
    })
  })

  it('the personal inventory created at signup cannot be deleted, even by its owner', async () => {
    const personalInventories = await asUser(inv.members.owner.session, () => listMyInventories())
    const personal = personalInventories.find(i => i.type === 'personal')
    expect(personal).toBeTruthy()

    await expect(
      asUser(inv.members.owner.session, () => deleteInventory(personal.id))
    ).rejects.toThrow()
  })

  it('owner can delete a shared inventory they own', async () => {
    const disposable = await createInventoryWithRoles([])
    await asUser(disposable.members.owner.session, () => deleteInventory(disposable.inventoryId))
    expect(await fetchInventory(disposable.inventoryId)).toBeNull()
  })
})

describe('protect_owner_membership', () => {
  it('the owner cannot be demoted while the inventory still exists', async () => {
    await expect(
      asUser(inv.members.owner.session, () =>
        updateMemberRole(inv.inventoryId, inv.members.owner.user.id, 'editor')
      )
    ).rejects.toThrow('CANNOT_DEMOTE_OWNER')
  })

  it('the owner cannot be removed while the inventory still exists', async () => {
    await expect(
      asUser(inv.members.owner.session, () =>
        removeMember(inv.inventoryId, inv.members.owner.user.id)
      )
    ).rejects.toThrow('CANNOT_REMOVE_OWNER')
  })
})

describe('member role/removal boundaries', () => {
  it('owner can change another member\'s role', async () => {
    await asUser(inv.members.owner.session, () => updateMemberRole(inv.inventoryId, inv.members.viewer.user.id, 'contributor'))
    const { data } = await adminClient
      .from('inventory_members')
      .select('role')
      .eq('inventory_id', inv.inventoryId)
      .eq('user_id', inv.members.viewer.user.id)
      .single()
    expect(data.role).toBe('contributor')
  })

  it('a non-owner cannot change another member\'s role (RLS-filtered, silent no-op)', async () => {
    const before = await adminClient
      .from('inventory_members')
      .select('role')
      .eq('inventory_id', inv.inventoryId)
      .eq('user_id', inv.members.editor.user.id)
      .single()

    await asUser(inv.members.viewer.session, () => updateMemberRole(inv.inventoryId, inv.members.editor.user.id, 'viewer'))

    const after = await adminClient
      .from('inventory_members')
      .select('role')
      .eq('inventory_id', inv.inventoryId)
      .eq('user_id', inv.members.editor.user.id)
      .single()
    expect(after.data.role).toBe(before.data.role)
  })

  it('a member can leave (remove themself) even without owner permissions', async () => {
    const solo = await createInventoryWithRoles(['viewer'])
    await asUser(solo.members.viewer.session, () => leaveInventory(solo.inventoryId))
    const { data } = await adminClient
      .from('inventory_members')
      .select('user_id')
      .eq('inventory_id', solo.inventoryId)
      .eq('user_id', solo.members.viewer.user.id)
      .maybeSingle()
    expect(data).toBeNull()
  })
})
