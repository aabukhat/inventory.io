import { useState, useEffect } from 'react'
import Landing from './components/Landing'
import Login from './components/Login'
import Onboarding from './components/Onboarding'
import Inventory from './components/Inventory'
import Sidebar from './components/Sidebar'
import { supabase } from './lib/supabase'
import { useInventories } from './hooks/useInventories'
import { useProfile } from './hooks/useProfile'

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [authView, setAuthView] = useState('landing') // 'landing' | 'signin' | 'signup'
  const [showLanding, setShowLanding] = useState(false)
  const {
    inventories, activeInventory, setActiveInventoryId, refresh, loading: inventoriesLoading,
  } = useInventories(user)
  const { profile, refresh: refreshProfile, loading: profileLoading } = useProfile(user)

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

  async function handleInventoryCreated(id) {
    await refresh()
    setActiveInventoryId(id)
  }

  if (!ready) return null
  if (!user) {
    if (authView === 'landing') return <Landing onSelectMode={setAuthView} />
    return <Login initialMode={authView} onBack={() => setAuthView('landing')} />
  }
  if (inventoriesLoading || !activeInventory || profileLoading || !profile) return null

  if (!profile.display_name_set) return <Onboarding onDone={refreshProfile} />

  if (showLanding) return <Landing authenticated onBack={() => setShowLanding(false)} />

  return (
    <div className="flex">
      <Sidebar
        inventories={inventories}
        activeInventory={activeInventory}
        onSelectInventory={setActiveInventoryId}
        onInventoryCreated={handleInventoryCreated}
      />
      <div className="flex-1 min-w-0">
        <Inventory
          user={user}
          profile={profile}
          inventory={activeInventory}
          onSignOut={handleSignOut}
          onInventoryChanged={refresh}
          onShowLanding={() => setShowLanding(true)}
          onProfileChanged={refreshProfile}
        />
      </div>
    </div>
  )
}
