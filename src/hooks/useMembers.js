import { useState, useEffect, useCallback } from 'react'
import { listMembers } from '../lib/inventories'
import { useRealtimeTable } from './useRealtimeTable'

// Personal inventories have no one to list, so callers on a personal
// inventory get an empty, non-loading result without ever hitting the network.
export function useMembers(inventory) {
  const isShared = inventory?.type === 'shared'
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  // `silent` skips the loading flicker for the periodic background refresh
  // below, which exists only to keep last_viewed_at fresh (Story 3.3), not
  // to signal a real data transition the way the initial load/realtime
  // reloads do.
  const reload = useCallback(async (silent = false) => {
    if (!isShared) return
    if (!silent) setLoading(true)
    setMembers(await listMembers(inventory.id))
    if (!silent) setLoading(false)
  }, [inventory?.id, isShared])

  useEffect(() => {
    if (isShared) reload()
    else setLoading(false)
  }, [isShared, reload])

  // Keeps "recently viewed" (Story 3.3) reasonably fresh across other
  // viewers' open tabs — inventory_views isn't realtime-subscribed (see its
  // migration), so this is the freshness mechanism for that column instead.
  useEffect(() => {
    if (!isShared) return
    const interval = setInterval(() => reload(true), 120_000)
    return () => clearInterval(interval)
  }, [isShared, reload])

  useRealtimeTable({
    channelName: `members-changes-${inventory?.id}`,
    table: 'inventory_members',
    filter: `inventory_id=eq.${inventory?.id}`,
    enabled: isShared,
  }, reload)

  // Other members' display names/avatars can change elsewhere while this is
  // mounted — keep the list live the same way ManageInventoryModal always has.
  useRealtimeTable({
    channelName: `members-profiles-changes-${inventory?.id}`,
    table: 'profiles',
    event: 'UPDATE',
    enabled: isShared,
  }, reload)

  return { members, loading, reload }
}
