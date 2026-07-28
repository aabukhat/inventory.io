import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// This file, not tests/db/helpers/*.js, is what E2E specs use to set up
// background fixture data (a user isn't the thing under test just because a
// fixture needed to exist) — those helpers import src/lib/supabase.js, which
// reads import.meta.env, populated by Vite's own transform. Playwright test
// files run in plain Node, not through Vite, so they need a client built
// from process.env directly (loaded into process.env by playwright.config.js
// from .env.test.local). Fixture setup calls the RPCs directly rather than
// going through src/lib/*.js — the whole point of E2E here is exercising the
// real browser UI, which already exercises those lib functions organically;
// the setup calls creating *other* users' background state don't need to.
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing local Supabase env vars for E2E fixtures — run `npm run db:start` first.')
}

export const TEST_PASSWORD = 'correct horse battery staple 1'

// displayName defaults to set — fixture-created "background" users (an
// inventory's other members, not the account under direct test) should
// already be past onboarding when a spec logs in as them. Pass
// displayName: null for a spec that wants to drive the real onboarding flow
// itself (see onboarding.spec.js).
export async function createTestUser({ displayName = 'Fixture User' } = {}) {
  const client = createClient(supabaseUrl, supabaseAnonKey)
  const email = `e2e-${randomUUID()}@example.com`
  const { data, error } = await client.auth.signUp({ email, password: TEST_PASSWORD })
  if (error) throw error
  if (displayName) {
    const { error: nameError } = await client.rpc('set_display_name', { p_display_name: displayName })
    if (nameError) throw nameError
  }
  return { client, user: data.user, session: data.session, email, password: TEST_PASSWORD }
}

export async function createInventoryWithRoles(roles = []) {
  const owner = await createTestUser({ displayName: 'Fixture Owner' })
  const name = `E2E Inventory ${Date.now()}`
  const { data: inventoryId, error } = await owner.client.rpc('create_shared_inventory', { p_name: name })
  if (error) throw error

  const members = { owner }
  for (const role of roles) {
    const member = await createTestUser({ displayName: `Fixture ${role}` })
    const { error: inviteError } = await owner.client.rpc('invite_member', {
      p_inventory_id: inventoryId,
      p_email: member.email,
      p_role: role,
    })
    if (inviteError) throw inviteError
    members[role] = member
  }

  const { data: subsections } = await owner.client
    .from('inventory_subsections')
    .select('*')
    .eq('inventory_id', inventoryId)
  const uncategorized = subsections.find(s => s.is_uncategorized)

  return { inventoryId, name, members, uncategorized }
}
