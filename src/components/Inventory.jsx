import { useState, useEffect, useCallback, Fragment } from 'react'
import { ChevronRightIcon, ChevronDownIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ItemModal, BulkModal } from './Modals'
import MembersModal from './MembersModal'
import PackSizesModal from './PackSizesModal'
import ProfileModal from './ProfileModal'
import Avatar from './Avatar'
import ThemeToggle from './ThemeToggle'
import Subsections from './Subsections'
import Wordmark from './Wordmark'
import { useSubsections } from '../hooks/useSubsections'
import { usePackSizes } from '../hooks/usePackSizes'
import { useFrequentDrinks } from '../hooks/useFrequentDrinks'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { moveDrinks, ITEM_DRAG_MIME } from '../lib/subsections'
import { recordDrinkAdd } from '../lib/drinkFrequency'
import { groupItems, dominantType, sumQuantity, latestChange, parseLastChange } from '../lib/variantGrouping'
import { TYPE_BADGE_CLASSES } from '../lib/badgeStyles'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  canAddItems, canIncreaseQty, canDecreaseQty, canEditDetails, canDeleteItems, canManageMembers,
  canManagePackSizes,
} from '../lib/permissions'

export default function Inventory({ user, profile, inventory, onSignOut, onInventoryChanged, onShowLanding, onProfileChanged }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [modal, setModal] = useState(null) // null | 'add' | 'bulk' | {edit: item}
  const [managingMembers, setManagingMembers] = useState(false)
  const [managingPackSizes, setManagingPackSizes] = useState(false)
  const [managingProfile, setManagingProfile] = useState(false)
  const [fadingOut, setFadingOut] = useState(new Set())
  const [fadingIn, setFadingIn] = useState(new Set())
  const [expandedGroups, setExpandedGroups] = useState(new Set())
  const [sortCol, setSortCol] = useState('drink_name')
  const [sortDir, setSortDir] = useState('asc')
  const [moveError, setMoveError] = useState('')

  const role = inventory.role
  const { sections, reload: reloadSections } = useSubsections(inventory.id)
  const { packSizes, reload: reloadPackSizes } = usePackSizes(inventory.id)
  const { frequentDrinks, reload: reloadFrequentDrinks } = useFrequentDrinks(inventory.id)
  const uncategorized = sections.find(sec => sec.is_uncategorized)
  const hasRealSections = sections.some(sec => !sec.is_uncategorized)

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function toggleGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('drinks')
      .select('*')
      .eq('inventory_id', inventory.id)
      .order('drink_name')
    if (!error) setItems(data || [])
    setLoading(false)
  }, [inventory.id])

  useEffect(() => { load() }, [load])

  const handleDrinkEvent = useCallback((payload) => {
    if (payload.eventType === 'INSERT') {
      const row = payload.new
      setItems(prev => [...prev, row].sort((a, b) => (a.drink_name || '').localeCompare(b.drink_name || '')))
      setFadingIn(prev => new Set(prev).add(row.id))
      setTimeout(() => setFadingIn(prev => { const n = new Set(prev); n.delete(row.id); return n }), 500)
    } else if (payload.eventType === 'UPDATE') {
      const row = payload.new
      setItems(prev => prev.map(item => item.id === row.id ? row : item))
    } else if (payload.eventType === 'DELETE') {
      const row = payload.old
      setItems(prev => prev.filter(item => item.id !== row.id))
    }
  }, [])

  useRealtimeTable({
    channelName: `drinks-changes-${inventory.id}`,
    table: 'drinks',
    filter: `inventory_id=eq.${inventory.id}`,
  }, handleDrinkEvent)

  function displayName() {
    return profile?.display_name || user.email?.split('@')[0] || 'user'
  }

  async function addItem(fields) {
    const { error } = await supabase.from('drinks').insert({
      ...fields,
      inventory_id: inventory.id,
      subsection_id: uncategorized?.id,
      last_change: `${displayName()} added · ${now()}`,
    })
    if (!error) {
      await recordDrinkAdd(inventory.id, fields)
      reloadFrequentDrinks()
    }
    setModal(null)
  }

  async function bulkAdd(rows) {
    const ts = now()
    await supabase.from('drinks').insert(
      rows.map(r => ({
        ...r, inventory_id: inventory.id, subsection_id: uncategorized?.id,
        last_change: `${displayName()} added · ${ts}`,
      }))
    )
    setModal(null)
  }

  async function moveItem(drinkIds, subsectionId) {
    setMoveError('')
    try {
      await moveDrinks(Array.isArray(drinkIds) ? drinkIds : [drinkIds], subsectionId)
    } catch (err) {
      setMoveError(err.message)
    }
  }

  async function updateItem(id, fields) {
    await supabase.from('drinks').update(fields).eq('id', id)
    setModal(null)
  }

  async function adjustQty(item, delta, { isVariant = false } = {}) {
    const newQty = Math.max(0, item.quantity + delta)
    if (newQty === item.quantity) return
    // A variant that's currently part of an expanded group persists at zero
    // as a re-stock placeholder instead of being deleted — its siblings keep
    // the group alive, so there's no "empty row" ambiguity the way there
    // would be for a lone item hitting zero.
    if (newQty === 0 && !isVariant) {
      setFadingOut(prev => new Set(prev).add(item.id))
      setTimeout(async () => {
        setItems(prev => prev.filter(i => i.id !== item.id))
        await supabase.from('drinks').delete().eq('id', item.id)
      }, 450)
      return
    }
    await supabase.from('drinks').update({
      quantity: newQty,
      last_change: `${displayName()} ${delta > 0 ? '+' : ''}${delta} · ${now()}`,
    }).eq('id', item.id)
  }

  async function deleteItem(id) {
    if (!confirm('remove this item?')) return
    await supabase.from('drinks').delete().eq('id', id)
  }

  function now() {
    return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  function exportCSV() {
    const rows = [['brand', 'drink_name', 'flavor', 'type', 'quantity', 'last change'],
      ...items.map(i => [i.brand || '', i.drink_name, i.flavor || '', i.type, i.quantity, i.last_change || ''])]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'drink-inventory.csv'
    a.click()
  }

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    const haystack = [i.brand, i.drink_name, i.flavor].filter(Boolean).join(' ').toLowerCase()
    return (!q || haystack.includes(q)) && (!filterType || i.type === filterType)
  })

  function brandDrinkName(item) {
    return [item.brand, item.drink_name].filter(Boolean).join(' ').toLowerCase()
  }

  const displayed = [...filtered].sort((a, b) => {
    let cmp
    if (sortCol === 'quantity') {
      cmp = (a.quantity ?? 0) - (b.quantity ?? 0)
    } else if (sortCol === 'last_change') {
      cmp = parseLastChange(a.last_change) - parseLastChange(b.last_change)
    } else if (sortCol === 'drink_name') {
      cmp = brandDrinkName(a).localeCompare(brandDrinkName(b))
    } else {
      cmp = (a[sortCol] ?? '').toString().toLowerCase().localeCompare((b[sortCol] ?? '').toString().toLowerCase())
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalQty  = items.reduce((a, i) => a + (i.quantity || 0), 0)
  const beerQty   = items.filter(i => i.type === 'beer').reduce((a, i) => a + (i.quantity || 0), 0)
  const seltzQty  = items.filter(i => i.type === 'seltzer').reduce((a, i) => a + (i.quantity || 0), 0)
  const liquorQty = items.filter(i => i.type === 'liquor').reduce((a, i) => a + (i.quantity || 0), 0)

  const canMoveItems = canAddItems(role)

  const itemCounts = {}
  for (const item of items) {
    itemCounts[item.subsection_id] = (itemCounts[item.subsection_id] || 0) + 1
  }

  function sortHeader(col, label, widthClass) {
    return (
      <TableHead
        className={cn('cursor-pointer border-b border-border bg-card select-none', widthClass)}
        onClick={() => handleSort(col)}
      >
        {label}{' '}
        <span className={cn('font-sans tracking-normal', sortCol === col ? 'opacity-100' : 'opacity-25')}>
          {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </TableHead>
    )
  }

  function itemLabel(item) {
    return [item.brand, item.drink_name, item.flavor].filter(Boolean).join(' ')
  }

  function renderItemRow(item, { nested = false } = {}) {
    return (
      <TableRow
        key={item.id}
        className={cn(
          fadingOut.has(item.id) ? 'row-pop-out' : fadingIn.has(item.id) ? 'row-pop-in' : undefined,
          nested && item.quantity === 0 && 'opacity-50'
        )}
        draggable={canMoveItems && hasRealSections}
        onDragStart={e => {
          e.dataTransfer.setData(ITEM_DRAG_MIME, JSON.stringify([item.id]))
          e.dataTransfer.effectAllowed = 'move'
        }}
      >
        <TableCell className={cn('font-medium whitespace-normal', nested && 'pl-8 font-normal text-muted-foreground')}>
          {nested ? (item.flavor || '(no flavor)') : itemLabel(item)}
        </TableCell>
        <TableCell>
          <Badge className={cn('rounded-md font-medium', TYPE_BADGE_CLASSES[item.type] || TYPE_BADGE_CLASSES.other)}>
            {item.type}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {canDecreaseQty(role) && (
              <button
                className="flex h-6.5 w-6.5 items-center justify-center rounded-full border border-input bg-secondary text-base transition-colors hover:border-border-strong"
                onClick={() => adjustQty(item, -1, { isVariant: nested })}
                aria-label="decrease"
              >
                −
              </button>
            )}
            <div className="min-w-8 text-center">
              <div className="font-mono font-semibold">{item.quantity}</div>
              {item.unit && item.unit_size && (
                <div className="mt-0.5 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
                  {item.unit_size} {item.unit}
                </div>
              )}
            </div>
            {canIncreaseQty(role) && (
              <button
                className="flex h-6.5 w-6.5 items-center justify-center rounded-full border border-input bg-secondary text-base transition-colors hover:border-border-strong"
                onClick={() => adjustQty(item, 1, { isVariant: nested })}
                aria-label="increase"
              >
                +
              </button>
            )}
          </div>
        </TableCell>
        <TableCell>
          <span className="font-mono text-[11px] text-muted-foreground">{item.last_change || '—'}</span>
        </TableCell>
        {hasRealSections && (
          <TableCell>
            {canMoveItems && (
              <Select value={item.subsection_id} onValueChange={(value) => moveItem([item.id], value)}>
                <SelectTrigger size="sm" className="h-auto py-1 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sections.map(sec => (
                    <SelectItem key={sec.id} value={sec.id}>{sec.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </TableCell>
        )}
        <TableCell>
          {canEditDetails(role) && (
            <Button variant="outline" size="sm" className="mr-1" onClick={() => setModal({ edit: item })}>
              edit
            </Button>
          )}
          {canDeleteItems(role) && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteItem(item.id)}>
              del
            </Button>
          )}
        </TableCell>
      </TableRow>
    )
  }

  function renderGroupRow(entry) {
    const variants = entry.items
    const expanded = expandedGroups.has(entry.key)
    const groupIds = variants.map(v => v.id)

    return (
      <Fragment key={entry.key}>
        <TableRow
          draggable={canMoveItems && hasRealSections}
          onDragStart={e => {
            e.dataTransfer.setData(ITEM_DRAG_MIME, JSON.stringify(groupIds))
            e.dataTransfer.effectAllowed = 'move'
          }}
        >
          <TableCell className="font-medium whitespace-normal">
            <button
              className="inline-flex items-center gap-1.5 text-left"
              onClick={() => toggleGroup(entry.key)}
              aria-label={expanded ? 'collapse' : 'expand'}
            >
              {expanded ? <ChevronDownIcon className="size-3.5 text-muted-foreground" /> : <ChevronRightIcon className="size-3.5 text-muted-foreground" />}
              {[variants[0].brand, variants[0].drink_name].filter(Boolean).join(' ')}
              <span className="font-mono text-[10px] text-muted-foreground">({variants.length})</span>
            </button>
          </TableCell>
          <TableCell>
            <Badge className={cn('rounded-md font-medium', TYPE_BADGE_CLASSES[dominantType(variants)] || TYPE_BADGE_CLASSES.other)}>
              {dominantType(variants)}
            </Badge>
          </TableCell>
          <TableCell>
            <div className="min-w-8 text-center font-mono font-semibold">{sumQuantity(variants)}</div>
          </TableCell>
          <TableCell>
            <span className="font-mono text-[11px] text-muted-foreground">{latestChange(variants) || '—'}</span>
          </TableCell>
          {hasRealSections && (
            <TableCell>
              {canMoveItems && (
                <Select value={variants[0].subsection_id} onValueChange={(value) => moveItem(groupIds, value)}>
                  <SelectTrigger size="sm" className="h-auto py-1 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map(sec => (
                      <SelectItem key={sec.id} value={sec.id}>{sec.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </TableCell>
          )}
          <TableCell />
        </TableRow>
        {expanded && variants.map(variant => renderItemRow(variant, { nested: true }))}
      </Fragment>
    )
  }

  function renderTable(sectionItems, emptyMessage) {
    return (
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {sortHeader('drink_name', 'name / brand')}
            {sortHeader('type', 'type')}
            {sortHeader('quantity', 'quantity', 'w-[130px]')}
            {sortHeader('last_change', 'last change')}
            {hasRealSections && (
              <TableHead className="w-[110px] border-b border-border bg-card">move to</TableHead>
            )}
            <TableHead className="w-[80px] border-b border-border bg-card" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sectionItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={hasRealSections ? 6 : 5} className="py-12 text-center font-mono text-xs text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : groupItems(sectionItems).map(entry =>
            entry.kind === 'single' ? renderItemRow(entry.item) : renderGroupRow(entry)
          )}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className="mx-auto max-w-[940px] px-4 pt-6 pb-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Wordmark onClick={onShowLanding} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setManagingProfile(true)}
            className="flex items-center gap-1.5 border-none bg-none p-0 text-xs text-muted-foreground hover:text-foreground"
            title={user.email}
          >
            <Avatar profile={profile} size={20} />
            <span className="underline decoration-dotted underline-offset-2">{displayName()}</span>
          </button>
          <ThemeToggle profile={profile} onChanged={onProfileChanged} />
          <Button variant="outline" size="sm" className="h-auto px-2 py-0.5 text-[11px]" onClick={onSignOut}>
            sign out
          </Button>
        </div>
      </div>

      <div className="mb-1 flex items-center gap-2.5">
        <h1 className="text-[22px] font-semibold">{inventory.name}</h1>
        {inventory.type === 'shared' && canManageMembers(role) && (
          <Button variant="outline" size="sm" onClick={() => setManagingMembers(true)}>manage</Button>
        )}
        {canManagePackSizes(role) && (
          <Button variant="outline" size="sm" onClick={() => setManagingPackSizes(true)}>pack sizes</Button>
        )}
      </div>
      <p className="mb-6 text-[13px] text-muted-foreground">updates live</p>

      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <div className="font-mono text-[11px] text-muted-foreground">items</div>
            <div className="text-[22px] font-semibold">{items.length}</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <div className="font-mono text-[11px] text-muted-foreground">total units</div>
            <div className="text-[22px] font-semibold">{totalQty}</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <div className="font-mono text-[11px] text-muted-foreground">beers</div>
            <div className="text-[22px] font-semibold">{beerQty}</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <div className="font-mono text-[11px] text-muted-foreground">seltzers</div>
            <div className="text-[22px] font-semibold">{seltzQty}</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <div className="font-mono text-[11px] text-muted-foreground">liquor</div>
            <div className="text-[22px] font-semibold">{liquorQty}</div>
          </CardContent>
        </Card>
      </div>

      <Subsections
        inventory={inventory}
        role={role}
        sections={sections}
        itemCounts={itemCounts}
        onReload={reloadSections}
        onMoveItem={moveItem}
      />

      {moveError && <p className="mb-4 text-[13px] text-destructive">{moveError}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          className="min-w-40 flex-1 bg-card text-[13px] md:text-[13px]"
          value={search}
          placeholder="search…"
          onChange={e => setSearch(e.target.value)}
        />
        <Select value={filterType || 'all'} onValueChange={(v) => setFilterType(v === 'all' ? '' : v)}>
          <SelectTrigger className="bg-card text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">all types</SelectItem>
            <SelectItem value="beer">beer</SelectItem>
            <SelectItem value="seltzer">seltzer</SelectItem>
            <SelectItem value="cider">cider</SelectItem>
            <SelectItem value="liquor">liquor</SelectItem>
            <SelectItem value="other">other</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCSV}>↓ export</Button>
        {canAddItems(role) && (
          <>
            <Button variant="outline" onClick={() => setModal('bulk')}>≡ bulk add</Button>
            <Button onClick={() => setModal('add')}>+ add item</Button>
          </>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border p-8 text-center font-mono text-xs text-muted-foreground">
          loading…
        </div>
      ) : !hasRealSections ? (
        <div className="overflow-hidden rounded-xl border border-border">
          {renderTable(displayed, items.length === 0 ? 'no items yet — add some above' : 'no matches')}
        </div>
      ) : (
        sections.map(sec => {
          const sectionItems = displayed.filter(item => item.subsection_id === sec.id)
          return (
            <div key={sec.id} className="mb-5">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-sm font-semibold">{sec.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{itemCounts[sec.id] || 0}</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border">
                {renderTable(sectionItems, 'no items in this section')}
              </div>
            </div>
          )
        })
      )}

      {modal === 'add' && (
        <ItemModal onSave={addItem} onClose={() => setModal(null)} packSizes={packSizes} frequentDrinks={frequentDrinks} />
      )}
      {modal === 'bulk' && (
        <BulkModal onSave={bulkAdd} onClose={() => setModal(null)} />
      )}
      {modal?.edit && (
        <ItemModal
          item={modal.edit}
          onSave={fields => updateItem(modal.edit.id, { ...fields, last_change: `${displayName()} edited · ${now()}` })}
          onClose={() => setModal(null)}
          packSizes={packSizes}
        />
      )}
      {managingMembers && (
        <MembersModal
          inventory={inventory}
          onClose={() => setManagingMembers(false)}
          onChanged={onInventoryChanged}
        />
      )}
      {managingPackSizes && (
        <PackSizesModal
          inventory={inventory}
          packSizes={packSizes}
          onReload={reloadPackSizes}
          onClose={() => setManagingPackSizes(false)}
        />
      )}
      {managingProfile && (
        <ProfileModal
          profile={profile}
          onClose={() => setManagingProfile(false)}
          onChanged={onProfileChanged}
        />
      )}
    </div>
  )
}
