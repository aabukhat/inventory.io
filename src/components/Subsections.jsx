import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { listSubsections, addSubsection, reorderSubsections } from '../lib/subsections'
import { SUBSECTION_PRESETS } from '../lib/subsectionPresets'
import { canManageSubsections } from '../lib/permissions'

const s = {
  wrap: { marginBottom: '1.5rem' },
  label: {
    display: 'block', fontSize: '11px', fontFamily: 'var(--font-mono)',
    letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'var(--text-muted)', marginBottom: '8px',
  },
  list: {
    display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'stretch',
  },
  card: (dragging) => ({
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: '10px', padding: '10px 14px', minWidth: '120px',
    cursor: 'grab', opacity: dragging ? 0.4 : 1, transition: 'opacity 0.1s',
  }),
  cardName: { fontSize: '13px', fontWeight: 600, marginBottom: '2px' },
  cardEmpty: { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' },
  addBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: '120px', borderRadius: '10px', padding: '10px 14px',
    fontSize: '13px', color: 'var(--text-dim)',
    background: 'none', border: '1px dashed var(--border-strong)',
  },
  error: { fontSize: '12px', color: 'var(--danger)', marginTop: '8px' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem', zIndex: 100,
  },
  modal: {
    background: 'var(--surface)', border: '1px solid var(--border-strong)',
    borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '320px',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' },
  title: { fontSize: '16px', fontWeight: 600 },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    fontSize: '20px', lineHeight: 1, padding: '2px 6px', borderRadius: '4px',
  },
  muted: { fontSize: '13px', color: 'var(--text-muted)' },
  presetList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  presetBtn: {
    textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--radius)',
    border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
    color: 'var(--text)', fontSize: '14px',
  },
}

export default function Subsections({ inventory, role }) {
  const [sections, setSections] = useState([])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [dragId, setDragId] = useState(null)

  const canManage = canManageSubsections(role)

  const load = useCallback(async () => {
    const data = await listSubsections(inventory.id)
    setSections(data)
  }, [inventory.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let channel

    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel(`subsections-changes-${inventory.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'inventory_subsections',
          filter: `inventory_id=eq.${inventory.id}`,
        }, () => { load() })
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') console.error('[realtime] channel error', err)
        })
    }

    subscribe()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [inventory.id, load])

  const availablePresets = SUBSECTION_PRESETS.filter(
    p => !sections.some(sec => sec.preset_key === p.key)
  )

  async function handleAdd(preset) {
    setError('')
    try {
      await addSubsection(inventory.id, preset.key, preset.label)
      setAdding(false)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDrop(overId) {
    const draggedId = dragId
    setDragId(null)
    if (!draggedId || draggedId === overId) return

    const current = [...sections]
    const fromIdx = current.findIndex(sec => sec.id === draggedId)
    const toIdx = current.findIndex(sec => sec.id === overId)
    if (fromIdx === -1 || toIdx === -1) return

    const [moved] = current.splice(fromIdx, 1)
    current.splice(toIdx, 0, moved)
    setSections(current)

    try {
      await reorderSubsections(inventory.id, current.map(sec => sec.id))
    } catch (err) {
      setError(err.message)
      await load()
    }
  }

  if (sections.length === 0 && !canManage) return null

  return (
    <div style={s.wrap}>
      <label style={s.label}>sections</label>
      <div style={s.list}>
        {sections.map(sec => (
          <div
            key={sec.id}
            style={s.card(dragId === sec.id)}
            draggable={canManage}
            onDragStart={() => setDragId(sec.id)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(sec.id)}
            onDragEnd={() => setDragId(null)}
          >
            <div style={s.cardName}>{sec.name}</div>
            <div style={s.cardEmpty}>no items yet</div>
          </div>
        ))}

        {canManage && (
          <button style={s.addBtn} onClick={() => { setError(''); setAdding(true) }}>+ add subsection</button>
        )}
      </div>

      {error && <p style={s.error}>{error}</p>}

      {adding && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setAdding(false)}>
          <div style={s.modal}>
            <div style={s.header}>
              <span style={s.title}>add subsection</span>
              <button style={s.closeBtn} onClick={() => setAdding(false)}>×</button>
            </div>
            {availablePresets.length === 0 ? (
              <p style={s.muted}>all presets have been added.</p>
            ) : (
              <div style={s.presetList}>
                {availablePresets.map(p => (
                  <button key={p.key} style={s.presetBtn} onClick={() => handleAdd(p)}>{p.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
