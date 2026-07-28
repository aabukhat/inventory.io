import { test, expect } from '@playwright/test'
import { loginAs, selectInventory } from './fixtures/auth.js'
import { createInventoryWithRoles } from './fixtures/testData.js'

test('add, edit, and delete a drink through the real modal', async ({ page }) => {
  const inv = await createInventoryWithRoles([])
  await loginAs(page, inv.members.owner)
  await selectInventory(page, inv.name)

  await page.getByRole('button', { name: '+ add item' }).click()
  await page.getByPlaceholder('e.g. White Claw Black Cherry').fill('E2E Test Lager')
  await page.getByRole('button', { name: 'save' }).click()

  const row = page.getByRole('row', { name: /E2E Test Lager/ })
  await expect(row).toBeVisible()
  await expect(row.getByText('1', { exact: true })).toBeVisible() // default quantity

  await row.getByRole('button', { name: 'increase' }).click()
  await expect(row.getByText('2', { exact: true })).toBeVisible()

  await row.getByRole('button', { name: 'edit' }).click()
  await page.getByPlaceholder('e.g. White Claw Black Cherry').fill('E2E Test Lager Renamed')
  await page.getByRole('button', { name: 'save' }).click()
  await expect(page.getByRole('row', { name: /E2E Test Lager Renamed/ })).toBeVisible()

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('row', { name: /E2E Test Lager Renamed/ }).getByRole('button', { name: 'del' }).click()
  await expect(page.getByRole('row', { name: /E2E Test Lager Renamed/ })).toHaveCount(0)
})
