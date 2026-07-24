import { cn } from '@/lib/utils'

// The "🧺 inventory.io" brand mark, shared so its size/style can't drift
// screen to screen the way five hand-copied instances did. Pass onClick to
// render it as a real button (e.g. "back to landing"); omit it for a
// static mark.
export default function Wordmark({ onClick, className }) {
  const classes = cn(
    'font-mono text-[13px] tracking-wide text-primary uppercase',
    onClick && 'cursor-pointer border-none bg-none p-0',
    className
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        🧺 inventory.io
      </button>
    )
  }

  return <div className={classes}>🧺 inventory.io</div>
}
