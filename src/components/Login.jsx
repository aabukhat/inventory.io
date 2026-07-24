import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Wordmark from './Wordmark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Login({ initialMode = 'signin', onBack }) {
  const [mode, setMode] = useState(initialMode) // 'signin' | 'signup'
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
    <div className="flex min-h-dvh items-center justify-center p-8">
      <div className="w-full max-w-[320px]">
        <Wordmark onClick={onBack} className="mb-10" />
        <h1 className="mb-1.5 text-[22px] leading-tight font-semibold">
          {isSignUp ? 'create account' : 'sign in'}
        </h1>
        <p className="mb-8 text-[13px] text-muted-foreground">
          {isSignUp ? 'set up your inventory.io account' : 'welcome back'}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-1">
          <Label htmlFor="email" className="mb-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); reset() }}
            className="mb-4 h-auto py-2.5 text-[15px] md:text-[15px]"
            autoFocus
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
          <Label htmlFor="password" className="mb-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); reset() }}
            className="mb-4 h-auto py-2.5 text-[15px] md:text-[15px]"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            placeholder="••••••••"
            required
          />
          <Button type="submit" className="w-full py-2.5 text-sm" disabled={loading}>
            {loading ? '…' : isSignUp ? 'create account' : 'sign in'}
          </Button>
          {error && <p className="mt-3 text-center text-xs text-destructive">{error}</p>}
          {message && <p className="mt-3 text-center text-xs text-primary">{message}</p>}
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {isSignUp ? 'already have an account? ' : "don't have an account? "}
          <button className="cursor-pointer border-none bg-none p-0 text-xs text-primary underline" onClick={switchMode}>
            {isSignUp ? 'sign in' : 'sign up'}
          </button>
        </p>
      </div>
    </div>
  )
}
