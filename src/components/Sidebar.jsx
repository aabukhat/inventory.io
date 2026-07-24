import { useState } from 'react'
import { createSharedInventory } from '../lib/inventories'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase()
}

function Circle({ active, title, onClick, children }) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 cursor-pointer select-none items-center justify-center',
        'rounded-full border text-sm font-semibold transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-secondary text-muted-foreground hover:border-border-strong'
      )}
      onClick={onClick}
      title={title}
    >
      {children}
    </div>
  )
}

export default function Sidebar({ inventories, activeInventory, onSelectInventory, onInventoryCreated }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const personal = inventories.find(i => i.type === 'personal')
  const shared = inventories.filter(i => i.type === 'shared')
  const ownedShared = shared.filter(i => i.role === 'owner')
  const memberShared = shared.filter(i => i.role !== 'owner')

  function openCreate() {
    setError('')
    setName('')
    setCreating(true)
  }

  function closeCreate() {
    setCreating(false)
    setError('')
    setName('')
  }

  async function handleCreate() {
    if (saving) return
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const id = await createSharedInventory(name.trim())
      closeCreate()
      await onInventoryCreated?.(id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="box-border flex min-h-dvh w-16 shrink-0 flex-col items-center gap-2.5 border-r border-border py-6">
      {personal && (
        <Circle
          active={activeInventory?.id === personal.id}
          onClick={() => onSelectInventory(personal.id)}
          title={personal.name}
        >
          🏠
        </Circle>
      )}

      <div className="h-px w-8 shrink-0 bg-border-strong" />

      <div className="flex w-full flex-1 flex-col items-center gap-2.5 overflow-y-auto">
        {ownedShared.map(inv => (
          <Circle
            key={inv.id}
            active={activeInventory?.id === inv.id}
            onClick={() => onSelectInventory(inv.id)}
            title={`${inv.name} — owned by you`}
          >
            {initials(inv.name)}
          </Circle>
        ))}

        {ownedShared.length > 0 && memberShared.length > 0 && (
          <div className="my-0.5 h-px w-5 shrink-0 bg-border" />
        )}

        {memberShared.map(inv => (
          <div key={inv.id} className="relative shrink-0">
            <Circle
              active={activeInventory?.id === inv.id}
              onClick={() => onSelectInventory(inv.id)}
              title={`${inv.name} — shared with you (${inv.role})`}
            >
              {initials(inv.name)}
            </Circle>
            <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-[var(--text-dim)]" />
          </div>
        ))}

        <Button
          variant="outline"
          size="icon"
          className="shrink-0 rounded-full border-dashed text-muted-foreground"
          onClick={openCreate}
          title="new shared inventory"
        >
          +
        </Button>
      </div>

      <Dialog open={creating} onOpenChange={(open) => !open && closeCreate()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>new shared inventory</DialogTitle>
          </DialogHeader>

          <div>
            <label className="mb-1.5 block font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              name
            </label>
            <Input
              value={name}
              autoFocus
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. Household"
            />
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeCreate}>cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'creating…' : 'create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
