import { useState } from 'react'
import { inviteMember } from '../lib/inventories'

const ROLES = ['viewer', 'contributor', 'editor']

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem', zIndex: 200,
  },
  modal: {
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: '12px',
    padding: '1.5rem',
    width: '100%', maxWidth: '340px',
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
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
    color: 'var(--text)',
  },
  error: { fontSize: '12px', color: 'var(--danger)', marginBottom: '0.75rem' },
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
}

export default function InviteMemberModal({ inventoryId, onClose, onInvited }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!email.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      await inviteMember(inventoryId, email.trim(), role)
      onInvited?.()
    } catch (err) {
      setError(err.message || 'something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>invite member</span>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={s.field}>
          <label style={s.label}>email</label>
          <input
            style={s.input}
            value={email}
            autoFocus
            type="email"
            autoComplete="off"
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="roommate@example.com"
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>role</label>
          <select style={s.input} value={role} onChange={e => setRole(e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {error && <p style={s.error}>{error}</p>}

        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={onClose}>cancel</button>
          <button style={s.saveBtn} onClick={submit}>{saving ? 'inviting…' : 'invite'}</button>
        </div>
      </div>
    </div>
  )
}
