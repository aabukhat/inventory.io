import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const PREVIEW_ITEMS = [
  { name: 'Sierra Nevada Pale Ale', type: 'beer', qty: 12 },
  { name: "Angry Orchard Crisp", type: 'cider', qty: 6 },
  { name: 'High Noon Watermelon', type: 'seltzer', qty: 8 },
]

const TYPE_BADGE_CLASSES = {
  beer:    'bg-[rgba(200,245,90,0.12)] text-[#c8f55a]',
  seltzer: 'bg-[rgba(90,180,245,0.12)] text-[#5ab4f5]',
  cider:   'bg-[rgba(245,180,90,0.12)] text-[#f5b45a]',
}

export default function Landing({ onSelectMode, authenticated = false, onBack }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-8">
      <div className="grid w-full max-w-[880px] items-center gap-14 md:grid-cols-2">
        <div>
          <div className="mb-10 font-mono text-[13px] tracking-wide text-primary uppercase">🍺 cellar</div>
          <h1 className="mb-3 text-[32px] leading-tight font-semibold text-balance">
            Know what's in the fridge before you buy more.
          </h1>
          <p className="mb-8 text-[15px] text-muted-foreground text-pretty">
            cellar is a shared drink inventory for your household — track what you have, restock the right amount, and never double-buy again.
          </p>
          <div className="flex gap-3">
            {authenticated ? (
              <Button className="px-5 py-2.5 text-sm" onClick={onBack}>
                back to my inventory
              </Button>
            ) : (
              <>
                <Button className="px-5 py-2.5 text-sm" onClick={() => onSelectMode('signup')}>
                  sign up
                </Button>
                <Button variant="secondary" className="px-5 py-2.5 text-sm" onClick={() => onSelectMode('signin')}>
                  log in
                </Button>
              </>
            )}
          </div>
        </div>

        <div
          className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          aria-hidden="true"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">home bar</span>
            <span className="font-mono text-[11px] text-muted-foreground">{PREVIEW_ITEMS.length} drinks</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {PREVIEW_ITEMS.map(item => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge className={TYPE_BADGE_CLASSES[item.type]}>{item.type}</Badge>
                  <span className="truncate text-[13px]">{item.name}</span>
                </div>
                <span className="font-mono text-[13px] text-muted-foreground">{item.qty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
