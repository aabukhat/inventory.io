import { useState } from 'react'
import { createSharedInventory } from '../lib/inventories'

const s = {
  rail: {
    width: '64px', flexShrink: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '10px', padding: '1.5rem 0',
    borderRight: '1px solid var(--border)',
    minHeight: '100dvh', boxSizing: 'border-box',
  },
  circle: (active) => ({
    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '14px', fontWeight: 600, cursor: 'pointer', userSelect: 'none',
    background: active ? 'var(--accent)' : 'var(--surface-2)',
    color: active ? '#0e0e0e' : 'var(--text-muted)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
    transition: 'all 0.1s',
  }),
  divider: { width: '32px', height: '1px', background: 'var(--border-strong)', flexShrink: 0 },
  sharedList: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
    overflowY: 'auto', flex: 1, width: '100%',
  },
  addBtn: {
    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '18px', color: 'var(--text-dim)',
    background: 'none', border: '1px dashed var(--border-strong)',
  },
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
  field: { marginBottom: '1rem' },
  label: {
    display: 'block', fontSize: '11px', fontFamily: 'var(--font-mono)',
    letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'var(--text-muted)', marginBottom: '6px',
  },
  input: {
    width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box', color: 'var(--text)',
  },
  footer: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '1.25rem' },
  cancelBtn: {
    padding: '9px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)',
    background: 'none', color: 'var(--text-muted)', fontSize: '13px',
  },
  error: {
    fontSize: '12px', color: 'var(--danger)', marginTop: '8px',
  },
  saveBtn: {
    padding: '9px 20px', borderRadius: 'var(--radius)', border: 'none',
    background: 'var(--accent)', color: '#0e0e0e', fontSize: '13px', fontWeight: 600,
  },
}

function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase()
}

export default function Sidebar({ inventories, activeInventory, onSelectInventory, onInventoryCreated }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const personal = inventories.find(i => i.type === 'personal')
  const shared = inventories.filter(i => i.type === 'shared')

  function openCreate() {
    setError('')
    setName('')
    setCreating(true)
  }

  function closeCreate() {
    setCreating(false)
    setError('')
    setName('')
  }

  async function handleCreate() {
    if (saving) return
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const id = await createSharedInventory(name.trim())
      closeCreate()
      await onInventoryCreated?.(id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.rail}>
      {personal && (
        <div
          style={s.circle(activeInventory?.id === personal.id)}
          onClick={() => onSelectInventory(personal.id)}
          title={personal.name}
        >
          🏠
        </div>
      )}

      <div style={s.divider} />

      <div style={s.sharedList}>
        {shared.map(inv => (
          <div
            key={inv.id}
            style={s.circle(activeInventory?.id === inv.id)}
            onClick={() => onSelectInventory(inv.id)}
            title={inv.name}
          >
            {initials(inv.name)}
          </div>
        ))}

        <button style={s.addBtn} onClick={openCreate} title="new shared inventory">+</button>
      </div>

      {creating && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && closeCreate()}>
          <div style={s.modal}>
            <div style={s.header}>
              <span style={s.title}>new shared inventory</span>
              <button style={s.closeBtn} onClick={closeCreate}>×</button>
            </div>
            <div style={s.field}>
              <label style={s.label}>name</label>
              <input
                style={s.input}
                value={name}
                autoFocus
                onChange={e => { setName(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="e.g. Household"
              />
              {error && <p style={s.error}>{error}</p>}
            </div>
            <div style={s.footer}>
              <button style={s.cancelBtn} onClick={closeCreate}>cancel</button>
              <button style={s.saveBtn} onClick={handleCreate} disabled={saving}>{saving ? 'creating…' : 'create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
