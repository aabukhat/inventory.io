import { useState, useEffect, useCallback } from 'react'
import { listMyInventories } from '../lib/inventories'
import { useRealtimeTable } from './useRealtimeTable'

const STORAGE_KEY = 'inventory.io:activeInventoryId'

export function useInventories(user) {
  const [inventories, setInventories] = useState([])
  const [activeInventoryId, setActiveInventoryId] = useState(() => localStorage.getItem(STORAGE_KEY))
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    const list = await listMyInventories()
    setInventories(list)
    setLoading(false)

    setActiveInventoryId(current => {
      if (current && list.some(inv => inv.id === current)) return current
      const personal = list.find(inv => inv.type === 'personal')
      return personal?.id ?? list[0]?.id ?? null
    })
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  // Live-refresh when the user's own membership changes elsewhere (e.g. an
  // owner revokes their access, or invites them to a new inventory) so the
  // sidebar updates without requiring a logout/login or page reload.
  useRealtimeTable({
    channelName: `membership-changes-${user?.id}`,
    table: 'inventory_members',
    filter: `user_id=eq.${user?.id}`,
    enabled: !!user,
  }, refresh)

  useEffect(() => {
    if (activeInventoryId) localStorage.setItem(STORAGE_KEY, activeInventoryId)
  }, [activeInventoryId])

  const activeInventory = inventories.find(inv => inv.id === activeInventoryId) ?? null

  return { inventories, activeInventory, setActiveInventoryId, refresh, loading }
}
