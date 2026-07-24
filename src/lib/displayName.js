const MIN_LENGTH = 2
const MAX_LENGTH = 30

const HAS_ALPHANUMERIC = /[\p{L}\p{N}]/u

// Best-effort blocklist for a beta-scale app — not a substitute for a real
// moderation service. Kept in sync with the server-side check in
// set_display_name() (20260724000000_display_name_onboarding.sql).
const PROFANITY = /(fuck|shit|bitch|asshole|cunt|nigger|nigga|faggot|retard|whore|slut)/i

// Returns { name } on success or { error } on failure — never throws, so
// callers can render the error directly.
export function validateDisplayName(raw) {
  const name = (raw ?? '').trim().replace(/\s+/g, ' ')

  if (!name) return { error: 'display name is required' }
  if (!HAS_ALPHANUMERIC.test(name)) return { error: 'display name needs at least one letter or number' }
  if (name.length < MIN_LENGTH || name.length > MAX_LENGTH) {
    return { error: `display name must be ${MIN_LENGTH}–${MAX_LENGTH} characters` }
  }
  if (PROFANITY.test(name)) return { error: 'please choose a different display name' }

  return { name }
}
