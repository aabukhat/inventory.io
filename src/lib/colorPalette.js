// Fixed favorite-color palette (Epic 2, Story 2.3). Stored as a token, not
// raw hex, so shades can be retuned later without a data migration. Keep in
// sync with the CHECK constraint on profiles.favorite_color
// (20260724040000_favorite_color.sql).
export const COLOR_PALETTE = [
  { token: 'lime', hex: '#c8f55a' },
  { token: 'sky', hex: '#5ab4f5' },
  { token: 'amber', hex: '#f5b45a' },
  { token: 'violet', hex: '#b45af5' },
  { token: 'pink', hex: '#f55a9e' },
  { token: 'mint', hex: '#5af5c8' },
  { token: 'red', hex: '#f55a5a' },
  { token: 'yellow', hex: '#f5e05a' },
  { token: 'indigo', hex: '#7a5af5' },
  { token: 'green', hex: '#5af58a' },
]

const HEX_BY_TOKEN = Object.fromEntries(COLOR_PALETTE.map(c => [c.token, c.hex]))

export function hexForToken(token) {
  return HEX_BY_TOKEN[token]
}

// Deterministic stand-in for users who haven't picked a favorite color yet.
export function hexForId(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return COLOR_PALETTE[hash % COLOR_PALETTE.length].hex
}

export function avatarColor(profile) {
  return (profile?.favorite_color && hexForToken(profile.favorite_color)) || hexForId(profile?.id || '?')
}
