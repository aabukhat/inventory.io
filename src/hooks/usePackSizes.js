import { useState, useEffect, useCallback } from 'react'
import { listPackSizes } from '../lib/packSizes'
import { useRealtimeTable } from './useRealtimeTable'

export function usePackSizes(inventoryId) {
  const [packSizes, setPackSizes] = useState({})

  const reload = useCallback(async () => {
    const rows = await listPackSizes(inventoryId)
    const map = {}
    for (const row of rows) map[row.type] = row.sizes
    setPackSizes(map)
  }, [inventoryId])

  useEffect(() => { reload() }, [reload])

  useRealtimeTable({
    channelName: `pack-sizes-changes-${inventoryId}`,
    table: 'pack_size_presets',
    filter: `inventory_id=eq.${inventoryId}`,
  }, reload)

  return { packSizes, reload }
}
