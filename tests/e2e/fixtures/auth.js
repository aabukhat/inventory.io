import { expect } from '@playwright/test'

// Drives the real Login form — used by every spec that needs a signed-in
// session, not just onboarding.spec.js, so login itself stays covered by
// every test run rather than only its own dedicated spec.
export async function loginAs(page, { email, password }) {
  await page.goto('/')
  await page.getByRole('button', { name: 'log in' }).click()
  await page.getByLabel('email').fill(email)
  await page.getByLabel('password').fill(password)
  await page.getByRole('button', { name: 'sign in' }).click()
  // "sign out" is always rendered once the Inventory view loads, regardless
  // of role; "display name" is the onboarding view for a user who hasn't
  // set one yet (fixture-created users pre-set theirs, so this only fires
  // for a genuinely fresh signup).
  await expect(
    page.getByRole('button', { name: 'sign out' }).or(page.getByLabel('display name'))
  ).toBeVisible()
}

// useInventories.js always defaults the active inventory to the user's
// personal one on a fresh session (src/hooks/useInventories.js) — a test
// that cares about a fixture-created *shared* inventory has to explicitly
// switch to it via its sidebar circle, identified by its name in the
// circle's title attribute (Sidebar.jsx).
export async function selectInventory(page, name) {
  await page.getByTitle(new RegExp(escapeRegExp(name))).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
