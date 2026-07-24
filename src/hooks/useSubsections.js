import { useState, useEffect, useCallback } from 'react'
import { listSubsections } from '../lib/subsections'
import { useRealtimeTable } from './useRealtimeTable'

export function useSubsections(inventoryId) {
  const [sections, setSections] = useState([])

  const reload = useCallback(async () => {
    const data = await listSubsections(inventoryId)
    setSections(data)
  }, [inventoryId])

  useEffect(() => { reload() }, [reload])

  useRealtimeTable({
    channelName: `subsections-changes-${inventoryId}`,
    table: 'inventory_subsections',
    filter: `inventory_id=eq.${inventoryId}`,
  }, reload)

  return { sections, reload }
}
