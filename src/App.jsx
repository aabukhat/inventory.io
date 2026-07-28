import { useState, useEffect } from 'react'
import Landing from './components/Landing'
import Login from './components/Login'
import Onboarding from './components/Onboarding'
import Inventory from './components/Inventory'
import Sidebar from './components/Sidebar'
import { supabase } from './lib/supabase'
import { useInventories } from './hooks/useInventories'
import { useProfile } from './hooks/useProfile'
import { hexForToken } from './lib/colorPalette'

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
    document.documentElement.dataset.theme = profile?.theme_preference === 'light' ? 'light' : 'dark'
  }, [profile?.theme_preference])

  // Picking a favorite color re-themes the whole app's accent, not just the
  // avatar fallback — sets a --accent-pick custom property inline (so
  // colorPalette.js stays the only place the actual hex values live) plus
  // a data-accent attribute index.css keys off of to know a color is
  // active at all, since a plain CSS var() fallback can't express "use a
  // completely different formula when unset" the way this needs.
  useEffect(() => {
    const html = document.documentElement
    if (profile?.favorite_color) {
      html.style.setProperty('--accent-pick', hexForToken(profile.favorite_color))
      html.dataset.accent = profile.favorite_color
    } else {
      html.style.removeProperty('--accent-pick')
      delete html.dataset.accent
    }
  }, [profile?.favorite_color])

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
