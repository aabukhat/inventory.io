import { useState } from 'react'
import { TYPES } from './Modals'
import { savePackSizes, resetPackSizes, resolvePackSizes } from '../lib/packSizes'
import FormError from './FormError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

export default function PackSizesModal({ inventory, packSizes, onReload, onClose }) {
  const [drafts, setDrafts] = useState({})
  const [error, setError] = useState('')

  async function addSize(type) {
    const raw = (drafts[type] || '').trim()
    const n = Number(raw)
    if (!raw || !Number.isInteger(n) || n <= 0) {
      setError('enter a whole number greater than 0')
      return
    }
    setError('')
    const current = resolvePackSizes(packSizes, type)
    try {
      await savePackSizes(inventory.id, type, [...current, n])
      setDrafts(d => ({ ...d, [type]: '' }))
      await onReload()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeSize(type, n) {
    const current = resolvePackSizes(packSizes, type)
    try {
      await savePackSizes(inventory.id, type, current.filter(s => s !== n))
      await onReload()
    } catch (err) {
      setError(err.message)
    }
  }

  async function reset(type) {
    try {
      await resetPackSizes(inventory.id, type)
      await onReload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>pack sizes</DialogTitle>
        </DialogHeader>
        <p className="text-[13px] text-muted-foreground">
          quick-add buttons shown per drink type when adding an item
        </p>

        <div className="flex flex-col gap-4">
          {TYPES.map(type => {
            const sizes = resolvePackSizes(packSizes, type)
            const isCustom = Object.prototype.hasOwnProperty.call(packSizes, type)
            return (
              <div key={type}>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                    {type}
                  </label>
                  {isCustom && (
                    <button
                      className="font-mono text-[10px] text-muted-foreground underline"
                      onClick={() => reset(type)}
                    >
                      reset to default
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {sizes.length === 0 && (
                    <span className="text-[11px] text-muted-foreground">no pack buttons</span>
                  )}
                  {sizes.map(n => (
                    <span
                      key={n}
                      className="flex items-center gap-1 rounded-lg border border-input bg-secondary px-2 py-1 text-xs"
                    >
                      +{n}
                      <button
                        className="text-muted-foreground"
                        onClick={() => removeSize(type, n)}
                        aria-label={`remove ${n}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <Input
                    value={drafts[type] || ''}
                    onChange={e => { setDrafts(d => ({ ...d, [type]: e.target.value })); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && addSize(type)}
                    placeholder="e.g. 6"
                    className="h-7 w-16 px-2 text-xs"
                  />
                  <Button variant="outline" size="sm" onClick={() => addSize(type)}>add</Button>
                </div>
              </div>
            )
          })}
        </div>

        <FormError>{error}</FormError>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
