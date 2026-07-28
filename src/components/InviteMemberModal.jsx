import { useState } from 'react'
import { inviteMember } from '../lib/inventories'
import FieldLabel from './FieldLabel'
import FormError from './FormError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

const ROLES = ['viewer', 'contributor', 'editor']

export default function InviteMemberModal({ inventoryId, onClose, onInvited }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!email.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      await inviteMember(inventoryId, email.trim(), role)
      onInvited?.()
    } catch (err) {
      setError(err.message || 'something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle>invite member</DialogTitle>
        </DialogHeader>

        <div>
          <FieldLabel>email</FieldLabel>
          <Input
            value={email}
            autoFocus
            type="email"
            autoComplete="off"
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="roommate@example.com"
          />
        </div>

        <div>
          <FieldLabel>role</FieldLabel>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <FormError>{error}</FormError>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>cancel</Button>
          <Button onClick={submit}>{saving ? 'inviting…' : 'invite'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
