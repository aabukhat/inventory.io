import { useState, useEffect, useCallback } from 'react'
import { listMembers, updateMemberRole, removeMember, renameInventory, deleteInventory } from '../lib/inventories'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import InviteMemberModal from './InviteMemberModal'
import Avatar from './Avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const ROLES = ['viewer', 'contributor', 'editor']

export default function MembersModal({ inventory, onClose, onChanged }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [name, setName] = useState(inventory.name)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await listMembers(inventory.id)
    setMembers(data)
    setLoading(false)
  }, [inventory.id])

  useEffect(() => { load() }, [load])

  // Other members' display names can change while this modal is open (e.g.
  // someone finishes onboarding elsewhere) — keep the list live.
  useRealtimeTable({
    channelName: `members-profiles-changes-${inventory.id}`,
    table: 'profiles',
    event: 'UPDATE',
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

          <div>
            <Label className="mb-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              rename
            </Label>
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

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                members
              </Label>
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

          {inventory.type === 'shared' && (
            <Button variant="destructive" className="w-full" onClick={handleDelete}>
              delete inventory
            </Button>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>

      {inviting && (
        <InviteMemberModal
          inventoryId={inventory.id}
          onClose={() => setInviting(false)}
          onInvited={() => { setInviting(false); load() }}
        />
      )}
    </>
  )
}
