import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { listPackSizes } from '../lib/packSizes'

export function usePackSizes(inventoryId) {
  const [packSizes, setPackSizes] = useState({})

  const reload = useCallback(async () => {
    const rows = await listPackSizes(inventoryId)
    const map = {}
    for (const row of rows) map[row.type] = row.sizes
    setPackSizes(map)
  }, [inventoryId])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    let channel

    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel(`pack-sizes-changes-${inventoryId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'pack_size_presets',
          filter: `inventory_id=eq.${inventoryId}`,
        }, () => { reload() })
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') console.error('[realtime] channel error', err)
        })
    }

    subscribe()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [inventoryId, reload])

  return { packSizes, reload }
}
