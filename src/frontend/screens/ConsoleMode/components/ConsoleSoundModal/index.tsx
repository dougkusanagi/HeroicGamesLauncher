import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import VolumeUpOutlined from '@mui/icons-material/VolumeUpOutlined'
import Check from '@mui/icons-material/Check'
import Close from '@mui/icons-material/Close'

import {
  setConsoleSoundPreferences,
  playConsoleSound,
  type SoundPreset
} from '../../audio'
import {
  BTN_START,
  getActionButtonIndex,
  getBackButtonIndex,
  getActionButtonLabel,
  getBackButtonLabel
} from '../../controller'
import { useGamepadButtonPress, useGamepadInfo } from '../../hooks'
import type {
  AppSettings,
  ConsoleSoundCustomEvents,
  ConsoleSoundEvent,
  ConsoleSoundEventSetting
} from 'common/types'

import './index.scss'

type ConsoleSoundModalProps = {
  onDismiss: () => void
}

type MenuItemId =
  | 'master'
  | 'preset'
  | 'volume'
  | 'cue_move'
  | 'cue_confirm'
  | 'cue_launch'
  | 'cue_back'
  | 'cue_filter'
  | 'cue_sort'
  | 'done'

const MENU_ITEMS: {
  id: MenuItemId
  labelKey: string
  defaultLabel: string
  type: 'toggle' | 'select' | 'slider' | 'action'
}[] = [
  {
    id: 'master',
    labelKey: 'console.soundModal.master',
    defaultLabel: 'Efeitos de Som (Geral)',
    type: 'toggle'
  },
  {
    id: 'preset',
    labelKey: 'console.soundModal.theme',
    defaultLabel: 'Tema de Sons Principal',
    type: 'select'
  },
  {
    id: 'volume',
    labelKey: 'console.soundModal.volume',
    defaultLabel: 'Volume Master',
    type: 'slider'
  },
  {
    id: 'cue_move',
    labelKey: 'console.sound.move',
    defaultLabel: 'Efeito: Navegação / Mover',
    type: 'select'
  },
  {
    id: 'cue_confirm',
    labelKey: 'console.sound.confirm',
    defaultLabel: 'Efeito: Confirmação / Ação',
    type: 'select'
  },
  {
    id: 'cue_launch',
    labelKey: 'console.sound.launch',
    defaultLabel: 'Efeito: Iniciar Jogo',
    type: 'select'
  },
  {
    id: 'cue_back',
    labelKey: 'console.sound.back',
    defaultLabel: 'Efeito: Voltar / Cancelar',
    type: 'select'
  },
  {
    id: 'cue_filter',
    labelKey: 'console.sound.filter',
    defaultLabel: 'Efeito: Trocar Filtro',
    type: 'select'
  },
  {
    id: 'cue_sort',
    labelKey: 'console.sound.sort',
    defaultLabel: 'Efeito: Trocar Ordenação',
    type: 'select'
  },
  {
    id: 'done',
    labelKey: 'button.done',
    defaultLabel: 'Salvar & Fechar',
    type: 'action'
  }
]

const EVENT_SETTING_OPTIONS: {
  value: ConsoleSoundEventSetting
  label: string
}[] = [
  { value: 'inherit', label: 'Padrão do Tema' },
  { value: 'steam', label: 'Steam Big Picture' },
  { value: 'chiptune', label: 'Retro Chiptune' },
  { value: 'muted', label: '🔇 Mutado' }
]

// ── Helpers to read / write settings via IPC ──────────────────────────
function persistSetting(key: keyof AppSettings, value: unknown) {
  window.api.setSetting({ appName: 'default', key, value })
}

export default function ConsoleSoundModal({
  onDismiss
}: ConsoleSoundModalProps) {
  const { t } = useTranslation()
  const { layout } = useGamepadInfo()
  const actionLabel = getActionButtonLabel(layout)
  const backLabel = getBackButtonLabel(layout)

  // ── Local state ─────────────────────────────────────────────────────
  const [enabled, setEnabled] = useState(true)
  const [volume, setVolume] = useState(70)
  const [preset, setPreset] = useState<SoundPreset>('steam')
  const [customEvents, setCustomEvents] = useState<ConsoleSoundCustomEvents>({})
  const [loaded, setLoaded] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const itemRefs = useRef<Array<HTMLDivElement | null>>([])

  // ── Load settings from backend on mount ─────────────────────────────
  useEffect(() => {
    document.body.classList.add('console-modal-open')
    window.api
      .requestAppSettings()
      .then((settings) => {
        setEnabled(settings.consoleSoundEnabled ?? true)
        setVolume(settings.consoleSoundVolume ?? 70)
        setPreset((settings.consoleSoundPreset as SoundPreset) ?? 'steam')
        setCustomEvents(settings.consoleSoundCustomEvents ?? {})
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    return () => document.body.classList.remove('console-modal-open')
  }, [])

  // ── Sync audio engine whenever local state changes ──────────────────
  useEffect(() => {
    if (!loaded) return
    setConsoleSoundPreferences({
      consoleSoundEnabled: enabled,
      consoleSoundVolume: volume,
      consoleSoundPreset: preset,
      consoleSoundCustomEvents: customEvents
    })
  }, [enabled, volume, preset, customEvents, loaded])

  // ── Setters that also persist to backend ────────────────────────────
  const updateEnabled = useCallback((val: boolean) => {
    setEnabled(val)
    persistSetting('consoleSoundEnabled', val)
  }, [])

  const updateVolume = useCallback((val: number) => {
    setVolume(val)
    persistSetting('consoleSoundVolume', val)
  }, [])

  const updatePreset = useCallback((val: SoundPreset) => {
    setPreset(val)
    persistSetting('consoleSoundPreset', val)
  }, [])

  const updateCustomEvents = useCallback((val: ConsoleSoundCustomEvents) => {
    setCustomEvents(val)
    persistSetting('consoleSoundCustomEvents', val)
  }, [])

  // ── Shortcut hooks for Start & Back buttons ─────────────────────────
  useGamepadButtonPress(BTN_START, () => {
    playConsoleSound('back')
    onDismiss()
  })

  useGamepadButtonPress(getBackButtonIndex(layout), () => {
    playConsoleSound('back')
    onDismiss()
  })

  // ── Scroll focused element into view ────────────────────────────────
  useEffect(() => {
    const el = itemRefs.current[focusedIndex]
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusedIndex])

  const getCueValue = (key: ConsoleSoundEvent): ConsoleSoundEventSetting => {
    return customEvents?.[key] || 'inherit'
  }

  // ── Core option handler ─────────────────────────────────────────────
  const handleNextOption = useCallback(
    (direction: 1 | -1) => {
      const item = MENU_ITEMS[focusedIndex]
      if (!item) return

      if (item.id === 'master') {
        const next = !enabled
        updateEnabled(next)
        if (next) playConsoleSound('confirm')
      } else if (item.id === 'preset') {
        const nextPreset: SoundPreset =
          preset === 'steam' ? 'chiptune' : 'steam'
        updatePreset(nextPreset)
        playConsoleSound('confirm')
      } else if (item.id === 'volume') {
        const nextVol = Math.max(0, Math.min(100, volume + direction * 5))
        updateVolume(nextVol)
        playConsoleSound('move')
      } else if (item.id.startsWith('cue_')) {
        const cueKey = item.id.replace('cue_', '') as ConsoleSoundEvent
        const current = customEvents?.[cueKey] || 'inherit'
        const curIdx = EVENT_SETTING_OPTIONS.findIndex(
          (o) => o.value === current
        )
        const nextIdx =
          (curIdx + direction + EVENT_SETTING_OPTIONS.length) %
          EVENT_SETTING_OPTIONS.length
        const nextVal = EVENT_SETTING_OPTIONS[nextIdx].value
        const updated: ConsoleSoundCustomEvents = {
          ...customEvents,
          [cueKey]: nextVal
        }
        updateCustomEvents(updated)
        if (nextVal !== 'muted') {
          playConsoleSound(cueKey)
        }
      } else if (item.id === 'done') {
        playConsoleSound('confirm')
        onDismiss()
      }
    },
    [
      focusedIndex,
      enabled,
      preset,
      volume,
      customEvents,
      updateEnabled,
      updatePreset,
      updateVolume,
      updateCustomEvents,
      onDismiss
    ]
  )

  const handleNextOptionRef = useRef(handleNextOption)
  handleNextOptionRef.current = handleNextOption

  // ── Gamepad polling: D-Pad, Left Stick, Face buttons ────────────────
  useEffect(() => {
    let rafId = 0
    let lastNavTime = 0
    const prevAction = new Map<number, boolean>()
    const NAV_COOLDOWN = 185

    const isBtnPressed = (btn?: GamepadButton) =>
      !!btn && (btn.pressed || btn.value > 0.5)

    // Seed with current state so the button that opened the modal
    // does not immediately fire a handler.
    for (const gp of navigator.getGamepads()) {
      if (gp) {
        const actionIdx = getActionButtonIndex(layout)
        prevAction.set(gp.index, isBtnPressed(gp.buttons[actionIdx]))
      }
    }

    const pollGamepad = () => {
      const now = performance.now()

      for (const gp of navigator.getGamepads()) {
        if (!gp) continue

        // Face Button: Action (A / Cross)  — edge-triggered
        const actionIdx = getActionButtonIndex(layout)
        const actionPressed = isBtnPressed(gp.buttons[actionIdx])
        const wasPressedBefore = prevAction.get(gp.index) ?? false
        if (actionPressed && !wasPressedBefore) {
          handleNextOptionRef.current(1)
        }
        prevAction.set(gp.index, actionPressed)

        // D-Pad (12/13/14/15) & Left Stick axes — rate-limited
        const dpadUp =
          isBtnPressed(gp.buttons[12]) ||
          (gp.axes[1] != null && gp.axes[1] < -0.55)
        const dpadDown =
          isBtnPressed(gp.buttons[13]) ||
          (gp.axes[1] != null && gp.axes[1] > 0.55)
        const dpadLeft =
          isBtnPressed(gp.buttons[14]) ||
          (gp.axes[0] != null && gp.axes[0] < -0.55)
        const dpadRight =
          isBtnPressed(gp.buttons[15]) ||
          (gp.axes[0] != null && gp.axes[0] > 0.55)

        if (now - lastNavTime > NAV_COOLDOWN) {
          if (dpadUp) {
            lastNavTime = now
            setFocusedIndex((idx) => {
              playConsoleSound('move')
              return (idx - 1 + MENU_ITEMS.length) % MENU_ITEMS.length
            })
            break
          } else if (dpadDown) {
            lastNavTime = now
            setFocusedIndex((idx) => {
              playConsoleSound('move')
              return (idx + 1) % MENU_ITEMS.length
            })
            break
          } else if (dpadLeft) {
            lastNavTime = now
            handleNextOptionRef.current(-1)
            break
          } else if (dpadRight) {
            lastNavTime = now
            handleNextOptionRef.current(1)
            break
          }
        }
      }

      rafId = requestAnimationFrame(pollGamepad)
    }

    rafId = requestAnimationFrame(pollGamepad)
    return () => cancelAnimationFrame(rafId)
  }, [layout])

  // ── Keyboard navigation ─────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setFocusedIndex((idx) => {
          playConsoleSound('move')
          return (idx - 1 + MENU_ITEMS.length) % MENU_ITEMS.length
        })
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setFocusedIndex((idx) => {
          playConsoleSound('move')
          return (idx + 1) % MENU_ITEMS.length
        })
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        handleNextOption(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        handleNextOption(1)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        handleNextOption(1)
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault()
        e.stopPropagation()
        playConsoleSound('back')
        onDismiss()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [handleNextOption, onDismiss])

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="ps5SoundModalOverlay" role="dialog" aria-modal="true">
      <div className="ps5SoundModalCard">
        {/* Header */}
        <div className="ps5SoundModalHeader">
          <div className="ps5SoundModalHeaderTitle">
            <VolumeUpOutlined className="ps5SoundModalHeaderIcon" />
            <div>
              <h2>{t('console.soundModal.title', 'CONFIGURAÇÕES DE SOM')}</h2>
              <small>
                {t(
                  'console.soundModal.subtitle',
                  'Ajuste usando o controle (D-Pad / A / B / Start) ou teclado'
                )}
              </small>
            </div>
          </div>
          <button
            type="button"
            className="ps5SoundModalCloseBtn"
            onClick={() => {
              playConsoleSound('back')
              onDismiss()
            }}
          >
            <Close />
          </button>
        </div>

        {/* Menu List */}
        <div className="ps5SoundModalBody">
          {MENU_ITEMS.map((item, idx) => {
            const isFocused = idx === focusedIndex

            return (
              <div
                key={item.id}
                ref={(el) => {
                  itemRefs.current[idx] = el
                }}
                className={classNames('ps5SoundRow', {
                  focused: isFocused,
                  disabled:
                    !enabled && item.id !== 'master' && item.id !== 'done'
                })}
                onClick={() => {
                  setFocusedIndex(idx)
                  handleNextOption(1)
                }}
              >
                <div className="ps5SoundRowLabel">
                  <strong>{t(item.labelKey, item.defaultLabel)}</strong>
                  {item.id === 'master' && (
                    <small>
                      {t(
                        'console.soundModal.masterDesc',
                        'Ativar ou mutar todos os sons do console'
                      )}
                    </small>
                  )}
                  {item.id === 'preset' && (
                    <small>
                      {t(
                        'console.soundModal.themeDesc',
                        'Escolha o tema principal dos efeitos sonoros'
                      )}
                    </small>
                  )}
                </div>

                <div className="ps5SoundRowValue">
                  {item.id === 'master' && (
                    <span
                      className={classNames('ps5PillBadge', {
                        active: enabled
                      })}
                    >
                      {enabled
                        ? t('console.soundModal.enabled', 'ATIVADO')
                        : t('console.soundModal.mutedAll', 'MUTADO')}
                    </span>
                  )}

                  {item.id === 'preset' && (
                    <span className="ps5PillValue">
                      ◄{' '}
                      {preset === 'steam'
                        ? 'Steam Big Picture'
                        : 'Retro Chiptune'}{' '}
                      ►
                    </span>
                  )}

                  {item.id === 'volume' && (
                    <div className="ps5VolumeControl">
                      <span className="ps5VolumeText">◄ {volume}% ►</span>
                      <div className="ps5VolumeTrack">
                        <div
                          className="ps5VolumeFill"
                          style={{ width: `${volume}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {item.id.startsWith('cue_') && (
                    <span className="ps5PillValue">
                      ◄{' '}
                      {
                        EVENT_SETTING_OPTIONS.find(
                          (o) =>
                            o.value ===
                            getCueValue(
                              item.id.replace('cue_', '') as ConsoleSoundEvent
                            )
                        )?.label
                      }{' '}
                      ►
                    </span>
                  )}

                  {item.id === 'done' && (
                    <span className="ps5ActionBtnText">
                      <Check style={{ fontSize: '1.1rem' }} />{' '}
                      {t('button.done', 'Concluído')}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Gamepad Hints */}
        <div className="ps5SoundModalFooter">
          <div className="ps5GamepadHints">
            <span className="ps5Hint">
              <kbd className="ps5Glyph">{actionLabel}</kbd>
              {t('console.soundModal.hintSelect', 'Selecionar / Alterar')}
            </span>
            <span className="ps5Hint">
              <kbd className="ps5Glyph">◄ ►</kbd>
              {t('console.soundModal.hintAdjust', 'Ajustar')}
            </span>
            <span className="ps5Hint">
              <kbd className="ps5Glyph">▲ ▼</kbd>
              {t('console.soundModal.hintNav', 'Navegar')}
            </span>
            <span className="ps5Hint">
              <kbd className="ps5Glyph">{backLabel}</kbd>
              {t('console.soundModal.hintBack', 'Salvar & Voltar')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
