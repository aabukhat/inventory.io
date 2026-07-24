import { SunIcon, MoonIcon } from 'lucide-react'
import { setThemePreference } from '../lib/profiles'
import { Button } from '@/components/ui/button'

export default function ThemeToggle({ profile, onChanged, className }) {
  const isLight = profile?.theme_preference === 'light'

  async function toggle() {
    await setThemePreference(isLight ? 'dark' : 'light')
    await onChanged?.()
  }

  return (
    <Button
      variant="outline"
      size="icon-sm"
      onClick={toggle}
      title={isLight ? 'switch to dark mode' : 'switch to light mode'}
      className={className}
    >
      {isLight ? <MoonIcon /> : <SunIcon />}
    </Button>
  )
}
