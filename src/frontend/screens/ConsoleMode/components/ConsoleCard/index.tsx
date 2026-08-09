import { forwardRef } from 'react'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

import { CachedImage } from 'frontend/components/UI'
import StoreLogos from 'frontend/components/UI/StoreLogos'
import { hasStatus } from 'frontend/hooks/hasStatus'
import { hasProgress } from 'frontend/hooks/hasProgress'
import { getProgress } from 'frontend/helpers'
import { getImageFormatting } from 'frontend/screens/Library/components/GameCard/constants'
import fallBackImage from 'frontend/assets/heroic_card.jpg'
import {
  isConsoleCardActivationKey,
  shouldActivateConsoleCardClick
} from '../../interaction'

import type { GameInfo, Status } from 'common/types'

// Statuses that we surface as an overlay on the card. Anything outside this set
// (e.g. `installed`, `notInstalled`, `done`) is treated as idle.
const ACTIVE_STATUSES = new Set<Status>([
  'installing',
  'updating',
  'queued',
  'launching',
  'playing',
  'uninstalling',
  'moving',
  'repairing',
  'syncing-saves',
  'extracting',
  'redist',
  'winetricks'
])

type Props = {
  game: GameInfo
  focused: boolean
  needsUpdate: boolean
  onClick: () => void
  onActivate: () => void
  onFocus: () => void
}

const ConsoleCard = forwardRef<HTMLButtonElement, Props>(function ConsoleCard(
  { game, focused, needsUpdate, onClick, onActivate, onFocus },
  ref
) {
  const { t } = useTranslation()
  const { status, label } = hasStatus(game)
  const [progress] = hasProgress(game.app_name, game.runner)

  const isProgressing = status === 'installing' || status === 'updating'
  const percent = isProgressing
    ? Math.max(0, Math.min(100, Math.round(getProgress(progress))))
    : null
  const showStatus = !!status && ACTIVE_STATUSES.has(status)

  return (
    <button
      ref={ref}
      className={classNames('consoleCard', {
        focused,
        progressing: isProgressing
      })}
      tabIndex={focused ? 0 : -1}
      onClick={(event) => {
        onClick()
        // Mouse clicks only select a game. Keyboard/gamepad activation uses a
        // zero-detail click and should execute the selected game's action.
        if (shouldActivateConsoleCardClick(event.detail)) onActivate()
      }}
      onKeyDown={(event) => {
        if (!isConsoleCardActivationKey(event.key)) return
        event.preventDefault()
        event.stopPropagation()
        onActivate()
      }}
      onFocus={onFocus}
    >
      <div className="consoleCardMedia">
        <CachedImage
          src={
            getImageFormatting(game.art_square, game.runner) || fallBackImage
          }
          alt={game.title}
          className="consoleCardArt"
        />
        <StoreLogos runner={game.runner} className="consoleCardStoreIcon" />
        {game.is_demo && (
          <span className="consoleCardDemoBadge">
            {t('console.card.demo', 'Demo')}
          </span>
        )}
        {needsUpdate && !showStatus && (
          <span className="consoleCardBadge">
            {t('console.card.needsUpdate', 'Needs update')}
          </span>
        )}
        {showStatus && (
          <div className="consoleCardStatus">
            <span className="consoleCardStatusText">{label}</span>
            {isProgressing && (
              <div className="consoleCardProgress" aria-hidden>
                <div
                  className="consoleCardProgressFill"
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  )
})

export default ConsoleCard
