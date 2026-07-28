import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

// The one flow worth driving through the real signup UI (every other spec
// uses fixture-created, already-onboarded users for speed) — proves the
// Landing -> Login(signup) -> Onboarding -> Inventory chain works end to end
// against the real local Supabase stack (confirmations disabled locally, so
// the session is usable immediately after signup with no email step).
test('signup -> onboarding -> lands on the default personal inventory', async ({ page }) => {
  const email = `e2e-onboarding-${randomUUID()}@example.com`
  const password = 'correct horse battery staple 1'

  await page.goto('/')
  await page.getByRole('button', { name: 'sign up' }).click()
  await page.getByLabel('email').fill(email)
  await page.getByLabel('password').fill(password)
  await page.getByRole('button', { name: 'create account' }).click()

  await expect(page.getByLabel('display name')).toBeVisible()
  await page.getByLabel('display name').fill('Onboarding Test User')
  await page.getByRole('button', { name: 'continue' }).click()

  await expect(page.getByRole('button', { name: 'sign out' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'My Inventory' })).toBeVisible()
  // A brand-new inventory only has the Uncategorized subsection, which
  // renders flat (no visible section card) rather than as a lone card — see
  // Subsections.jsx's hasRealSections check — so assert on the empty item
  // table instead of a subsection label.
  await expect(page.getByText('no items yet — add some above')).toBeVisible()
})
