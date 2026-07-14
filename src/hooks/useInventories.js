import { useState, useEffect, useCallback } from 'react'
import { listMyInventories } from '../lib/inventories'

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

  useEffect(() => {
    if (activeInventoryId) localStorage.setItem(STORAGE_KEY, activeInventoryId)
  }, [activeInventoryId])

  const activeInventory = inventories.find(inv => inv.id === activeInventoryId) ?? null

  return { inventories, activeInventory, setActiveInventoryId, refresh, loading }
}
