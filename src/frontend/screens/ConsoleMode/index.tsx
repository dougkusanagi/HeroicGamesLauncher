import './index.scss'

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'

import ContextProvider from 'frontend/state/ContextProvider'
import { sendKill, updateGame } from 'frontend/helpers'
import { timestampStore } from 'frontend/helpers/electronStores'
import HeroicIcon from 'frontend/assets/heroic-icon.svg?react'
import PlayArrow from '@mui/icons-material/PlayArrow'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import DesktopWindowsOutlined from '@mui/icons-material/DesktopWindowsOutlined'
import StorageOutlined from '@mui/icons-material/StorageOutlined'
import SellOutlined from '@mui/icons-material/SellOutlined'
import { CachedImage } from 'frontend/components/UI'
import fallBackImage from 'frontend/assets/heroic_card.jpg'

import ConfirmDialog from './components/ConfirmDialog'
import ConsoleCard from './components/ConsoleCard'
import ControllerHints from './components/ControllerHints'
import LaunchOverlay from './components/LaunchOverlay'
import InstallOverlay from './InstallOverlay'
import {
  BTN_FILTER,
  BTN_L1,
  BTN_R1,
  BTN_R2,
  getActionButtonLabel,
  getBackButtonLabel
} from './controller'
import { playConsoleSound } from './audio'
import { useGamepadButtonPress, useGamepadInfo } from './hooks'

import type { TFunction } from 'i18next'
import type { GameInfo, Runner } from 'common/types'

type StoreKey = Runner | 'all'

type ConsoleSortMode = 'last_played' | 'alpha_asc' | 'alpha_desc'

const SORT_MODE_ORDER: ConsoleSortMode[] = [
  'last_played',
  'alpha_asc',
  'alpha_desc'
]

const SORT_MODE_LABEL: Record<ConsoleSortMode, string> = {
  last_played: 'console.sortLastPlayed',
  alpha_asc: 'console.sortAlphaAsc',
  alpha_desc: 'console.sortAlphaDesc'
}

const SORT_MODE_DEFAULT: Record<ConsoleSortMode, string> = {
  last_played: 'Last Played',
  alpha_asc: 'A → Z',
  alpha_desc: 'Z → A'
}

const CANCEL_DOWNLOAD_COPY = {
  update: {
    title: (t: TFunction) => t('console.cancelUpdate.title', 'Cancel update?'),
    message: (t: TFunction) =>
      t(
        'console.cancelUpdate.message',
        'This game is currently downloading. Cancel the ongoing update?'
      )
  },
  install: {
    title: (t: TFunction) =>
      t('console.cancelInstall.title', 'Cancel installation?'),
    message: (t: TFunction) =>
      t(
        'console.cancelInstall.message',
        'This game is currently installing. Cancel the installation?'
      )
  }
} as const

export default function ConsoleMode() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    epic,
    gog,
    amazon,
    steam,
    zoom,
    libraryStatus,
    sideloadedLibrary,
    refreshLibrary,
    refreshing,
    gameUpdates,
    hiddenGames
  } = useContext(ContextProvider)

  const [activeStore, setActiveStore] = useState<StoreKey>('all')
  const [sortMode, setSortMode] = useState<ConsoleSortMode>('last_played')
  const [filteringByInstalled, setFilteringByInstalled] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [launchingGame, setLaunchingGame] = useState<GameInfo | null>(null)
  const [installingGame, setInstallingGame] = useState<GameInfo | null>(null)
  const [updateNoticeGame, setUpdateNoticeGame] = useState<GameInfo | null>(
    null
  )
  const [cancelDownloadGame, setCancelDownloadGame] = useState<{
    game: GameInfo
    kind: 'install' | 'update'
  } | null>(null)
  const [queuedNoticeGame, setQueuedNoticeGame] = useState<GameInfo | null>(
    null
  )

  const { connected: gamepadConnected, layout: controllerLayout } =
    useGamepadInfo()
  const backButtonLabel = getBackButtonLabel(controllerLayout)
  const actionButtonLabel = getActionButtonLabel(controllerLayout)

  const cardRefs = useRef<Array<HTMLButtonElement | null>>([])
  const gridRef = useRef<HTMLDivElement | null>(null)
  const topBarRef = useRef<HTMLDivElement | null>(null)
  const actionBarRef = useRef<HTMLDivElement | null>(null)
  const primaryActionRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusedGameKeyRef = useRef<string | null>(null)

  useEffect(() => {
    window.api.setFullscreen(true)
    if (
      !refreshing &&
      epic.library.length === 0 &&
      gog.library.length === 0 &&
      amazon.library.length === 0 &&
      steam.library.length === 0 &&
      zoom.library.length === 0
    ) {
      void refreshLibrary({ runInBackground: true })
    }
    return () => {
      window.api.setFullscreen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allGames = useMemo<GameInfo[]>(() => {
    const hiddenAppNames = new Set(hiddenGames.list.map((game) => game.appName))
    const all: GameInfo[] = [
      ...epic.library,
      ...gog.library,
      ...amazon.library,
      ...steam.library,
      ...zoom.library,
      ...sideloadedLibrary
    ]
    return all.filter(
      (g) =>
        !g.install?.is_dlc &&
        !g.thirdPartyManagedApp &&
        !hiddenAppNames.has(g.app_name)
    )
  }, [
    epic.library,
    gog.library,
    amazon.library,
    steam.library,
    zoom.library,
    sideloadedLibrary,
    hiddenGames
  ])

  const visibleGames = useMemo(() => {
    // reset card refs to rebuild them
    cardRefs.current = []

    let filteredGames = allGames

    if (filteringByInstalled) {
      filteredGames = filteredGames.filter((g) => g.is_installed)
    }

    if (activeStore !== 'all') {
      filteredGames = filteredGames.filter((g) => g.runner === activeStore)
    }

    return filteredGames.sort((a, b) => {
      if (sortMode === 'last_played') {
        const ta = timestampStore.get_nodefault(a.app_name)?.lastPlayed ?? ''
        const tb = timestampStore.get_nodefault(b.app_name)?.lastPlayed ?? ''
        // Most recently played first; never-played games sink to the bottom,
        // where ties are broken alphabetically.
        if (!ta && !tb) return a.title.localeCompare(b.title)
        if (!ta) return 1
        if (!tb) return -1
        return tb.localeCompare(ta)
      }
      const cmp = a.title.localeCompare(b.title)
      return sortMode === 'alpha_asc' ? cmp : -cmp
    })
  }, [allGames, filteringByInstalled, activeStore, sortMode])

  const storesWithGames = useMemo(() => {
    const set = new Set<Runner>()
    for (const g of allGames) set.add(g.runner)
    return set
  }, [allGames])

  const storeFilters = useMemo<
    { key: StoreKey; label: string; enabled: boolean }[]
  >(
    () => [
      {
        key: 'all',
        label: t('console.filter.all', 'All'),
        enabled: allGames.length > 0
      },
      {
        key: 'legendary',
        label: 'Epic',
        enabled: storesWithGames.has('legendary')
      },
      { key: 'gog', label: 'GOG', enabled: storesWithGames.has('gog') },
      { key: 'nile', label: 'Amazon', enabled: storesWithGames.has('nile') },
      { key: 'steam', label: 'Steam', enabled: storesWithGames.has('steam') },
      {
        key: 'sideload',
        label: t('console.filter.sideload', 'Other'),
        enabled: storesWithGames.has('sideload')
      },
      { key: 'zoom', label: 'ZOOM', enabled: storesWithGames.has('zoom') }
    ],
    [t, storesWithGames, allGames.length]
  )

  const enabledStoreKeys = useMemo(
    () => storeFilters.filter((f) => f.enabled).map((f) => f.key),
    [storeFilters]
  )

  useEffect(() => {
    if (activeStore !== 'all' && !enabledStoreKeys.includes(activeStore)) {
      setActiveStore('all')
    }
  }, [enabledStoreKeys, activeStore])

  useEffect(() => {
    // always make sane focused index
    if (focusedIndex >= visibleGames.length || focusedIndex < 0) {
      setFocusedIndex(
        Math.max(0, Math.min(focusedIndex, visibleGames.length - 1))
      )
    }
  }, [visibleGames.length, focusedIndex])

  useEffect(() => {
    const btn = cardRefs.current[focusedIndex]
    if (!btn) return
    if (document.activeElement !== btn) {
      btn.focus({ preventScroll: true })
    }
    btn.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: 'smooth'
    })
  }, [focusedIndex, visibleGames.length])

  const focusedGame = visibleGames[focusedIndex]
  const focusedGameKey = focusedGame
    ? `${focusedGame.runner}-${focusedGame.app_name}`
    : null

  useEffect(() => {
    const previousKey = previousFocusedGameKeyRef.current
    previousFocusedGameKeyRef.current = focusedGameKey
    if (previousKey && focusedGameKey && previousKey !== focusedGameKey) {
      playConsoleSound('move')
    }
  }, [focusedGameKey])

  const focusedGameTitle = focusedGame?.overrides?.title || focusedGame?.title
  const focusedGameDescription =
    focusedGame?.extra?.about?.shortDescription ||
    focusedGame?.extra?.about?.description ||
    focusedGame?.description
  const focusedGameGenres = focusedGame?.extra?.genres?.filter(Boolean) ?? []
  const focusedGameStatus = focusedGame
    ? libraryStatus.find((g) => g.appName === focusedGame.app_name)?.status
    : undefined
  const focusedGamePlaytime = focusedGame
    ? timestampStore.get_nodefault(focusedGame.app_name)?.totalPlayed
    : undefined

  const formatReleaseDate = (releaseDate?: string) => {
    if (!releaseDate) return undefined
    const date = new Date(releaseDate)
    if (Number.isNaN(date.getTime())) return releaseDate
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date)
  }

  const formatPlatform = (platform?: string) => {
    if (!platform) return undefined
    switch (platform.toLowerCase()) {
      case 'windows':
      case 'win32':
        return t('platforms.win', 'Windows')
      case 'linux':
        return t('platforms.linux', 'Linux')
      case 'mac':
      case 'macos':
      case 'osx':
        return t('platforms.mac', 'Mac')
      case 'browser':
        return t('platforms.browser', 'Browser')
      default:
        return platform
    }
  }

  const focusedGameReleaseDate = formatReleaseDate(
    focusedGame?.extra?.releaseDate
  )
  const focusedGamePlatform = formatPlatform(focusedGame?.install.platform)
  const focusedGameInstallSize =
    focusedGame?.is_installed &&
    focusedGame.install.install_size &&
    focusedGame.install.install_size !== '0'
      ? focusedGame.install.install_size
      : undefined
  const focusedGameVersion = focusedGame?.is_installed
    ? focusedGame.install.version || focusedGame.version
    : undefined

  const focusedGameBackground =
    focusedGame?.extra?.background ||
    focusedGame?.art_background ||
    focusedGame?.art_cover ||
    focusedGame?.art_square ||
    fallBackImage

  const focusedGameActionLabel = focusedGame
    ? focusedGameStatus === 'queued'
      ? t('gamepage:button.queue.remove', 'Remove from Queue')
      : focusedGameStatus === 'installing' || focusedGameStatus === 'updating'
        ? t('button.cancel', 'Cancel')
        : !focusedGame.is_installed
          ? t('gamepage:button.install', 'Install')
          : gameUpdates.includes(focusedGame.app_name)
            ? t('gamepage:button.update', 'Update')
            : t('gamepage:button.play', 'Play')
    : ''

  const focusedGameStatusLabel = (() => {
    if (!focusedGameStatus) return undefined
    const statusLabels: Record<string, string> = {
      queued: t('gamepage:status.queued', 'Queued'),
      installing: t('gamepage:status.downloading', 'Installing'),
      updating: t('gamepage:status.updating', 'Updating'),
      launching: t('gamepage:status.launching', 'Launching'),
      playing: t('gamepage:status.playing', 'Playing'),
      'syncing-saves': t('gamepage:status.syncingSaves', 'Syncing Saves')
    }
    return statusLabels[focusedGameStatus]
  })()

  const formatPlaytime = (minutes?: number) => {
    if (!minutes) return null
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (hours > 0) {
      return t('console.meta.playtimeHours', '{{hours}}h {{minutes}}m', {
        hours,
        minutes: remainingMinutes
      })
    }
    return t('console.meta.playtimeMinutes', '{{minutes}}m', {
      minutes: remainingMinutes
    })
  }

  const cycleStore = useCallback(
    (direction: 1 | -1) => {
      if (enabledStoreKeys.length === 0) return
      const idx = enabledStoreKeys.indexOf(activeStore)
      const next =
        (idx + direction + enabledStoreKeys.length) % enabledStoreKeys.length
      playConsoleSound('filter')
      setActiveStore(enabledStoreKeys[next])
    },
    [enabledStoreKeys, activeStore]
  )

  const selectStore = useCallback(
    (store: StoreKey) => {
      if (store === activeStore) return
      playConsoleSound('filter')
      setActiveStore(store)
    },
    [activeStore]
  )

  const toggleInstalledFilter = useCallback(() => {
    playConsoleSound('filter')
    setFilteringByInstalled((current) => !current)
  }, [])

  const quit = useCallback(() => {
    playConsoleSound('back')
    navigate('/')
  }, [navigate])

  const idle =
    !launchingGame &&
    !installingGame &&
    !updateNoticeGame &&
    !cancelDownloadGame &&
    !queuedNoticeGame

  const activateGame = useCallback(
    (game: GameInfo) => {
      if (!idle) return
      const status = libraryStatus.find(
        (g) => g.appName === game.app_name
      )?.status
      if (status === 'queued') {
        playConsoleSound('confirm')
        setQueuedNoticeGame(game)
        return
      }
      if (status === 'installing') {
        playConsoleSound('confirm')
        setCancelDownloadGame({ game, kind: 'install' })
        return
      }
      if (status === 'updating') {
        playConsoleSound('confirm')
        setCancelDownloadGame({ game, kind: 'update' })
        return
      }
      if (!game.is_installed) {
        playConsoleSound('confirm')
        setInstallingGame(game)
        return
      }
      if (gameUpdates.includes(game.app_name)) {
        playConsoleSound('confirm')
        setUpdateNoticeGame(game)
        return
      }
      playConsoleSound('launch')
      setLaunchingGame(game)
    },
    [idle, libraryStatus, gameUpdates]
  )

  const handleUpdateFromNotice = useCallback(() => {
    if (!updateNoticeGame) return
    const game = updateNoticeGame
    setUpdateNoticeGame(null)
    if (game.runner !== 'sideload') {
      void updateGame({
        appName: game.app_name,
        runner: game.runner as Runner,
        gameInfo: game
      })
    }
  }, [updateNoticeGame])

  const handleLaunchWithoutUpdate = useCallback(() => {
    if (!updateNoticeGame) return
    const game = updateNoticeGame
    setUpdateNoticeGame(null)
    setLaunchingGame(game)
  }, [updateNoticeGame])

  const dismissUpdateNotice = useCallback(() => setUpdateNoticeGame(null), [])

  const handleCancelDownload = useCallback(() => {
    if (!cancelDownloadGame) return
    const { game } = cancelDownloadGame
    setCancelDownloadGame(null)
    void sendKill(game.app_name, game.runner)
  }, [cancelDownloadGame])

  const dismissCancelDownload = useCallback(
    () => setCancelDownloadGame(null),
    []
  )

  const handleRemoveFromQueue = useCallback(() => {
    if (!queuedNoticeGame) return
    const game = queuedNoticeGame
    setQueuedNoticeGame(null)
    window.localStorage.removeItem(game.app_name)
    void window.api.removeFromDMQueue(game.app_name)
  }, [queuedNoticeGame])

  const dismissQueuedNotice = useCallback(() => setQueuedNoticeGame(null), [])

  const onTopBarKeyDown = (e: React.KeyboardEvent) => {
    if (!idle) return
    const root = topBarRef.current
    if (!root) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      cardRefs.current[focusedIndex]?.focus()
      return
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const btns = Array.from(
        root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
      )
      const active = document.activeElement as HTMLButtonElement | null
      const idx = active ? btns.indexOf(active) : -1
      if (idx === -1 || btns.length === 0) return
      e.preventDefault()
      e.stopPropagation()
      const delta = e.key === 'ArrowRight' ? 1 : -1
      const next = (idx + delta + btns.length) % btns.length
      btns[next].focus()
    }
  }

  const moveFocus = useCallback(
    (direction: 1 | -1) => {
      if (!idle || visibleGames.length === 0) return
      setFocusedIndex((index) =>
        Math.max(0, Math.min(index + direction, visibleGames.length - 1))
      )
    },
    [idle, visibleGames.length]
  )

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (visibleGames.length === 0 || !idle) return

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      e.stopPropagation()
      moveFocus(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      e.stopPropagation()
      moveFocus(-1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      primaryActionRef.current?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      const first = topBarRef.current?.querySelector<HTMLButtonElement>(
        'button:not(:disabled)'
      )
      first?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const g = visibleGames[focusedIndex]
      if (g) activateGame(g)
    }
  }

  const onActionBarKeyDown = (e: React.KeyboardEvent) => {
    if (!idle || !focusedGame) return
    const buttons = Array.from(
      actionBarRef.current?.querySelectorAll<HTMLButtonElement>(
        'button:not(:disabled)'
      ) ?? []
    )
    const active = document.activeElement as HTMLButtonElement | null
    const index = active ? buttons.indexOf(active) : -1

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (buttons.length === 0 || index < 0) return
      e.preventDefault()
      e.stopPropagation()
      const delta = e.key === 'ArrowRight' ? 1 : -1
      buttons[(index + delta + buttons.length) % buttons.length]?.focus()
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      cardRefs.current[focusedIndex]?.focus()
    }
  }

  const openGameDetails = useCallback(() => {
    if (!focusedGame) return
    playConsoleSound('confirm')
    navigate(`/gamepage/${focusedGame.runner}/${focusedGame.app_name}`, {
      state: { gameInfo: focusedGame }
    })
  }, [focusedGame, navigate])

  // Esc quits when idle. While a game is launching or a dialog is open,
  // the overlay/dialog handles Esc itself.
  useEffect(() => {
    if (!idle) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      quit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [quit, idle])

  // Read by gamepad.ts to block the Guide/back buttons during launch.
  useEffect(() => {
    if (!launchingGame) return
    document.body.classList.add('console-launching')
    return () => document.body.classList.remove('console-launching')
  }, [launchingGame])

  const cycleSort = useCallback(() => {
    playConsoleSound('sort')
    setSortMode((current) => {
      const idx = SORT_MODE_ORDER.indexOf(current)
      const next = (idx + 1) % SORT_MODE_ORDER.length
      return SORT_MODE_ORDER[next]
    })
  }, [])

  useGamepadButtonPress(BTN_L1, () => cycleStore(-1), idle)
  useGamepadButtonPress(BTN_R1, () => cycleStore(1), idle)
  useGamepadButtonPress(BTN_R2, cycleSort, idle)
  useGamepadButtonPress(BTN_FILTER, toggleInstalledFilter, idle)

  return (
    <div className={classNames('ConsoleMode', { launching: !!launchingGame })}>
      {focusedGame && (
        <div className="consoleBackdrop" aria-hidden="true">
          <CachedImage
            key={`${focusedGame.runner}-${focusedGame.app_name}`}
            src={focusedGameBackground}
            fallback={fallBackImage}
            className="consoleBackdropArt"
            alt=""
          />
          <div className="consoleBackdropShade" />
        </div>
      )}

      <div
        className="consoleTopBar"
        ref={topBarRef}
        onKeyDown={onTopBarKeyDown}
      >
        <div className="consoleFilters">
          {storeFilters
            .filter((f) => f.enabled)
            .map((f) => (
              <button
                key={f.key}
                className={classNames('consoleChip', {
                  active: activeStore === f.key
                })}
                aria-current={activeStore === f.key ? 'page' : undefined}
                onClick={() => selectStore(f.key)}
                disabled={!!launchingGame}
              >
                {f.label}
              </button>
            ))}
        </div>
        <div className="consoleTopRight">
          <button
            className={classNames('consoleChip', {
              active: filteringByInstalled
            })}
            aria-pressed={filteringByInstalled}
            onClick={toggleInstalledFilter}
            disabled={!!launchingGame}
          >
            {t('console.filter.installed', 'Installed')}
          </button>
          <button
            className="consoleChip"
            onClick={cycleSort}
            aria-label={t('console.sort', 'Sort')}
            disabled={!!launchingGame}
          >
            {t(SORT_MODE_LABEL[sortMode], SORT_MODE_DEFAULT[sortMode])}
          </button>
          <button
            className="consoleQuitButton"
            onClick={quit}
            disabled={!!launchingGame}
          >
            {t('console.quit', 'Quit Console')}
          </button>
          <button
            className="consoleQuitButton danger"
            onClick={() => window.api.quit()}
            disabled={!!launchingGame}
          >
            {t('console.quitApp', 'Quit App')}
          </button>
        </div>
        <div className="consoleBrand" aria-label="Heroic Games Launcher">
          <HeroicIcon className="consoleLogo" />
          <span className="consoleWordmark">HEROIC</span>
        </div>
      </div>

      <div className="consoleStage">
        {visibleGames.length === 0 ? (
          <div className="consoleEmpty">
            {refreshing
              ? t('console.loading', 'Loading your library…')
              : t(
                  'console.empty',
                  'No installed games to show. Install something first.'
                )}
          </div>
        ) : (
          <>
            <div className="consoleCarousel">
              <button
                type="button"
                className="consoleCarouselArrow previous"
                aria-label={t('console.previousGame', 'Previous game')}
                onClick={() => moveFocus(-1)}
                disabled={!idle || focusedIndex <= 0}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <div
                className="consoleGridScroller"
                ref={gridRef}
                role="listbox"
                aria-label={t('console.games', 'Installed games')}
                onKeyDown={onGridKeyDown}
              >
                <div className="consoleGrid">
                  {visibleGames.map((game, i) => {
                    const isFocused = i === focusedIndex
                    return (
                      <ConsoleCard
                        key={`${game.runner}-${game.app_name}`}
                        ref={(el) => {
                          cardRefs.current[i] = el
                        }}
                        game={game}
                        focused={isFocused}
                        needsUpdate={gameUpdates.includes(game.app_name)}
                        onClick={() => setFocusedIndex(i)}
                        onFocus={() => setFocusedIndex(i)}
                      />
                    )
                  })}
                </div>
              </div>
              <button
                type="button"
                className="consoleCarouselArrow next"
                aria-label={t('console.nextGame', 'Next game')}
                onClick={() => moveFocus(1)}
                disabled={!idle || focusedIndex >= visibleGames.length - 1}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>

            {focusedGame && (
              <section className="consoleHero" aria-label={focusedGameTitle}>
                <div className="consoleHeroCopy">
                  {focusedGame.art_logo ? (
                    <CachedImage
                      key={focusedGame.art_logo}
                      src={focusedGame.art_logo}
                      className="consoleHeroLogo"
                      alt={focusedGameTitle}
                    />
                  ) : (
                    <h1 className="consoleHeroTitle">{focusedGameTitle}</h1>
                  )}

                  <div className="consoleHeroMeta">
                    {focusedGameGenres.length > 0 && (
                      <span>{focusedGameGenres.slice(0, 3).join('  •  ')}</span>
                    )}
                    {focusedGame.developer && (
                      <span>{focusedGame.developer}</span>
                    )}
                  </div>

                  {focusedGameDescription && (
                    <p className="consoleHeroDescription">
                      {focusedGameDescription}
                    </p>
                  )}

                  {(focusedGameReleaseDate ||
                    focusedGamePlatform ||
                    focusedGameInstallSize ||
                    focusedGameVersion) && (
                    <div className="consoleHeroDetails">
                      {focusedGameReleaseDate && (
                        <div className="consoleHeroDetail">
                          <CalendarMonthOutlined aria-hidden="true" />
                          <span>
                            <small>
                              {t('console.meta.releaseDate', 'Released')}
                            </small>
                            <strong>{focusedGameReleaseDate}</strong>
                          </span>
                        </div>
                      )}
                      {focusedGamePlatform && (
                        <div className="consoleHeroDetail">
                          <DesktopWindowsOutlined aria-hidden="true" />
                          <span>
                            <small>
                              {t('console.meta.platform', 'Platform')}
                            </small>
                            <strong>{focusedGamePlatform}</strong>
                          </span>
                        </div>
                      )}
                      {focusedGameInstallSize && (
                        <div className="consoleHeroDetail">
                          <StorageOutlined aria-hidden="true" />
                          <span>
                            <small>
                              {t('console.meta.installSize', 'Installed size')}
                            </small>
                            <strong>{focusedGameInstallSize}</strong>
                          </span>
                        </div>
                      )}
                      {focusedGameVersion && (
                        <div className="consoleHeroDetail">
                          <SellOutlined aria-hidden="true" />
                          <span>
                            <small>
                              {t('console.meta.version', 'Version')}
                            </small>
                            <strong>{focusedGameVersion}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="consoleHeroFacts">
                    {formatPlaytime(focusedGamePlaytime) && (
                      <span>
                        <span className="consoleFactIcon" aria-hidden="true">
                          ◷
                        </span>
                        {formatPlaytime(focusedGamePlaytime)}
                      </span>
                    )}
                    {focusedGame.cloud_save_enabled && (
                      <span>
                        <span className="consoleFactIcon" aria-hidden="true">
                          ☁
                        </span>
                        {t('console.meta.cloudSaves', 'Cloud saves supported')}
                      </span>
                    )}
                    {focusedGameStatusLabel && (
                      <span className="consoleHeroStatus">
                        {focusedGameStatusLabel}
                      </span>
                    )}
                  </div>

                  <div
                    className="consoleHeroActions"
                    ref={actionBarRef}
                    onKeyDown={onActionBarKeyDown}
                  >
                    <button
                      ref={primaryActionRef}
                      className="consolePrimaryAction"
                      onClick={() => activateGame(focusedGame)}
                      disabled={!idle}
                    >
                      <PlayArrow aria-hidden="true" />
                      <span>{focusedGameActionLabel}</span>
                      <kbd>
                        {gamepadConnected ? actionButtonLabel : 'Enter'}
                      </kbd>
                    </button>
                    <button
                      className="consoleSecondaryAction"
                      onClick={openGameDetails}
                      disabled={!idle}
                    >
                      <InfoOutlined aria-hidden="true" />
                      <span>{t('gamepage:button.details', 'Details')}</span>
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <div className="consoleFooter">
        {gamepadConnected && !launchingGame && (
          <ControllerHints layout={controllerLayout} />
        )}
      </div>

      {launchingGame && (
        <LaunchOverlay
          game={launchingGame}
          onDismiss={() => setLaunchingGame(null)}
        />
      )}

      {installingGame && (
        <InstallOverlay
          game={installingGame}
          onDismiss={() => setInstallingGame(null)}
        />
      )}

      {updateNoticeGame && (
        <ConfirmDialog
          title={t('gamepage:box.update.title')}
          message={t('gamepage:box.update.message')}
          gameTitle={updateNoticeGame.title}
          confirmLabel={t('gamepage:box.yes')}
          cancelLabel={t('gamepage:box.no')}
          dismissLabel={t('button.cancel', 'Cancel')}
          onConfirm={handleUpdateFromNotice}
          onCancel={handleLaunchWithoutUpdate}
          onDismiss={dismissUpdateNotice}
          gamepadConnected={gamepadConnected}
          backButtonLabel={backButtonLabel}
          actionButtonLabel={actionButtonLabel}
        />
      )}

      {cancelDownloadGame && (
        <ConfirmDialog
          title={CANCEL_DOWNLOAD_COPY[cancelDownloadGame.kind].title(t)}
          message={CANCEL_DOWNLOAD_COPY[cancelDownloadGame.kind].message(t)}
          gameTitle={cancelDownloadGame.game.title}
          confirmLabel={t('gamepage:box.yes')}
          cancelLabel={t('gamepage:box.no')}
          onConfirm={handleCancelDownload}
          onCancel={dismissCancelDownload}
          gamepadConnected={gamepadConnected}
          backButtonLabel={backButtonLabel}
          actionButtonLabel={actionButtonLabel}
        />
      )}

      {queuedNoticeGame && (
        <ConfirmDialog
          title={t('gamepage:button.queue.remove')}
          message={t(
            'console.removeFromQueue.message',
            'This game is queued for download. Remove it from the queue?'
          )}
          gameTitle={queuedNoticeGame.title}
          confirmLabel={t('gamepage:box.yes')}
          cancelLabel={t('gamepage:box.no')}
          onConfirm={handleRemoveFromQueue}
          onCancel={dismissQueuedNotice}
          gamepadConnected={gamepadConnected}
          backButtonLabel={backButtonLabel}
          actionButtonLabel={actionButtonLabel}
        />
      )}
    </div>
  )
}
