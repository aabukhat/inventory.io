import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Copy .env.example to .env.local and fill in your credentials.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── PIN-based user session (stored in sessionStorage) ───────────────────────

const USERS = [
  { name: 'me', pin: import.meta.env.VITE_PIN_ME || '1234' },
  { name: 'roommate', pin: import.meta.env.VITE_PIN_ROOMMATE || '5678' },
]

export function validatePin(pin) {
  return USERS.find(u => u.pin === pin) || null
}

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem('drink_user') || 'null')
  } catch {
    return null
  }
}

export function setSession(user) {
  sessionStorage.setItem('drink_user', JSON.stringify(user))
}

export function clearSession() {
  sessionStorage.removeItem('drink_user')
}
