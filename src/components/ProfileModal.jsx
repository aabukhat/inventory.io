import { useState } from 'react'
import { validateDisplayName } from '../lib/displayName'
import { setDisplayName } from '../lib/profiles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

export default function ProfileModal({ profile, onClose, onChanged }) {
  const [name, setName] = useState(profile.display_name || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (saving) return
    const { name: cleaned, error: validationError } = validateDisplayName(name)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')
    try {
      await setDisplayName(cleaned)
      await onChanged?.()
      onClose()
    } catch (err) {
      setError(err.message || 'something went wrong')
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle>profile</DialogTitle>
        </DialogHeader>

        <div>
          <Label className="mb-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            email
          </Label>
          <p className="text-[13px] text-muted-foreground">{profile.email}</p>
        </div>

        <div>
          <Label htmlFor="profile-display-name" className="mb-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            display name
          </Label>
          <Input
            id="profile-display-name"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus
            autoComplete="off"
            maxLength={30}
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'saving…' : 'save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
