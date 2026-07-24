import { useState } from 'react'
import { validateDisplayName } from '../lib/displayName'
import { setDisplayName } from '../lib/profiles'
import Wordmark from './Wordmark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Onboarding({ onDone }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
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
      await onDone()
    } catch (err) {
      setError(err.message || 'something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-8">
      <div className="w-full max-w-[320px]">
        <Wordmark className="mb-10" />
        <h1 className="mb-1.5 text-[22px] leading-tight font-semibold">welcome</h1>
        <p className="mb-8 text-[13px] text-muted-foreground">
          what should other members see you as?
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-1">
          <Label htmlFor="display-name" className="mb-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            display name
          </Label>
          <Input
            id="display-name"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            className="mb-4 h-auto py-2.5 text-[15px]"
            autoFocus
            autoComplete="off"
            placeholder="e.g. Alex"
            maxLength={30}
            required
          />
          <Button type="submit" className="w-full py-2.5 text-sm" disabled={saving}>
            {saving ? '…' : 'continue'}
          </Button>
          {error && <p className="mt-3 text-center text-xs text-destructive">{error}</p>}
        </form>
      </div>
    </div>
  )
}
