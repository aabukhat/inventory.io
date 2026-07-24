import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

// The small uppercase mono caption used above almost every form field in
// the app. Shared so the style can't drift the way 12 hand-copied
// instances of the same className string already had.
export default function FieldLabel({ className, ...props }) {
  return (
    <Label
      className={cn('mb-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase', className)}
      {...props}
    />
  )
}
