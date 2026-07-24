import { avatarPublicUrl } from '../lib/avatar'
import { cn } from '@/lib/utils'

// A fixed palette for the initials fallback, in the same family as the
// existing drink-type badge colors. Story 2.3 (favorite color) will let
// users pick from (a version of) this palette explicitly; until then the
// color is just a stable hash of the user's id.
const PALETTE = [
  '#c8f55a', '#5ab4f5', '#f5b45a', '#b45af5', '#f55a9e',
  '#5af5c8', '#f55a5a', '#f5e05a', '#7a5af5', '#5af58a',
]

function colorForId(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

function initials(name) {
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
      style={{ ...style, backgroundColor: colorForId(profile?.id || '?') }}
      className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold text-[#0e0e0e]', className)}
    >
      {initials(profile?.display_name)}
    </div>
  )
}
