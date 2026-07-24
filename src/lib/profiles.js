import { supabase } from './supabase'

export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, display_name_set')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data
}

function friendlyDisplayNameError(error) {
  const msg = error.message || ''
  if (msg.includes('INVALID_LENGTH')) return new Error('display name must be 2–30 characters.')
  if (msg.includes('INVALID_CONTENT')) return new Error('please choose a different display name.')
  return error
}

export async function setDisplayName(name) {
  const { error } = await supabase.rpc('set_display_name', { p_display_name: name })
  if (error) throw friendlyDisplayNameError(error)
}
