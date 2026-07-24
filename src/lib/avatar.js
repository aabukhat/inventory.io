import { supabase } from './supabase'

const BUCKET = 'avatars'
const OUTPUT_SIZE = 256
const MAX_RAW_BYTES = 15 * 1024 * 1024 // reject absurdly large uploads before we try to decode them
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function validateAvatarFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'please upload a JPEG, PNG, or WebP image' }
  }
  if (file.size > MAX_RAW_BYTES) {
    return { error: 'image is too large (max 15MB)' }
  }
  return { ok: true }
}

// Center-crops to a square and downsamples to a fixed size, so every avatar
// renders consistently regardless of the source image's aspect ratio.
export async function resizeToSquare(file, size = OUTPUT_SIZE) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    const side = Math.min(img.width, img.height)
    const sx = (img.width - side) / 2
    const sy = (img.height - side) / 2

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('failed to process image')),
        'image/webp',
        0.85
      )
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('could not read image file'))
    img.src = src
  })
}

export function avatarPublicUrl(path) {
  if (!path) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function uploadAvatar(file) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('not signed in')

  const blob = await resizeToSquare(file)
  const path = `${user.id}/avatar.webp`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/webp' })
  if (uploadError) throw uploadError

  const { error: rpcError } = await supabase.rpc('set_avatar_path', { p_path: path })
  if (rpcError) throw rpcError

  return avatarPublicUrl(path)
}

export async function removeAvatar() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('not signed in')

  await supabase.storage.from(BUCKET).remove([`${user.id}/avatar.webp`])
  const { error } = await supabase.rpc('set_avatar_path', { p_path: null })
  if (error) throw error
}
