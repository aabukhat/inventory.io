import { describe, it, expect, vi } from 'vitest'
import { validateAvatarFile, resizeToSquare } from './avatar'

describe('validateAvatarFile', () => {
  it('accepts allowed types under the size cap', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      const file = new File(['x'], 'photo', { type })
      expect(validateAvatarFile(file)).toEqual({ ok: true })
    }
  })

  it('rejects a disallowed type', () => {
    const file = new File(['x'], 'photo.gif', { type: 'image/gif' })
    expect(validateAvatarFile(file)).toHaveProperty('error')
  })

  it('rejects a file over 15MB', () => {
    const file = new File(['x'], 'huge.png', { type: 'image/png' })
    Object.defineProperty(file, 'size', { value: 15 * 1024 * 1024 + 1 })
    expect(validateAvatarFile(file)).toHaveProperty('error')
  })

  it('accepts a file exactly at the 15MB boundary', () => {
    const file = new File(['x'], 'boundary.png', { type: 'image/png' })
    Object.defineProperty(file, 'size', { value: 15 * 1024 * 1024 })
    expect(validateAvatarFile(file)).toEqual({ ok: true })
  })
})

describe('resizeToSquare', () => {
  it('runs the crop/resize control flow and resolves to a webp Blob', async () => {
    globalThis.__mockImageSize = { width: 400, height: 300 }
    const file = new File(['fake-image-bytes'], 'photo.png', { type: 'image/png' })
    const blob = await resizeToSquare(file)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/webp')
  })

  it('rejects when the image fails to load', async () => {
    // The mock Image stub (tests/setup/vitestSetupUnit.js) treats this
    // sentinel object URL as a decode failure.
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('ERROR_TRIGGER')
    try {
      const file = new File(['not-really-an-image'], 'broken.png', { type: 'image/png' })
      await expect(resizeToSquare(file)).rejects.toThrow('could not read image file')
    } finally {
      spy.mockRestore()
    }
  })
})
