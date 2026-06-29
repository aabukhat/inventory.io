import { useState, useEffect } from 'react'

const TYPES = ['beer', 'seltzer', 'cider', 'other']

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem', zIndex: 100,
  },
  modal: {
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: '12px',
    padding: '1.5rem',
    width: '100%', maxWidth: '380px',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '1.25rem',
  },
  title: { fontSize: '16px', fontWeight: 600 },
  closeBtn: {
    background: 'none', border: 'none',
    color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1,
    padding: '2px 6px', borderRadius: '4px',
  },
  field: { marginBottom: '1rem' },
  label: {
    display: 'block', fontSize: '11px',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px',
  },
  input: {
    width: '100%', background: 'var(--surface-2)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)', padding: '9px 12px',
    fontSize: '14px', outline: 'none',
  },
  typeGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px',
  },
  typeBtn: (active) => ({
    padding: '7px 4px', borderRadius: 'var(--radius)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
    background: active ? 'rgba(200,245,90,0.12)' : 'var(--surface-2)',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    fontSize: '12px', fontWeight: active ? 600 : 400,
    textAlign: 'center', cursor: 'pointer', transition: 'all 0.1s',
  }),
  footer: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '1.25rem' },
  cancelBtn: {
    padding: '9px 16px', borderRadius: 'var(--radius)',
    border: '1px solid var(--border-strong)', background: 'none',
    color: 'var(--text-muted)', fontSize: '13px',
  },
  saveBtn: {
    padding: '9px 20px', borderRadius: 'var(--radius)',
    border: 'none', background: 'var(--accent)',
    color: '#0e0e0e', fontSize: '13px', fontWeight: 600,
  },
  bulkArea: {
    width: '100%', background: 'var(--surface-2)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)', padding: '9px 12px',
    fontSize: '12px', fontFamily: 'var(--font-mono)',
    outline: 'none', resize: 'vertical', minHeight: '120px',
    color: 'var(--text)',
  },
}

export function ItemModal({ item, onSave, onClose }) {
  const [name, setName] = useState(item?.name || '')
  const [type, setType] = useState(item?.type || 'beer')
  const [qty, setQty] = useState(item?.quantity ?? 1)

  function submit() {
    if (!name.trim()) return
    onSave({ name: name.trim(), type, quantity: Number(qty) })
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>{item ? 'edit item' : 'add item'}</span>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={s.field}>
          <label style={s.label}>name / brand</label>
          <input
            style={s.input} value={name} autoFocus
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Lagunitas IPA"
            onKeyDown={e => e.key === 'Enter' && submit()}
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>type</label>
          <div style={s.typeGrid}>
            {TYPES.map(t => (
              <button key={t} style={s.typeBtn(type === t)} onClick={() => setType(t)}>{t}</button>
            ))}
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>quantity</label>
          <input
            style={s.input} type="number" min="0"
            value={qty} onChange={e => setQty(e.target.value)}
          />
        </div>

        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={onClose}>cancel</button>
          <button style={s.saveBtn} onClick={submit}>save</button>
        </div>
      </div>
    </div>
  )
}

export function BulkModal({ onSave, onClose }) {
  const [text, setText] = useState('')

  function submit() {
    const rows = text.split('\n').map(l => l.trim()).filter(Boolean)
    const items = rows.map(row => {
      const parts = row.split(',').map(p => p.trim())
      const rawType = (parts[1] || 'beer').toLowerCase()
      return {
        name: parts[0] || 'unknown',
        type: TYPES.includes(rawType) ? rawType : 'other',
        quantity: parseInt(parts[2]) || 1,
      }
    })
    if (items.length) onSave(items)
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>bulk add</span>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={s.field}>
          <label style={s.label}>one item per line: name, type, quantity</label>
          <textarea
            style={s.bulkArea} value={text}
            onChange={e => setText(e.target.value)} autoFocus
            placeholder={"Lagunitas IPA, beer, 6\nWhite Claw Black Cherry, seltzer, 12\nAngry Orchard, cider, 4"}
          />
        </div>
        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={onClose}>cancel</button>
          <button style={s.saveBtn} onClick={submit}>add all</button>
        </div>
      </div>
    </div>
  )
}
