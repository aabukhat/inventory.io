import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getMyProfile } from '../lib/profiles'

export function useProfile(user) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    const data = await getMyProfile()
    setProfile(data)
    setLoading(false)
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!user) return
    let channel

    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel(`profile-changes-${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'profiles',
          filter: `id=eq.${user.id}`,
        }, () => { refresh() })
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') console.error('[realtime] channel error', err)
        })
    }

    subscribe()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [user, refresh])

  return { profile, refresh, loading }
}
