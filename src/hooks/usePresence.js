import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { recordInventoryView } from '../lib/inventories'

const BLUR_DEBOUNCE_MS = 1500
const VIEW_HEARTBEAT_MS = 5 * 60 * 1000

function isFocused() {
  return document.hasFocus() && document.visibilityState === 'visible'
}

// Live "who's actively looking at this inventory right now" signal (Epic 3
// / Story 3.3), via a Supabase Realtime Presence channel — a different
// Realtime feature than the postgres_changes subscriptions every other hook
// uses, so this intentionally doesn't go through useRealtimeTable.js.
//
// Presence is keyed per *tab/connection* (`${user.id}:${sessionId}`), not
// per user — necessary because repeated track() calls on the same live
// connection (e.g. re-tracking on every focus/blur) can leave stale
// duplicate metas behind under that connection's own key instead of
// cleanly replacing the previous one (observed directly against this
// project's Supabase instance: a second track() call adds an extra meta
// with no presence_ref, and it never gets reconciled away, even after
// 30+ seconds — a realtime-js/service quirk, not a logic bug on our side).
// Keying per-connection sidesteps it entirely: since exactly one real
// connection ever owns a given key, taking that key's *last* meta is
// always correct regardless of how many stale duplicates pile up under
// it. "Active" for a user = at least one of their keys' last meta is
// focused — which also naturally handles the same person open in
// multiple tabs/devices (each gets its own key).
export function usePresence(inventory, user) {
  const isShared = inventory?.type === 'shared'
  const [activeUserIds, setActiveUserIds] = useState(() => new Set())
  const blurTimeoutRef = useRef(null)

  useEffect(() => {
    if (!isShared || !user?.id) return

    let cancelled = false
    let subscribed = false
    const presenceKey = `${user.id}:${crypto.randomUUID()}`

    const channel = supabase.channel(`presence-inventory-${inventory.id}`, {
      config: { presence: { key: presenceKey } },
    })

    function syncActiveUsers() {
      const state = channel.presenceState()
      const active = new Set()
      for (const [key, metas] of Object.entries(state)) {
        if (metas.length === 0) continue
        if (metas[metas.length - 1].focused) active.add(key.split(':')[0])
      }
      setActiveUserIds(active)
    }

    function trackFocus(focused) {
      if (subscribed) channel.track({ focused })
    }

    function handleFocusChange() {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
        blurTimeoutRef.current = null
      }
      if (isFocused()) {
        trackFocus(true)
      } else {
        // Debounce the loss of focus so a quick alt-tab doesn't flicker the
        // ring off and back on for other viewers.
        blurTimeoutRef.current = setTimeout(() => trackFocus(false), BLUR_DEBOUNCE_MS)
      }
    }

    channel
      .on('presence', { event: 'sync' }, syncActiveUsers)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || cancelled) return
        subscribed = true
        await channel.track({ focused: isFocused() })
        recordInventoryView(inventory.id, user.id)
      })

    window.addEventListener('focus', handleFocusChange)
    window.addEventListener('blur', handleFocusChange)
    document.addEventListener('visibilitychange', handleFocusChange)

    // "Recently viewed" (Story 3.3) is intentionally looser than the live
    // ring — keep refreshing last_viewed_at regardless of focus.
    const heartbeat = setInterval(() => recordInventoryView(inventory.id, user.id), VIEW_HEARTBEAT_MS)

    return () => {
      cancelled = true
      subscribed = false
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
      clearInterval(heartbeat)
      window.removeEventListener('focus', handleFocusChange)
      window.removeEventListener('blur', handleFocusChange)
      document.removeEventListener('visibilitychange', handleFocusChange)
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [isShared, inventory?.id, user?.id])

  return { activeUserIds }
}
