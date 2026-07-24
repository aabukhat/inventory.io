import { useState, useEffect, useCallback } from 'react'
import { getMyProfile } from '../lib/profiles'
import { useRealtimeTable } from './useRealtimeTable'

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

  useRealtimeTable({
    channelName: `profile-changes-${user?.id}`,
    table: 'profiles',
    filter: `id=eq.${user?.id}`,
    enabled: !!user,
  }, refresh)

  return { profile, refresh, loading }
}
