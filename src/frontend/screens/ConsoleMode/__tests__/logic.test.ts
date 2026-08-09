import { getConsoleLibraryGames, getVisibleConsoleGames } from '../logic'
import {
  getActionButtonIndex,
  getBackButtonIndex,
  getActionButtonLabel,
  getBackButtonLabel
} from '../controller'
import {
  isConsoleCardActivationKey,
  shouldActivateConsoleCardClick
} from '../interaction'

type TestGame = {
  app_name: string
  title: string
  runner: string
  is_installed?: boolean
  install?: { is_dlc?: boolean }
  thirdPartyManagedApp?: boolean
}

const game = (overrides: Partial<TestGame>): TestGame => ({
  app_name: 'app',
  title: 'Game',
  runner: 'steam',
  ...overrides
})

describe('Console Mode library logic', () => {
  it('excludes hidden, DLC and third-party games', () => {
    const games = [
      game({ app_name: 'visible' }),
      game({ app_name: 'hidden' }),
      game({ app_name: 'dlc', install: { is_dlc: true } }),
      game({ app_name: 'third-party', thirdPartyManagedApp: true })
    ]

    expect(
      getConsoleLibraryGames(games, new Set(['hidden'])).map(
        ({ app_name }) => app_name
      )
    ).toEqual(['visible'])
  })

  it('filters by installed status and store', () => {
    const games = [
      game({ app_name: 'steam-installed', is_installed: true }),
      game({ app_name: 'steam-uninstalled', is_installed: false }),
      game({
        app_name: 'epic-installed',
        runner: 'legendary',
        is_installed: true
      })
    ]

    expect(
      getVisibleConsoleGames(games, {
        installedOnly: true,
        activeStore: 'steam',
        sortMode: 'alpha_asc'
      }).map(({ app_name }) => app_name)
    ).toEqual(['steam-installed'])
  })

  it('sorts recent games first without mutating the source array', () => {
    const games = [
      game({ app_name: 'never', title: 'Never' }),
      game({ app_name: 'old', title: 'Old' }),
      game({ app_name: 'recent', title: 'Recent' })
    ]

    const sorted = getVisibleConsoleGames(games, {
      getLastPlayed: (appName) =>
        ({ recent: '2026-08-09T10:00:00Z', old: '2026-08-01T10:00:00Z' })[
          appName
        ],
      sortMode: 'last_played'
    })

    expect(sorted.map(({ app_name }) => app_name)).toEqual([
      'recent',
      'old',
      'never'
    ])
    expect(games.map(({ app_name }) => app_name)).toEqual([
      'never',
      'old',
      'recent'
    ])
  })
})

describe('Console Mode controller interactions', () => {
  it('selects on pointer clicks but activates only keyboard/gamepad clicks', () => {
    expect(shouldActivateConsoleCardClick(1)).toBe(false)
    expect(shouldActivateConsoleCardClick(0)).toBe(true)
    expect(shouldActivateConsoleCardClick(2)).toBe(false)
    expect(isConsoleCardActivationKey('Enter')).toBe(true)
    expect(isConsoleCardActivationKey(' ')).toBe(true)
    expect(isConsoleCardActivationKey('ArrowRight')).toBe(false)
  })

  it('uses the correct face buttons for Nintendo layouts', () => {
    expect(getActionButtonIndex('xbox')).toBe(0)
    expect(getBackButtonIndex('xbox')).toBe(1)
    expect(getActionButtonIndex('nintendo')).toBe(1)
    expect(getBackButtonIndex('nintendo')).toBe(0)
    expect(getActionButtonLabel('nintendo')).toBe('A')
    expect(getBackButtonLabel('nintendo')).toBe('B')
  })
})
