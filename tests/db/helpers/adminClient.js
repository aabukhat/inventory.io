import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error('Missing local Supabase service-role env vars — run `npm run db:start` first.')
}

// service_role client — bypasses RLS. Only for best-effort test cleanup and
// for assertions that need to inspect another actor's data (e.g. audit_log
// rows written by a different user than the one under test). Never use this
// to perform the action under test itself, or RLS/triggers won't actually be
// exercised.
export const adminClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export async function deleteTestUser(userId) {
  try {
    await adminClient.auth.admin.deleteUser(userId)
  } catch {
    // local-dev convenience only — never fail a test run over cleanup
  }
}
