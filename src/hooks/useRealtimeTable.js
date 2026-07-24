import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Subscribes to Postgres changes on `table` (optionally scoped by a
// PostgREST-style `filter`, e.g. `inventory_id=eq.${id}`) and calls
// `onEvent` for every matching change. Centralizes the get-session ->
// setAuth -> channel -> cleanup boilerplate that every realtime consumer in
// this app needs — pass `enabled: false` to skip subscribing entirely
// (e.g. while a required id like the current user isn't known yet).
export function useRealtimeTable({ channelName, table, filter, event = '*', enabled = true }, onEvent) {
  useEffect(() => {
    if (!enabled) return
    let channel
    let cancelled = false

    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession()
      // Effect was cleaned up (deps changed, e.g. a fast inventory switch, or
      // React StrictMode's dev-only double-invoke) while getSession() was
      // still in flight — bail out instead of subscribing a channel nothing
      // will ever clean up, which would collide with the next effect run's
      // channel of the same name and throw on .on().
      if (cancelled) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event, schema: 'public', table, ...(filter ? { filter } : {}) }, onEvent)
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') console.error('[realtime] channel error', err)
          if (status === 'TIMED_OUT') console.warn('[realtime] timed out')
          if (status === 'CLOSED') console.warn('[realtime] closed')
        })
    }

    subscribe()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [channelName, table, filter, event, enabled, onEvent])
}
