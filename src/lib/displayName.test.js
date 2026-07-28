import { describe, it, expect } from 'vitest'
import { validateDisplayName } from './displayName'

describe('validateDisplayName', () => {
  it('accepts a normal name', () => {
    expect(validateDisplayName('Alex')).toEqual({ name: 'Alex' })
  })

  it('trims and collapses internal whitespace', () => {
    expect(validateDisplayName('  Alex   Smith  ')).toEqual({ name: 'Alex Smith' })
  })

  it('rejects empty / whitespace-only input', () => {
    expect(validateDisplayName('')).toHaveProperty('error')
    expect(validateDisplayName('   ')).toHaveProperty('error')
    expect(validateDisplayName(null)).toHaveProperty('error')
    expect(validateDisplayName(undefined)).toHaveProperty('error')
  })

  it('rejects a name with no letters or numbers', () => {
    expect(validateDisplayName('!!! ---')).toHaveProperty('error')
  })

  it('accepts the minimum length (2) and rejects one below it', () => {
    expect(validateDisplayName('ab')).toEqual({ name: 'ab' })
    expect(validateDisplayName('a')).toHaveProperty('error')
  })

  it('accepts the maximum length (30) and rejects one above it', () => {
    const thirty = 'a'.repeat(30)
    const thirtyOne = 'a'.repeat(31)
    expect(validateDisplayName(thirty)).toEqual({ name: thirty })
    expect(validateDisplayName(thirtyOne)).toHaveProperty('error')
  })

  // Mirrors the same blocklist enforced server-side by set_display_name()
  // (supabase/migrations/20260724000000_display_name_onboarding.sql) — kept
  // in sync per this file's own header comment.
  it('rejects blocklisted profanity, case-insensitively', () => {
    expect(validateDisplayName('fuck')).toHaveProperty('error')
    expect(validateDisplayName('FUCK')).toHaveProperty('error')
    expect(validateDisplayName('BiTcH')).toHaveProperty('error')
  })

  it('never throws on null/undefined/empty string input', () => {
    expect(() => validateDisplayName(null)).not.toThrow()
    expect(() => validateDisplayName(undefined)).not.toThrow()
    expect(() => validateDisplayName('')).not.toThrow()
  })
})
