import { describe, it, expect } from 'vitest'
import { SUBSECTION_PRESETS } from './subsectionPresets'

describe('SUBSECTION_PRESETS', () => {
  it('every preset has a unique key and a label', () => {
    const keys = SUBSECTION_PRESETS.map(p => p.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const preset of SUBSECTION_PRESETS) {
      expect(preset.label).toBeTruthy()
    }
  })
})
