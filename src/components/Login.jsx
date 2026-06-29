import { useState } from 'react'
import { supabase } from '../lib/supabase'

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
    fontSize: '15px',
    outline: 'none',
    marginBottom: '1rem',
    transition: 'border-color 0.15s',
    color: 'var(--text)',
    boxSizing: 'border-box',
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
    cursor: 'pointer',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'default',
  },
  feedback: {
    marginTop: '12px',
    fontSize: '12px',
    textAlign: 'center',
  },
  toggle: {
    marginTop: '1.5rem',
    fontSize: '12px',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  toggleLink: {
    color: 'var(--accent)',
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: '12px',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
}

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() {
    setError('')
    setMessage('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    reset()
    setLoading(true)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('check your email to confirm your account, then sign in')
    }

    setLoading(false)
  }

  function switchMode() {
    setMode(m => m === 'signin' ? 'signup' : 'signin')
    reset()
  }

  const isSignUp = mode === 'signup'

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logo}>🍺 cellar</div>
        <h1 style={s.heading}>{isSignUp ? 'create account' : 'sign in'}</h1>
        <p style={s.sub}>{isSignUp ? 'set up your cellar account' : 'welcome back'}</p>
        <form onSubmit={handleSubmit}>
          <label style={s.label} htmlFor="email">email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); reset() }}
            style={s.input}
            autoFocus
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
          <label style={s.label} htmlFor="password">password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); reset() }}
            style={s.input}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            placeholder="••••••••"
            required
          />
          <button
            type="submit"
            style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }}
            disabled={loading}
          >
            {loading ? '…' : isSignUp ? 'create account' : 'sign in'}
          </button>
          {error && <p style={{ ...s.feedback, color: 'var(--danger)' }}>{error}</p>}
          {message && <p style={{ ...s.feedback, color: 'var(--accent)' }}>{message}</p>}
        </form>
        <p style={s.toggle}>
          {isSignUp ? 'already have an account? ' : "don't have an account? "}
          <button style={s.toggleLink} onClick={switchMode}>
            {isSignUp ? 'sign in' : 'sign up'}
          </button>
        </p>
      </div>
    </div>
  )
}
