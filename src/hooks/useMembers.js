import { useState, useEffect, useCallback } from 'react'
import { listMembers } from '../lib/inventories'
import { useRealtimeTable } from './useRealtimeTable'

// Personal inventories have no one to list, so callers on a personal
// inventory get an empty, non-loading result without ever hitting the network.
export function useMembers(inventory) {
  const isShared = inventory?.type === 'shared'
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!isShared) return
    setLoading(true)
    setMembers(await listMembers(inventory.id))
    setLoading(false)
  }, [inventory?.id, isShared])

  useEffect(() => {
    if (isShared) reload()
    else setLoading(false)
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
