import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges class strings and drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('resolves conflicting Tailwind utilities to the last one', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
  })
})
