// Drink-type badge colors, themed via CSS vars (src/index.css) rather than
// hardcoded hex, so they stay legible in both dark and light mode.
export const TYPE_BADGE_CLASSES = {
  beer: 'bg-[var(--badge-beer-bg)] text-[var(--badge-beer-fg)]',
  seltzer: 'bg-[var(--badge-seltzer-bg)] text-[var(--badge-seltzer-fg)]',
  cider: 'bg-[var(--badge-cider-bg)] text-[var(--badge-cider-fg)]',
  liquor: 'bg-[var(--badge-liquor-bg)] text-[var(--badge-liquor-fg)]',
  other: 'bg-[var(--badge-other-bg)] text-[var(--badge-other-fg)]',
}
