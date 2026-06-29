import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ItemModal, BulkModal } from './Modals'

const TYPE_COLORS = {
  beer:    { bg: 'rgba(200,245,90,0.12)',  color: '#c8f55a' },
  seltzer: { bg: 'rgba(90,180,245,0.12)', color: '#5ab4f5' },
  cider:   { bg: 'rgba(245,180,90,0.12)', color: '#f5b45a' },
  other:   { bg: 'rgba(180,180,180,0.1)', color: '#aaa' },
}

const s = {
  wrap: { maxWidth: '820px', margin: '0 auto', padding: '1.5rem 1rem 3rem' },
  topbar: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: '1.5rem', gap: '12px', flexWrap: 'wrap',
  },
  logo: {
    fontFamily: 'var(--font-mono)', fontSize: '12px',
    color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase',
  },
  userPill: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '12px', color: 'var(--text-muted)',
  },
  signOutBtn: {
    background: 'none', border: '1px solid var(--border)',
    borderRadius: '4px', padding: '3px 8px', fontSize: '11px',
    color: 'var(--text-dim)', cursor: 'pointer',
  },
  heading: { fontSize: '22px', fontWeight: 600, marginBottom: '0.25rem' },
  sub: { color: 'var(--text-muted)', fontSize: '13px', marginBottom: '1.5rem' },
  stats: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '10px', marginBottom: '1.5rem',
  },
  stat: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: '10px', padding: '12px 14px',
  },
  statLabel: { fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' },
  statVal: { fontSize: '22px', fontWeight: 600 },
  controls: {
    display: 'flex', gap: '8px', flexWrap: 'wrap',
    alignItems: 'center', marginBottom: '1rem',
  },
  searchInput: {
    flex: 1, minWidth: '160px',
    background: 'var(--surface)', border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: '13px', outline: 'none',
    color: 'var(--text)',
  },
  filterSelect: {
    background: 'var(--surface)', border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: '13px', outline: 'none',
    color: 'var(--text)',
  },
  btn: {
    background: 'var(--surface)', border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)', padding: '8px 14px',
    fontSize: '13px', color: 'var(--text)',
    display: 'flex', alignItems: 'center', gap: '6px',
    transition: 'border-color 0.1s',
  },
  primaryBtn: {
    background: 'var(--accent)', border: 'none',
    borderRadius: 'var(--radius)', padding: '8px 14px',
    fontSize: '13px', fontWeight: 600, color: '#0e0e0e',
    display: 'flex', alignItems: 'center', gap: '6px',
  },
  tableWrap: {
    border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '10px 14px', textAlign: 'left',
    fontSize: '11px', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
    textTransform: 'uppercase', color: 'var(--text-dim)',
    borderBottom: '1px solid var(--border)', background: 'var(--surface)',
  },
  td: { padding: '11px 14px', borderBottom: '1px solid var(--border)' },
  badge: (type) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
    fontSize: '11px', fontWeight: 500,
    background: TYPE_COLORS[type]?.bg || TYPE_COLORS.other.bg,
    color: TYPE_COLORS[type]?.color || TYPE_COLORS.other.color,
  }),
  qtyCtrl: { display: 'flex', alignItems: 'center', gap: '8px' },
  qtyBtn: {
    width: '26px', height: '26px', borderRadius: '50%',
    border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
    color: 'var(--text)', fontSize: '16px', display: 'flex',
    alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.1s',
  },
  qtyNum: { fontWeight: 600, minWidth: '22px', textAlign: 'center', fontFamily: 'var(--font-mono)' },
  logEntry: { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' },
  actionBtn: {
    background: 'none', border: '1px solid var(--border)',
    borderRadius: '6px', padding: '4px 8px', fontSize: '12px',
    color: 'var(--text-muted)', marginRight: '4px', transition: 'all 0.1s',
  },
  dangerBtn: {
    background: 'none', border: '1px solid var(--border)',
    borderRadius: '6px', padding: '4px 8px', fontSize: '12px',
    color: 'var(--danger)', transition: 'all 0.1s',
  },
  empty: {
    textAlign: 'center', padding: '3rem 1rem',
    color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '12px',
  },
  spinner: {
    textAlign: 'center', padding: '2rem',
    color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)',
  },
}

export default function Inventory({ user, onSignOut }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [modal, setModal] = useState(null) // null | 'add' | 'bulk' | {edit: item}
  const [fadingOut, setFadingOut] = useState(new Set())
  const [fadingIn, setFadingIn] = useState(new Set())
  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('drinks')
      .select('*')
      .order('name')
    if (!error) setItems(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // realtime sync
  useEffect(() => {
    const channel = supabase
      .channel('drinks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drinks' }, (payload) => {
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
    return () => supabase.removeChannel(channel)
  }, [])

  function displayName() {
    return user.email?.split('@')[0] ?? 'user'
  }

  async function addItem(fields) {
    await supabase.from('drinks').insert({
      ...fields,
      last_change: `${displayName()} added · ${now()}`,
    })
    setModal(null)
  }

  async function bulkAdd(rows) {
    const ts = now()
    await supabase.from('drinks').insert(
      rows.map(r => ({ ...r, last_change: `${displayName()} added · ${ts}` }))
    )
    setModal(null)
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

  const totalQty = items.reduce((a, i) => a + (i.quantity || 0), 0)
  const beerQty  = items.filter(i => i.type === 'beer').reduce((a, i) => a + (i.quantity || 0), 0)
  const seltzQty = items.filter(i => i.type === 'seltzer').reduce((a, i) => a + (i.quantity || 0), 0)

  return (
    <div style={s.wrap}>
      <div style={s.topbar}>
        <div style={s.logo}>🧺 inventory.io</div>
        <div style={s.userPill}>
          <span>{user.email}</span>
          <button style={s.signOutBtn} onClick={onSignOut}>sign out</button>
        </div>
      </div>

      <h1 style={s.heading}>drink inventory</h1>
      <p style={s.sub}>updates live</p>

      <div style={s.stats}>
        <div style={s.stat}><div style={s.statLabel}>items</div><div style={s.statVal}>{items.length}</div></div>
        <div style={s.stat}><div style={s.statLabel}>total units</div><div style={s.statVal}>{totalQty}</div></div>
        <div style={s.stat}><div style={s.statLabel}>beers</div><div style={s.statVal}>{beerQty}</div></div>
        <div style={s.stat}><div style={s.statLabel}>seltzers</div><div style={s.statVal}>{seltzQty}</div></div>
      </div>

      <div style={s.controls}>
        <input
          style={s.searchInput} value={search} placeholder="search…"
          onChange={e => setSearch(e.target.value)}
        />
        <select style={s.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">all types</option>
          <option value="beer">beer</option>
          <option value="seltzer">seltzer</option>
          <option value="cider">cider</option>
          <option value="other">other</option>
        </select>
        <button style={s.btn} onClick={exportCSV}>↓ export</button>
        <button style={s.btn} onClick={() => setModal('bulk')}>≡ bulk add</button>
        <button style={s.primaryBtn} onClick={() => setModal('add')}>+ add item</button>
      </div>

      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.spinner}>loading…</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {[['name', 'name / brand'], ['type', 'type'], ['quantity', 'quantity'], ['last_change', 'last change']].map(([col, label]) => (
                  <th
                    key={col}
                    style={{ ...s.th, cursor: 'pointer', userSelect: 'none', width: col === 'quantity' ? '130px' : undefined }}
                    onClick={() => handleSort(col)}
                  >
                    {label}{' '}
                    <span style={{ opacity: sortCol === col ? 1 : 0.25, fontFamily: 'var(--font-sans)', letterSpacing: 0 }}>
                      {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </th>
                ))}
                <th style={{ ...s.th, width: '80px' }}></th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr><td colSpan={5} style={s.empty}>
                  {items.length === 0 ? 'no items yet — add some above' : 'no matches'}
                </td></tr>
              ) : displayed.map((item, idx) => (
                <tr key={item.id} className={fadingOut.has(item.id) ? 'row-pop-out' : fadingIn.has(item.id) ? 'row-pop-in' : undefined} style={idx === displayed.length - 1 ? { } : {}}>
                  <td style={{ ...s.td, fontWeight: 500 }}>{item.name}</td>
                  <td style={s.td}><span style={s.badge(item.type)}>{item.type}</span></td>
                  <td style={s.td}>
                    <div style={s.qtyCtrl}>
                      <button style={s.qtyBtn} onClick={() => adjustQty(item, -1)} aria-label="decrease">−</button>
                      <div style={{ textAlign: 'center', minWidth: '32px' }}>
                        <div style={s.qtyNum}>{item.quantity}</div>
                        {item.unit && item.unit_size && (
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                            {item.unit_size} {item.unit}
                          </div>
                        )}
                      </div>
                      <button style={s.qtyBtn} onClick={() => adjustQty(item, 1)} aria-label="increase">+</button>
                    </div>
                  </td>
                  <td style={s.td}>
                    <span style={s.logEntry}>{item.last_change || '—'}</span>
                  </td>
                  <td style={s.td}>
                    <button style={s.actionBtn} onClick={() => setModal({ edit: item })}>edit</button>
                    <button style={s.dangerBtn} onClick={() => deleteItem(item.id)}>del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
    </div>
  )

  function now() {
    return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }
}
