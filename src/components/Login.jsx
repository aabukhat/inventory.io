import { useState } from 'react'
import { validatePin, setSession } from '../lib/supabase'

const s = {
  wrap: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  card: {
    width: '100%',
    maxWidth: '320px',
  },
  logo: {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    color: 'var(--accent)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '2.5rem',
  },
  heading: {
    fontSize: '22px',
    fontWeight: 600,
    marginBottom: '0.35rem',
    lineHeight: 1.2,
  },
  sub: {
    color: 'var(--text-muted)',
    fontSize: '13px',
    marginBottom: '2rem',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)',
    padding: '10px 14px',
    fontSize: '16px',
    letterSpacing: '0.2em',
    outline: 'none',
    marginBottom: '1rem',
    transition: 'border-color 0.15s',
  },
  btn: {
    width: '100%',
    background: 'var(--accent)',
    color: '#0e0e0e',
    border: 'none',
    borderRadius: 'var(--radius)',
    padding: '11px',
    fontWeight: 600,
    fontSize: '14px',
    transition: 'opacity 0.15s',
  },
  error: {
    marginTop: '12px',
    fontSize: '12px',
    color: 'var(--danger)',
    textAlign: 'center',
  },
}

export default function Login({ onLogin }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const user = validatePin(pin)
    if (!user) {
      setError('wrong pin — try again')
      setPin('')
      return
    }
    setSession(user)
    onLogin(user)
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logo}>🍺 cellar</div>
        <h1 style={s.heading}>enter your pin</h1>
        <p style={s.sub}>you and your roommate each have one</p>
        <form onSubmit={handleSubmit}>
          <label style={s.label} htmlFor="pin">pin</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={e => { setPin(e.target.value); setError('') }}
            style={s.input}
            autoFocus
            placeholder="••••"
          />
          <button type="submit" style={s.btn}>sign in</button>
          {error && <p style={s.error}>{error}</p>}
        </form>
      </div>
    </div>
  )
}
