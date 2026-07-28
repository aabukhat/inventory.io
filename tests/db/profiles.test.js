import { describe, it, expect } from 'vitest'
import { setDisplayName, setFavoriteColor, setThemePreference, getMyProfile } from '../../src/lib/profiles.js'
import { validateDisplayName } from '../../src/lib/displayName.js'
import { COLOR_PALETTE } from '../../src/lib/colorPalette.js'
import { asUser } from './helpers/asUser.js'
import { createTestUser } from './helpers/testUsers.js'

// set_display_name()'s server-side validation is meant to exactly mirror
// validateDisplayName() client-side (CLAUDE.md: "must exactly mirror their
// server-side counterpart"). Running the same fixtures through both is the
// regression guard against the two silently drifting apart.
describe('set_display_name mirrors validateDisplayName client-side validation', () => {
  const cases = [
    { label: 'a normal name', input: 'Alex', clientOk: true },
    { label: 'too short', input: 'a', clientOk: false },
    { label: 'too long', input: 'a'.repeat(31), clientOk: false },
    { label: 'profanity', input: 'fuck', clientOk: false },
    { label: 'no alnum', input: '!!!', clientOk: false },
  ]

  it.each(cases)('$label: client and server agree', async ({ input, clientOk }) => {
    const clientResult = validateDisplayName(input)
    expect('name' in clientResult).toBe(clientOk)

    const user = await createTestUser()
    if (clientOk) {
      await expect(asUser(user.session, () => setDisplayName(input))).resolves.not.toThrow()
      const profile = await asUser(user.session, () => getMyProfile())
      expect(profile.display_name).toBe(clientResult.name)
    } else {
      await expect(asUser(user.session, () => setDisplayName(input))).rejects.toThrow()
    }
  })
})

describe('set_favorite_color', () => {
  it('accepts every fixed palette token', async () => {
    const user = await createTestUser()
    for (const { token } of COLOR_PALETTE) {
      await expect(asUser(user.session, () => setFavoriteColor(token))).resolves.not.toThrow()
    }
  })

  it('rejects a token outside the fixed palette', async () => {
    const user = await createTestUser()
    await expect(asUser(user.session, () => setFavoriteColor('not-a-real-color'))).rejects.toThrow()
  })
})

describe('set_theme_preference', () => {
  it.each(['dark', 'light'])('accepts %s', async theme => {
    const user = await createTestUser()
    await expect(asUser(user.session, () => setThemePreference(theme))).resolves.not.toThrow()
  })

  it('rejects an invalid theme', async () => {
    const user = await createTestUser()
    await expect(asUser(user.session, () => setThemePreference('solarized'))).rejects.toThrow()
  })
})
