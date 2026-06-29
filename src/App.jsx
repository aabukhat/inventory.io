import { useState, useEffect } from 'react'
import Login from './components/Login'
import Inventory from './components/Inventory'
import { getSession, clearSession } from './lib/supabase'

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (session) setUser(session)
    setReady(true)
  }, [])

  function handleLogin(user) { setUser(user) }

  function handleSignOut() {
    clearSession()
    setUser(null)
  }

  if (!ready) return null

  return user
    ? <Inventory user={user} onSignOut={handleSignOut} />
    : <Login onLogin={handleLogin} />
}
