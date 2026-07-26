import { useState } from 'react'
import Avatar from './Avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

const VISIBLE = 5

// Read-only "who has access" roster for a shared inventory's header. Role
// editing/removal stays exclusive to ManageInventoryModal (owner-only) —
// this is visible to every collaborator, purely informational.
//
// `members`/`loading` come from a single useMembers() call in Inventory.jsx,
// shared with ManageInventoryModal — each useRealtimeTable channel is named
// from the inventory id alone, so two independent hook instances mounted at
// once (this component plus the modal) would collide subscribing to the
// same channel name.
export default function CollaboratorAvatars({ inventory, members, loading }) {
  const [showAll, setShowAll] = useState(false)

  if (inventory.type !== 'shared' || (loading && members.length === 0)) return null
  if (members.length === 0) return null

  const overflow = members.length > VISIBLE
  const shown = overflow ? members.slice(0, VISIBLE - 1) : members
  const extra = members.length - shown.length

  return (
    <>
      <button
        type="button"
        onClick={() => setShowAll(true)}
        className="mb-4 flex -space-x-2 border-none bg-none p-0"
        aria-label="show collaborators"
      >
        {shown.map(m => (
          <Avatar key={m.user_id} profile={m.profile} size={24} className="ring-2 ring-background" />
        ))}
        {overflow && (
          <div
            style={{ width: 24, height: 24 }}
            className="flex shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[10px] text-muted-foreground ring-2 ring-background"
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
              {members.map(m => (
                <div
                  key={m.user_id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-2.5 py-2"
                >
                  <Avatar profile={m.profile} size={22} />
                  <span
                    className="flex-1 overflow-hidden text-[13px] text-ellipsis whitespace-nowrap"
                    title={m.profile?.email}
                  >
                    {m.profile?.display_name || m.profile?.email || m.user_id}
                  </span>
                  <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
