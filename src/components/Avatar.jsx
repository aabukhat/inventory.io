import { avatarPublicUrl } from '../lib/avatar'
import { avatarColor } from '../lib/colorPalette'
import { cn } from '@/lib/utils'

export function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase()
}

export default function Avatar({ profile, size = 32, className }) {
  const url = avatarPublicUrl(profile?.avatar_url)
  const style = { width: size, height: size, fontSize: size * 0.42 }

  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={style}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    )
  }

  return (
    <div
      style={{ ...style, backgroundColor: avatarColor(profile) }}
      // Deliberately hardcoded, not a theme token: avatarColor() always
      // returns one of colorPalette.js's fixed bright hexes regardless of
      // app theme, so the initials need to stay dark-on-bright the same
      // way in both light and dark mode.
      className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold text-[#0e0e0e]', className)}
    >
      {initials(profile?.display_name)}
    </div>
  )
}
