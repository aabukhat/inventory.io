import { useState, useEffect } from 'react'
import Avatar from './Avatar'
import { avatarColor } from '../lib/colorPalette'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const VISIBLE = 5
const RECENT_MS = 15 * 60 * 1000

// Epic 3 / Story 3.3: 'active' (live presence, ring in their favorite
// color) takes priority over 'recent' (viewed within the last 15 minutes
// but not currently present/focused, same color at reduced alpha); neither
// falls back to the plain background-colored separator ring from Story 3.2.
function presenceState(member, activeUserIds, now) {
  if (activeUserIds.has(member.user_id)) return 'active'
  if (member.last_viewed_at && now - new Date(member.last_viewed_at).getTime() < RECENT_MS) return 'recent'
  return null
}

function ringColorFor(member, state) {
  if (!state) return 'var(--background)'
  const color = avatarColor(member.profile)
  return state === 'active' ? color : `${color}66` // ~40% alpha for 'recent'
}

function statusLabel(member, state, now) {
  if (state === 'active') return 'active now'
  if (state === 'recent') {
    const mins = Math.max(1, Math.round((now - new Date(member.last_viewed_at).getTime()) / 60000))
    return `viewed ${mins}m ago`
  }
  return null
}

// Read-only "who has access" roster for a shared inventory's header. Role
// editing/removal stays exclusive to ManageInventoryModal (owner-only) —
// this is visible to every collaborator, purely informational.
//
// `members`/`loading` come from a single useMembers() call in Inventory.jsx,
// shared with ManageInventoryModal — each useRealtimeTable channel is named
// from the inventory id alone, so two independent hook instances mounted at
// once (this component plus the modal) would collide subscribing to the
// same channel name. `activeUserIds` similarly comes from a single
// usePresence() call in Inventory.jsx.
export default function CollaboratorAvatars({ inventory, members, loading, activeUserIds = new Set() }) {
  const [showAll, setShowAll] = useState(false)
  // last_viewed_at doesn't change on its own — this just re-evaluates the
  // 15-minute window against the clock so a member's ring fades on time
  // without needing new data.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Reserves this row's height (avatar size + bottom margin) unconditionally
  // — for a personal inventory, while a shared inventory's members are still
  // loading, and once they've loaded — so switching between inventories or
  // the members fetch resolving never shifts the stat cards/table below it.
  const ready = inventory.type === 'shared' && !(loading && members.length === 0) && members.length > 0

  const overflow = ready && members.length > VISIBLE
  const shown = overflow ? members.slice(0, VISIBLE - 1) : members
  const extra = members.length - shown.length

  return (
    <div className="mb-4 h-6">
      {ready && (
        <>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="flex -space-x-2 border-none bg-none p-0"
            aria-label="show collaborators"
          >
            {shown.map(m => (
              <Avatar
                key={m.user_id}
                profile={m.profile}
                size={24}
                ringColor={ringColorFor(m, presenceState(m, activeUserIds, now))}
              />
            ))}
            {overflow && (
              <div
                style={{ width: 24, height: 24, boxShadow: '0 0 0 2px var(--background)' }}
                className="flex shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[10px] text-muted-foreground"
              >
                +{extra}
              </div>
            )}
          </button>

          {showAll && (
            <Dialog open onOpenChange={(open) => !open && setShowAll(false)}>
              <DialogContent className="sm:max-w-[380px]">
                <DialogHeader>
                  <DialogTitle>who has access</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-1.5">
                  {members.map(m => {
                    const state = presenceState(m, activeUserIds, now)
                    return (
                      <div
                        key={m.user_id}
                        className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-2.5 py-2"
                      >
                        <Avatar profile={m.profile} size={22} ringColor={ringColorFor(m, state)} />
                        <span
                          className="flex-1 overflow-hidden text-[13px] text-ellipsis whitespace-nowrap"
                          title={m.profile?.email}
                        >
                          {m.profile?.display_name || m.profile?.email || m.user_id}
                        </span>
                        {statusLabel(m, state, now) && (
                          <span className="font-mono text-[10px] whitespace-nowrap text-muted-foreground">
                            {statusLabel(m, state, now)}
                          </span>
                        )}
                        <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                          {m.role}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </div>
  )
}
