import { useState, useEffect, useCallback } from 'react'
import { listMembers, updateMemberRole, removeMember, renameInventory, setInventoryEmoji, deleteInventory } from '../lib/inventories'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { canManageMembers, canManagePackSizes } from '../lib/permissions'
import InviteMemberModal from './InviteMemberModal'
import PackSizesModal from './PackSizesModal'
import Avatar, { initials } from './Avatar'
import FieldLabel from './FieldLabel'
import FormError from './FormError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const ROLES = ['viewer', 'contributor', 'editor']

export default function ManageInventoryModal({ inventory, packSizes, onReloadPackSizes, onClose, onChanged }) {
  const role = inventory.role
  const isShared = inventory.type === 'shared'
  const canManage = canManageMembers(role) // owner — same gate the DB's RLS/trigger enforce for icon/rename/members/delete
  const canManagePacks = canManagePackSizes(role) // owner or editor

  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [managingPackSizes, setManagingPackSizes] = useState(false)
  const [name, setName] = useState(inventory.name)
  const [emoji, setEmoji] = useState(inventory.emoji || '')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await listMembers(inventory.id)
    setMembers(data)
    setLoading(false)
  }, [inventory.id])

  // Personal inventories have no member management UI (there's no one to
  // invite), so skip the fetch and the subscription below entirely rather
  // than loading a members list nothing ever shows.
  useEffect(() => { if (isShared) load() }, [isShared, load])

  // Other members' display names can change while this modal is open (e.g.
  // someone finishes onboarding elsewhere) — keep the list live.
  useRealtimeTable({
    channelName: `members-profiles-changes-${inventory.id}`,
    table: 'profiles',
    event: 'UPDATE',
    enabled: isShared,
  }, load)

  async function handleRoleChange(userId, role) {
    await updateMemberRole(inventory.id, userId, role)
    await load()
  }

  async function handleRemove(userId) {
    if (!confirm('remove this member from the inventory?')) return
    await removeMember(inventory.id, userId)
    await load()
  }

  async function handleRename() {
    if (!name.trim() || name.trim() === inventory.name) return
    setError('')
    try {
      await renameInventory(inventory.id, name.trim())
      onChanged?.()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSaveEmoji() {
    const trimmed = emoji.trim()
    if (trimmed === (inventory.emoji || '')) return
    setError('')
    try {
      await setInventoryEmoji(inventory.id, trimmed)
      onChanged?.()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete() {
    if (!confirm(`delete "${inventory.name}"? this removes it for everyone.`)) return
    setError('')
    try {
      await deleteInventory(inventory.id)
      onChanged?.()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>manage "{inventory.name}"</DialogTitle>
          </DialogHeader>

          {canManage && (
            <div>
              <FieldLabel>icon</FieldLabel>
              <div className="flex gap-2">
                <Input
                  className="w-16 text-center text-base"
                  value={emoji}
                  onChange={e => setEmoji(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveEmoji()}
                  placeholder={initials(inventory.name)}
                  maxLength={8}
                />
                <Button variant="outline" size="sm" onClick={handleSaveEmoji}>save</Button>
              </div>
            </div>
          )}

          {canManage && (
            <div>
              <FieldLabel>rename</FieldLabel>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRename()}
                />
                <Button variant="outline" size="sm" onClick={handleRename}>save</Button>
              </div>
            </div>
          )}

          {canManagePacks && (
            <div className="flex items-center justify-between">
              <FieldLabel className="mb-0">pack sizes</FieldLabel>
              <Button variant="outline" size="sm" onClick={() => setManagingPackSizes(true)}>configure</Button>
            </div>
          )}

          {canManage && isShared && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <FieldLabel className="mb-0">members</FieldLabel>
                <Button variant="outline" size="sm" onClick={() => setInviting(true)}>+ invite</Button>
              </div>
              {loading ? (
                <div className="text-xs text-muted-foreground">loading…</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {members.map(m => (
                    <div
                      key={m.user_id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-2.5 py-2"
                    >
                      <Avatar profile={m.profile} size={22} />
                      <span
                        className="flex-1 overflow-hidden text-[13px] text-ellipsis whitespace-nowrap"
                        title={m.profile?.email}
                      >
                        {m.profile?.display_name || m.profile?.email || m.user_id}
                      </span>
                      {m.role === 'owner' ? (
                        <span className="font-mono text-[11px] tracking-wide text-primary uppercase">owner</span>
                      ) : (
                        <>
                          <Select value={m.role} onValueChange={(role) => handleRoleChange(m.user_id, role)}>
                            <SelectTrigger size="sm" className="h-auto py-1 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleRemove(m.user_id)}
                          >
                            remove
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {canManage && isShared && (
            <Button variant="destructive" className="w-full" onClick={handleDelete}>
              delete inventory
            </Button>
          )}

          <FormError>{error}</FormError>
        </DialogContent>
      </Dialog>

      {inviting && (
        <InviteMemberModal
          inventoryId={inventory.id}
          onClose={() => setInviting(false)}
          onInvited={() => { setInviting(false); load() }}
        />
      )}

      {managingPackSizes && (
        <PackSizesModal
          inventory={inventory}
          packSizes={packSizes}
          onReload={onReloadPackSizes}
          onClose={() => setManagingPackSizes(false)}
        />
      )}
    </>
  )
}
