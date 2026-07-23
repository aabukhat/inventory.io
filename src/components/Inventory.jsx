import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ItemModal, BulkModal } from './Modals'
import MembersModal from './MembersModal'
import Subsections from './Subsections'
import { useSubsections } from '../hooks/useSubsections'
import { moveDrink, ITEM_DRAG_MIME } from '../lib/subsections'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  canAddItems, canIncreaseQty, canDecreaseQty, canEditDetails, canDeleteItems, canManageMembers,
} from '../lib/permissions'

const TYPE_BADGE_CLASSES = {
  beer:    'bg-[rgba(200,245,90,0.12)] text-[#c8f55a]',
  seltzer: 'bg-[rgba(90,180,245,0.12)] text-[#5ab4f5]',
  cider:   'bg-[rgba(245,180,90,0.12)] text-[#f5b45a]',
  liquor:  'bg-[rgba(180,90,245,0.12)] text-[#b45af5]',
  other:   'bg-[rgba(180,180,180,0.1)] text-[#aaa]',
}

export default function Inventory({ user, inventory, onSignOut, onInventoryChanged }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [modal, setModal] = useState(null) // null | 'add' | 'bulk' | {edit: item}
  const [managingMembers, setManagingMembers] = useState(false)
  const [fadingOut, setFadingOut] = useState(new Set())
  const [fadingIn, setFadingIn] = useState(new Set())
  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [moveError, setMoveError] = useState('')

  const role = inventory.role
  const { sections, reload: reloadSections } = useSubsections(inventory.id)
  const uncategorized = sections.find(sec => sec.is_uncategorized)
  const hasRealSections = sections.some(sec => !sec.is_uncategorized)

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('drinks')
      .select('*')
      .eq('inventory_id', inventory.id)
      .order('name')
    if (!error) setItems(data || [])
    setLoading(false)
  }, [inventory.id])

  useEffect(() => { load() }, [load])

  // realtime sync
  useEffect(() => {
    let channel

    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel(`drinks-changes-${inventory.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'drinks',
          filter: `inventory_id=eq.${inventory.id}`,
        }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new
            setItems(prev => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)))
            setFadingIn(prev => new Set(prev).add(row.id))
            setTimeout(() => setFadingIn(prev => { const n = new Set(prev); n.delete(row.id); return n }), 500)
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new
            setItems(prev => prev.map(item => item.id === row.id ? row : item))
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old
            setItems(prev => prev.filter(item => item.id !== row.id))
          }
        })
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') console.error('[realtime] channel error', err)
          if (status === 'TIMED_OUT') console.warn('[realtime] timed out')
          if (status === 'CLOSED') console.warn('[realtime] closed')
        })
    }

    subscribe()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [inventory.id])

  function displayName() {
    return user.email?.split('@')[0] ?? 'user'
  }

  async function addItem(fields) {
    await supabase.from('drinks').insert({
      ...fields,
      inventory_id: inventory.id,
      subsection_id: uncategorized?.id,
      last_change: `${displayName()} added · ${now()}`,
    })
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

  async function moveItem(drinkId, subsectionId) {
    setMoveError('')
    try {
      await moveDrink(drinkId, subsectionId)
    } catch (err) {
      setMoveError(err.message)
    }
  }

  async function updateItem(id, fields) {
    await supabase.from('drinks').update(fields).eq('id', id)
    setModal(null)
  }

  async function adjustQty(item, delta) {
    const newQty = Math.max(0, item.quantity + delta)
    if (newQty === item.quantity) return
    if (newQty === 0) {
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
    const rows = [['name', 'type', 'quantity', 'last change'],
      ...items.map(i => [i.name, i.type, i.quantity, i.last_change || ''])]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'drink-inventory.csv'
    a.click()
  }

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    return (!q || i.name.toLowerCase().includes(q)) && (!filterType || i.type === filterType)
  })

  function parseLastChange(str) {
    if (!str) return 0
    const after = str.split('·').pop()?.trim()
    if (!after) return 0
    const year = new Date().getFullYear()
    return new Date(after.replace(',', `, ${year}`)).getTime() || 0
  }

  const displayed = [...filtered].sort((a, b) => {
    let cmp
    if (sortCol === 'quantity') {
      cmp = (a.quantity ?? 0) - (b.quantity ?? 0)
    } else if (sortCol === 'last_change') {
      cmp = parseLastChange(a.last_change) - parseLastChange(b.last_change)
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

  function sortHeader(col, label, width) {
    return (
      <TableHead
        style={width ? { width } : undefined}
        className="cursor-pointer border-b border-border bg-card select-none"
        onClick={() => handleSort(col)}
      >
        {label}{' '}
        <span className={cn('font-sans tracking-normal', sortCol === col ? 'opacity-100' : 'opacity-25')}>
          {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </TableHead>
    )
  }

  function renderTable(sectionItems, emptyMessage) {
    return (
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {sortHeader('name', 'name / brand')}
            {sortHeader('type', 'type')}
            {sortHeader('quantity', 'quantity', '130px')}
            {sortHeader('last_change', 'last change')}
            {hasRealSections && (
              <TableHead style={{ width: '110px' }} className="border-b border-border bg-card">move to</TableHead>
            )}
            <TableHead style={{ width: '80px' }} className="border-b border-border bg-card" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sectionItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={hasRealSections ? 6 : 5} className="py-12 text-center font-mono text-xs text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : sectionItems.map(item => (
            <TableRow
              key={item.id}
              className={fadingOut.has(item.id) ? 'row-pop-out' : fadingIn.has(item.id) ? 'row-pop-in' : undefined}
              draggable={canMoveItems && hasRealSections}
              onDragStart={e => {
                e.dataTransfer.setData(ITEM_DRAG_MIME, item.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
            >
              <TableCell className="font-medium whitespace-normal">{item.name}</TableCell>
              <TableCell>
                <Badge className={cn('rounded-md font-medium', TYPE_BADGE_CLASSES[item.type] || TYPE_BADGE_CLASSES.other)}>
                  {item.type}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {canDecreaseQty(role) && (
                    <button
                      className="flex h-6.5 w-6.5 items-center justify-center rounded-full border border-input bg-secondary text-base transition-colors hover:border-[var(--border-strong)]"
                      onClick={() => adjustQty(item, -1)}
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
                      className="flex h-6.5 w-6.5 items-center justify-center rounded-full border border-input bg-secondary text-base transition-colors hover:border-[var(--border-strong)]"
                      onClick={() => adjustQty(item, 1)}
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
                    <Select value={item.subsection_id} onValueChange={(value) => moveItem(item.id, value)}>
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
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className="mx-auto max-w-[820px] px-4 pt-6 pb-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-xs tracking-wide text-primary uppercase">🧺 inventory.io</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{user.email}</span>
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
      </div>
      <p className="mb-6 text-[13px] text-muted-foreground">updates live</p>

      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
        <Card className="gap-1 rounded-[10px] px-3.5 py-3">
          <div className="font-mono text-[11px] text-muted-foreground">items</div>
          <div className="text-[22px] font-semibold">{items.length}</div>
        </Card>
        <Card className="gap-1 rounded-[10px] px-3.5 py-3">
          <div className="font-mono text-[11px] text-muted-foreground">total units</div>
          <div className="text-[22px] font-semibold">{totalQty}</div>
        </Card>
        <Card className="gap-1 rounded-[10px] px-3.5 py-3">
          <div className="font-mono text-[11px] text-muted-foreground">beers</div>
          <div className="text-[22px] font-semibold">{beerQty}</div>
        </Card>
        <Card className="gap-1 rounded-[10px] px-3.5 py-3">
          <div className="font-mono text-[11px] text-muted-foreground">seltzers</div>
          <div className="text-[22px] font-semibold">{seltzQty}</div>
        </Card>
        <Card className="gap-1 rounded-[10px] px-3.5 py-3">
          <div className="font-mono text-[11px] text-muted-foreground">liquor</div>
          <div className="text-[22px] font-semibold">{liquorQty}</div>
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
          className="min-w-40 flex-1 bg-card text-[13px]"
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
        <ItemModal onSave={addItem} onClose={() => setModal(null)} />
      )}
      {modal === 'bulk' && (
        <BulkModal onSave={bulkAdd} onClose={() => setModal(null)} />
      )}
      {modal?.edit && (
        <ItemModal
          item={modal.edit}
          onSave={fields => updateItem(modal.edit.id, { ...fields, last_change: `${displayName()} edited · ${now()}` })}
          onClose={() => setModal(null)}
        />
      )}
      {managingMembers && (
        <MembersModal
          inventory={inventory}
          onClose={() => setManagingMembers(false)}
          onChanged={onInventoryChanged}
        />
      )}
    </div>
  )
}
