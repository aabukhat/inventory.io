import { test, expect } from '@playwright/test'
import { loginAs, selectInventory } from './fixtures/auth.js'
import { createInventoryWithRoles } from './fixtures/testData.js'

// Only catchable end-to-end: proves the realtime publication + channel
// subscription + useRealtimeTable hook + re-render all actually work
// together, not just that each piece is individually correct.
test('a drink added by one member appears live for another member, with no reload', async ({ browser }) => {
  const inv = await createInventoryWithRoles(['editor'])

  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await loginAs(pageA, inv.members.owner)
  await selectInventory(pageA, inv.name)
  await loginAs(pageB, inv.members.editor)
  await selectInventory(pageB, inv.name)

  await pageA.getByRole('button', { name: '+ add item' }).click()
  await pageA.getByPlaceholder('e.g. White Claw Black Cherry').fill('Realtime Sync Test Drink')
  await pageA.getByRole('button', { name: 'save' }).click()
  await expect(pageA.getByRole('row', { name: /Realtime Sync Test Drink/ })).toBeVisible()

  await expect(pageB.getByRole('row', { name: /Realtime Sync Test Drink/ })).toBeVisible({ timeout: 10000 })

  await contextA.close()
  await contextB.close()
})
