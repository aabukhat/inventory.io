import { useState, useEffect, useCallback } from 'react'
import { listMembers, updateMemberRole, removeMember, renameInventory, deleteInventory } from '../lib/inventories'
import InviteMemberModal from './InviteMemberModal'

const ROLES = ['viewer', 'contributor', 'editor']

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
    width: '100%', maxWidth: '440px',
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
  field: { marginBottom: '1.25rem' },
  label: {
    display: 'block', fontSize: '11px',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px',
  },
  input: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)', padding: '9px 12px',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
    color: 'var(--text)',
  },
  rowBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  smallBtn: {
    background: 'none', border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)', padding: '5px 10px',
    fontSize: '12px', color: 'var(--text)',
  },
  muted: { fontSize: '12px', color: 'var(--text-muted)' },
  memberList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  error: { fontSize: '12px', color: 'var(--danger)', marginTop: '8px' },
  memberRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 10px', borderRadius: 'var(--radius)',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
  },
  memberEmail: { flex: 1, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  ownerTag: {
    fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  roleSelect: {
    background: 'var(--surface)', border: '1px solid var(--border-strong)',
    borderRadius: '6px', padding: '4px 6px', fontSize: '12px', color: 'var(--text)',
  },
  removeBtn: {
    background: 'none', border: '1px solid var(--border)',
    borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: 'var(--danger)',
  },
  dangerFullBtn: {
    width: '100%', padding: '9px 16px', borderRadius: 'var(--radius)',
    border: '1px solid var(--danger)', background: 'none',
    color: 'var(--danger)', fontSize: '13px', fontWeight: 600,
  },
}

export default function MembersModal({ inventory, onClose, onChanged }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [name, setName] = useState(inventory.name)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await listMembers(inventory.id)
    setMembers(data)
    setLoading(false)
  }, [inventory.id])

  useEffect(() => { load() }, [load])

  async function handleRoleChange(userId, role) {
    await updateMemberRole(inventory.id, userId, role)
    await load()
  }

  async function handleRemove(userId) {
    if (!confirm('remove this member from the inventory?')) return
    await removeMember(inventory.id, userId)
    await load()
  }

  async function handleRename() {
    if (!name.trim() || name.trim() === inventory.name) return
    setError('')
    try {
      await renameInventory(inventory.id, name.trim())
      onChanged?.()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete() {
    if (!confirm(`delete "${inventory.name}"? this removes it for everyone.`)) return
    setError('')
    try {
      await deleteInventory(inventory.id)
      onChanged?.()
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={s.modal}>
          <div style={s.header}>
            <span style={s.title}>manage "{inventory.name}"</span>
            <button style={s.closeBtn} onClick={onClose}>×</button>
          </div>

          <div style={s.field}>
            <label style={s.label}>rename</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                style={{ ...s.input, flex: 1 }}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRename()}
              />
              <button style={s.smallBtn} onClick={handleRename}>save</button>
            </div>
          </div>

          <div style={s.field}>
            <div style={s.rowBetween}>
              <label style={{ ...s.label, marginBottom: 0 }}>members</label>
              <button style={s.smallBtn} onClick={() => setInviting(true)}>+ invite</button>
            </div>
            {loading ? (
              <div style={s.muted}>loading…</div>
            ) : (
              <div style={s.memberList}>
                {members.map(m => (
                  <div key={m.user_id} style={s.memberRow}>
                    <span style={s.memberEmail}>{m.profile?.email || m.user_id}</span>
                    {m.role === 'owner' ? (
                      <span style={s.ownerTag}>owner</span>
                    ) : (
                      <>
                        <select
                          style={s.roleSelect}
                          value={m.role}
                          onChange={e => handleRoleChange(m.user_id, e.target.value)}
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button style={s.removeBtn} onClick={() => handleRemove(m.user_id)}>remove</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {inventory.type === 'shared' && (
            <div style={s.field}>
              <button style={s.dangerFullBtn} onClick={handleDelete}>delete inventory</button>
            </div>
          )}

          {error && <p style={s.error}>{error}</p>}
        </div>
      </div>

      {inviting && (
        <InviteMemberModal
          inventoryId={inventory.id}
          onClose={() => setInviting(false)}
          onInvited={() => { setInviting(false); load() }}
        />
      )}
    </>
  )
}
