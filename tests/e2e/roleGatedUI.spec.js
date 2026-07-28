import { test, expect } from '@playwright/test'
import { loginAs, selectInventory } from './fixtures/auth.js'
import { createInventoryWithRoles } from './fixtures/testData.js'

// A thin client/server-mirror sanity check, not a second permission matrix
// (tests/db/permissions-matrix.test.js already owns the full matrix) — just
// confirms permissions.js actually hides the controls it says it should for
// a real role in the real rendered UI.
test('a contributor sees add/increase controls but not delete or manage controls', async ({ page }) => {
  const inv = await createInventoryWithRoles(['contributor'])
  await inv.members.owner.client.from('drinks').insert({
    drink_name: 'Role-Gated UI Test Drink',
    inventory_id: inv.inventoryId,
    subsection_id: inv.uncategorized.id,
  })

  await loginAs(page, inv.members.contributor)
  await selectInventory(page, inv.name)

  await expect(page.getByRole('button', { name: '+ add item' })).toBeVisible()

  const row = page.getByRole('row', { name: /Role-Gated UI Test Drink/ })
  await expect(row).toBeVisible()
  await expect(row.getByRole('button', { name: 'increase' })).toBeVisible()
  await expect(row.getByRole('button', { name: 'decrease' })).toHaveCount(0)
  await expect(row.getByRole('button', { name: 'edit' })).toHaveCount(0)
  await expect(row.getByRole('button', { name: 'del' })).toHaveCount(0)

  await expect(page.getByRole('button', { name: 'manage' })).toHaveCount(0)
})
