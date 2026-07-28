import { describe, it, expect } from 'vitest'
import { TYPE_BADGE_CLASSES } from './badgeStyles'

describe('TYPE_BADGE_CLASSES', () => {
  it('has an entry for every drink type', () => {
    expect(Object.keys(TYPE_BADGE_CLASSES).sort()).toEqual(['beer', 'cider', 'liquor', 'other', 'seltzer'])
  })

  it('every entry routes through a CSS variable, never a hardcoded hex', () => {
    for (const classes of Object.values(TYPE_BADGE_CLASSES)) {
      expect(classes).toMatch(/var\(--badge-/)
      expect(classes).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    }
  })
})
