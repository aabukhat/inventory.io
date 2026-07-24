import { useState, useCallback, useEffect } from 'react'
import { listFrequentDrinks, rankFrequentDrinks } from '../lib/drinkFrequency'

// No realtime subscription — this data only changes from the current
// user's own actions in their own session (RLS scopes rows to
// user_id = auth.uid(), so no other contributor can write rows that would
// need to be live-synced here).
export function useFrequentDrinks(inventoryId) {
  const [frequentDrinks, setFrequentDrinks] = useState([])

  const reload = useCallback(async () => {
    const rows = await listFrequentDrinks(inventoryId)
    setFrequentDrinks(rankFrequentDrinks(rows))
  }, [inventoryId])

  useEffect(() => { reload() }, [reload])

  return { frequentDrinks, reload }
}
