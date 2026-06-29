import { useState, useEffect } from 'react'
import Login from './components/Login'
import Inventory from './components/Inventory'
import { supabase } from './lib/supabase'

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (!ready) return null

  return user
    ? <Inventory user={user} onSignOut={handleSignOut} />
    : <Login />
}
