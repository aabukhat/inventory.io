import { useState } from 'react'
import { addSubsection, reorderSubsections, deleteSubsection, ITEM_DRAG_MIME } from '../lib/subsections'
import { SUBSECTION_PRESETS } from '../lib/subsectionPresets'
import { canManageSubsections } from '../lib/permissions'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const MAX_NAME_LENGTH = 40

export default function Subsections({ inventory, role, sections, itemCounts, onReload, onMoveItem }) {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [dragId, setDragId] = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)
  const [customName, setCustomName] = useState('')

  const canManage = canManageSubsections(role)

  const availablePresets = SUBSECTION_PRESETS.filter(
    p => !sections.some(sec => sec.preset_key === p.key)
  )

  function closeAdd() {
    setAdding(false)
    setError('')
    setCustomName('')
  }

  async function handleAdd(preset) {
    setError('')
    try {
      await addSubsection(inventory.id, preset.key, preset.label)
      closeAdd()
      await onReload()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddCustom() {
    const trimmed = customName.trim()
    if (!trimmed) {
      setError('Name is required.')
      return
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      setError(`Name must be ${MAX_NAME_LENGTH} characters or fewer.`)
      return
    }
    const collision = sections.find(sec => sec.name.toLowerCase() === trimmed.toLowerCase())
    if (collision) {
      setError(`"${collision.name}" already exists — use the existing section instead.`)
      return
    }

    setError('')
    try {
      await addSubsection(inventory.id, null, trimmed)
      closeAdd()
      await onReload()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(sec) {
    const count = itemCounts[sec.id] || 0
    const warning = count > 0
      ? `delete "${sec.name}"? its ${count} item${count === 1 ? '' : 's'} will move to Uncategorized.`
      : `delete "${sec.name}"?`
    if (!confirm(warning)) return
    try {
      await deleteSubsection(sec.id)
      await onReload()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDrop(e, overSec) {
    e.preventDefault()
    setDropTargetId(null)

    const raw = e.dataTransfer.getData(ITEM_DRAG_MIME)
    if (raw) {
      let ids
      try { ids = JSON.parse(raw) } catch { ids = [raw] }
      await onMoveItem(ids, overSec.id)
      return
    }

    const draggedId = dragId
    setDragId(null)
    if (!draggedId || draggedId === overSec.id) return

    const current = [...sections]
    const fromIdx = current.findIndex(sec => sec.id === draggedId)
    const toIdx = current.findIndex(sec => sec.id === overSec.id)
    if (fromIdx === -1 || toIdx === -1) return

    const [moved] = current.splice(fromIdx, 1)
    current.splice(toIdx, 0, moved)

    try {
      await reorderSubsections(inventory.id, current.map(sec => sec.id))
      await onReload()
    } catch (err) {
      setError(err.message)
    }
  }

  const hasRealSections = sections.some(sec => !sec.is_uncategorized)
  const visibleSections = hasRealSections ? sections : []

  if (!hasRealSections && !canManage) return null

  return (
    <div className="mb-6">
      <label className="mb-2 block font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
        sections
      </label>
      <div className="flex flex-wrap items-stretch gap-2.5">
        {visibleSections.map(sec => (
          <div
            key={sec.id}
            className={cn(
              'relative min-w-[120px] cursor-grab rounded-xl border bg-card px-3.5 py-2.5 transition-colors',
              dropTargetId === sec.id ? 'border-primary' : 'border-border',
              dragId === sec.id ? 'opacity-40' : 'opacity-100'
            )}
            draggable={canManage}
            onDragStart={() => setDragId(sec.id)}
            onDragOver={e => { e.preventDefault(); setDropTargetId(sec.id) }}
            onDragLeave={() => setDropTargetId(current => current === sec.id ? null : current)}
            onDrop={e => handleDrop(e, sec)}
            onDragEnd={() => { setDragId(null); setDropTargetId(null) }}
          >
            {canManage && !sec.is_uncategorized && (
              <button
                className="absolute top-1 right-1 rounded p-0.5 px-1 text-[13px] leading-none text-muted-foreground"
                onClick={() => handleDelete(sec)}
                title="delete subsection"
              >
                ×
              </button>
            )}
            <div className="mb-0.5 text-[13px] font-semibold">{sec.name}</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {(itemCounts[sec.id] || 0) === 0 ? 'no items yet' : `${itemCounts[sec.id]} item${itemCounts[sec.id] === 1 ? '' : 's'}`}
            </div>
          </div>
        ))}

        {canManage && (
          <Button
            variant="outline"
            className="min-w-[120px] rounded-xl border-dashed text-muted-foreground"
            onClick={() => { setError(''); setAdding(true) }}
          >
            + add subsection
          </Button>
        )}
      </div>

      {error && !adding && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <Dialog open={adding} onOpenChange={(open) => !open && closeAdd()}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle>add subsection</DialogTitle>
          </DialogHeader>

          {availablePresets.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">all presets have been added.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {availablePresets.map(p => (
                <Button key={p.key} variant="secondary" className="justify-start" onClick={() => handleAdd(p)}>
                  {p.label}
                </Button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">or custom</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="flex gap-2">
            <Input
              value={customName}
              placeholder="e.g. Sours"
              maxLength={MAX_NAME_LENGTH}
              onChange={e => { setCustomName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
            />
            <Button variant="outline" onClick={handleAddCustom}>add</Button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
