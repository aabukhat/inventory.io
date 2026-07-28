import { describe, it, expect } from 'vitest'
import {
  canAddItems,
  canIncreaseQty,
  canDecreaseQty,
  canEditDetails,
  canDeleteItems,
  canManageMembers,
  canManageSubsections,
  canManagePackSizes,
} from './permissions'

const ROLES = ['owner', 'editor', 'contributor', 'viewer']

// Transcribed directly from the permission matrix table in CLAUDE.md — this
// doubles as an executable spec of that table, so an edit to one should
// prompt an edit to the other.
const MATRIX = {
  'add items': { fn: canAddItems, allowed: ['owner', 'editor', 'contributor'] },
  'increase quantity': { fn: canIncreaseQty, allowed: ['owner', 'editor', 'contributor'] },
  'decrease quantity': { fn: canDecreaseQty, allowed: ['owner', 'editor'] },
  'edit item details': { fn: canEditDetails, allowed: ['owner', 'editor'] },
  'delete items': { fn: canDeleteItems, allowed: ['owner', 'editor'] },
  'manage subsections': { fn: canManageSubsections, allowed: ['owner', 'editor'] },
  'manage pack sizes': { fn: canManagePackSizes, allowed: ['owner', 'editor'] },
  'manage members / invite': { fn: canManageMembers, allowed: ['owner'] },
}

describe('permissions.js — full role x capability matrix', () => {
  for (const [capability, { fn, allowed }] of Object.entries(MATRIX)) {
    describe(capability, () => {
      for (const role of ROLES) {
        const expected = allowed.includes(role)
        it(`${role} -> ${expected}`, () => {
          expect(fn(role)).toBe(expected)
        })
      }
    })
  }

  it('returns false for an unrecognized role', () => {
    for (const { fn } of Object.values(MATRIX)) {
      expect(fn('not-a-real-role')).toBe(false)
    }
  })
})
