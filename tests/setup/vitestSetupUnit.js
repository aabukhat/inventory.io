// jsdom doesn't implement canvas rendering or object URLs. avatar.js's
// resizeToSquare() only needs these APIs to be *callable* — this suite checks
// control flow (crop math, error propagation), not real pixel output.
import { vi } from 'vitest'

if (!('createObjectURL' in URL)) {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
}
if (!('revokeObjectURL' in URL)) {
  URL.revokeObjectURL = vi.fn()
}

// Tests set this before calling resizeToSquare() to control the "loaded
// image" dimensions the crop math runs against.
globalThis.__mockImageSize = { width: 400, height: 300 }

class MockImage {
  set src(value) {
    queueMicrotask(() => {
      if (value === 'ERROR_TRIGGER') {
        this.onerror?.(new Error('mock image load error'))
      } else {
        Object.assign(this, globalThis.__mockImageSize)
        this.onload?.()
      }
    })
  }
}
globalThis.Image = MockImage

HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  drawImage: vi.fn(),
}))
HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type) {
  callback(new Blob(['mock'], { type }))
}
