import Avatar from './Avatar'
import { formatLastChange } from '../lib/variantGrouping'

// Shared by the single-item row and the group-header row in Inventory.jsx —
// both need to render the same actor-snapshot + text for a drink's most
// recent change.
export default function LastChangeCell({ item }) {
  if (!item?.last_change_at) {
    return <span className="font-mono text-[11px] text-muted-foreground">—</span>
  }
  return (
    <div className="flex items-center gap-1.5">
      <Avatar
        profile={{
          id: item.last_change_actor_user_id,
          display_name: item.last_change_actor_display_name,
          avatar_url: item.last_change_actor_avatar_url,
        }}
        size={16}
      />
      <span className="font-mono text-[11px] text-muted-foreground">{formatLastChange(item)}</span>
    </div>
  )
}
