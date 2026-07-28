import { cn } from '@/lib/utils'

// Inline form-validation error message, shared so its style can't drift
// the way 6+ hand-copied `<p className="text-xs text-destructive">`
// instances already had. Renders nothing for a falsy/empty message, so
// callers can drop the `{error && ...}` guard they'd otherwise repeat.
export default function FormError({ children, className }) {
  if (!children) return null
  return <p className={cn('text-xs text-destructive', className)}>{children}</p>
}
