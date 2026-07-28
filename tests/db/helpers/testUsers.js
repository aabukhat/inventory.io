import { randomUUID } from 'node:crypto'
import { supabase } from '../../../src/lib/supabase.js'

// Confirmations are disabled on the local stack (supabase/config.toml), so
// the session returned by signUp is usable immediately — no confirmation
// step to work around.
export async function createTestUser() {
  const email = `test-${randomUUID()}@example.com`
  const password = 'correct horse battery staple 1'
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return { user: data.user, session: data.session, email }
}
