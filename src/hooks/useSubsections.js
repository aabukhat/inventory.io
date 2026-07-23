import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { listSubsections } from '../lib/subsections'

export function useSubsections(inventoryId) {
  const [sections, setSections] = useState([])

  const reload = useCallback(async () => {
    const data = await listSubsections(inventoryId)
    setSections(data)
  }, [inventoryId])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    let channel

    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel(`subsections-changes-${inventoryId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'inventory_subsections',
          filter: `inventory_id=eq.${inventoryId}`,
        }, () => { reload() })
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') console.error('[realtime] channel error', err)
        })
    }

    subscribe()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [inventoryId, reload])

  return { sections, reload }
}
