export type ConsoleSortMode = 'last_played' | 'alpha_asc' | 'alpha_desc'

export type ConsoleGameLike = {
  app_name: string
  title: string
  runner: string
  is_installed?: boolean
  install?: {
    is_dlc?: boolean
  }
  thirdPartyManagedApp?: boolean | string
}

type ConsoleVisibilityOptions = {
  hiddenAppNames?: ReadonlySet<string>
  installedOnly?: boolean
  activeStore?: string
  sortMode?: ConsoleSortMode
  getLastPlayed?: (appName: string) => string | undefined
}

/**
 * Applies the same visibility rules used by the normal library before games
 * reach the console carousel.
 */
export function getConsoleLibraryGames<T extends ConsoleGameLike>(
  games: readonly T[],
  hiddenAppNames: ReadonlySet<string> = new Set()
): T[] {
  return games.filter(
    (game) =>
      !game.install?.is_dlc &&
      !game.thirdPartyManagedApp &&
      !hiddenAppNames.has(game.app_name)
  )
}

/**
 * Filters and sorts without mutating the source library array. Keeping this
 * pure prevents a filter change from unexpectedly changing the backing store
 * order and makes controller navigation deterministic.
 */
export function getVisibleConsoleGames<T extends ConsoleGameLike>(
  games: readonly T[],
  {
    installedOnly = false,
    activeStore = 'all',
    sortMode = 'last_played',
    getLastPlayed = () => undefined
  }: ConsoleVisibilityOptions = {}
): T[] {
  let visibleGames = games.filter((game) => {
    if (installedOnly && !game.is_installed) return false
    if (activeStore !== 'all' && game.runner !== activeStore) return false
    return true
  })

  visibleGames = [...visibleGames]

  if (sortMode === 'last_played') {
    return visibleGames.sort((a, b) => {
      const lastPlayedA = getLastPlayed(a.app_name) ?? ''
      const lastPlayedB = getLastPlayed(b.app_name) ?? ''
      if (!lastPlayedA && !lastPlayedB) return a.title.localeCompare(b.title)
      if (!lastPlayedA) return 1
      if (!lastPlayedB) return -1
      return lastPlayedB.localeCompare(lastPlayedA)
    })
  }

  return visibleGames.sort((a, b) => {
    const comparison = a.title.localeCompare(b.title)
    return sortMode === 'alpha_asc' ? comparison : -comparison
  })
}
