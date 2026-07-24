import { useState, useRef, useEffect } from 'react'
import { validateDisplayName } from '../lib/displayName'
import { setDisplayName, setFavoriteColor } from '../lib/profiles'
import { validateAvatarFile, uploadAvatar, removeAvatar } from '../lib/avatar'
import { COLOR_PALETTE } from '../lib/colorPalette'
import Avatar from './Avatar'
import ThemeToggle from './ThemeToggle'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

export default function ProfileModal({ profile, onClose, onChanged }) {
  const [name, setName] = useState(profile.display_name || '')
  const [color, setColor] = useState(profile.favorite_color || null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null)
  const [removeRequested, setRemoveRequested] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    return () => { if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl) }
  }, [avatarPreviewUrl])

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const { error: validationError } = validateAvatarFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    setAvatarFile(file)
    setAvatarPreviewUrl(URL.createObjectURL(file))
    setRemoveRequested(false)
    setError('')
  }

  function handleRemovePhoto() {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    setAvatarFile(null)
    setAvatarPreviewUrl(null)
    setRemoveRequested(true)
  }

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
      if (cleaned !== profile.display_name) await setDisplayName(cleaned)
      if (color && color !== profile.favorite_color) await setFavoriteColor(color)
      if (avatarFile) await uploadAvatar(avatarFile)
      else if (removeRequested) await removeAvatar()
      await onChanged?.()
      onClose()
    } catch (err) {
      setError(err.message || 'something went wrong')
      setSaving(false)
    }
  }

  const hasPhoto = avatarPreviewUrl || (!removeRequested && profile.avatar_url)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle>profile</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          {avatarPreviewUrl ? (
            <img src={avatarPreviewUrl} alt="" className="size-16 shrink-0 rounded-full object-cover" />
          ) : (
            <Avatar
              profile={{ ...profile, avatar_url: removeRequested ? null : profile.avatar_url, favorite_color: color }}
              size={64}
            />
          )}
          <div className="flex flex-col gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              change photo
            </Button>
            {hasPhoto && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={handleRemovePhoto}>
                remove photo
              </Button>
            )}
          </div>
        </div>

        <div>
          <Label className="mb-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            favorite color
          </Label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map(c => (
              <button
                key={c.token}
                type="button"
                onClick={() => setColor(c.token)}
                title={c.token}
                aria-label={c.token}
                aria-pressed={color === c.token}
                className={cn(
                  'size-6 shrink-0 cursor-pointer rounded-full ring-offset-2 ring-offset-card transition-shadow',
                  color === c.token ? 'ring-2 ring-foreground' : 'hover:ring-2 hover:ring-border'
                )}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            theme
          </Label>
          <div className="flex items-center gap-2">
            <ThemeToggle profile={profile} onChanged={onChanged} />
            <span className="text-[13px] text-muted-foreground">
              {profile.theme_preference === 'light' ? 'light mode' : 'dark mode'}
            </span>
          </div>
        </div>

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
