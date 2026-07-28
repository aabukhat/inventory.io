import { test, expect } from '@playwright/test'
import { loginAs, selectInventory } from './fixtures/auth.js'
import { createInventoryWithRoles } from './fixtures/testData.js'

// Isolated on purpose: Subsections.jsx uses native HTML5 drag-and-drop,
// the single flakiest thing to automate in Playwright (there's no real OS
// drag to simulate, only synthetic DragEvents). If this proves unreliable
// over time, it's fine to drop — reorder_subsections' actual ordering logic
// is already covered at the DB layer (tests/db/subsections.test.js); this
// spec only exists to additionally verify the browser wiring.
test('dragging a subsection card reorders the sections', async ({ page }) => {
  const inv = await createInventoryWithRoles([])
  await inv.members.owner.client.rpc('add_subsection', { p_inventory_id: inv.inventoryId, p_preset_key: null, p_name: 'Alpha' })
  await inv.members.owner.client.rpc('add_subsection', { p_inventory_id: inv.inventoryId, p_preset_key: null, p_name: 'Beta' })

  await loginAs(page, inv.members.owner)
  await selectInventory(page, inv.name)

  // Uncategorized only renders as its own card once a second (real)
  // subsection exists (Subsections.jsx's hasRealSections check) — so adding
  // Alpha/Beta makes 3 cards total, in position order: Uncategorized, Alpha, Beta.
  const cards = page.locator('div[draggable="true"]')
  await expect(cards).toHaveCount(3)
  await expect(cards.nth(0)).toContainText('Uncategorized')
  await expect(cards.nth(1)).toContainText('Alpha')
  await expect(cards.nth(2)).toContainText('Beta')

  const source = cards.nth(1) // Alpha
  const target = cards.nth(2) // Beta

  // DataTransfer only exists in the browser, so it has to be constructed
  // there (evaluateHandle) rather than in this Node-side test script, then
  // passed into dispatchEvent as a JSHandle.
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
  await source.dispatchEvent('dragstart', { dataTransfer })
  await target.dispatchEvent('dragover', { dataTransfer })
  await target.dispatchEvent('drop', { dataTransfer })
  await source.dispatchEvent('dragend', { dataTransfer })

  await expect(cards.nth(0)).toContainText('Uncategorized')
  await expect(cards.nth(1)).toContainText('Beta')
  await expect(cards.nth(2)).toContainText('Alpha')
})
