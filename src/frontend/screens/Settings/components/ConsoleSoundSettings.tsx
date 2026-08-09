import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuItem, type SelectChangeEvent } from '@mui/material'

import { SelectField, ToggleSwitch } from 'frontend/components/UI'
import SliderField from 'frontend/components/UI/SliderField'
import {
  playConsoleSound,
  setConsoleSoundPreferences,
  type SoundPreset
} from 'frontend/screens/ConsoleMode/audio'
import useSetting from 'frontend/hooks/useSetting'
import type {
  ConsoleSoundCustomEvents,
  ConsoleSoundEvent,
  ConsoleSoundEventSetting
} from 'common/types'

const SOUND_EVENTS: { key: ConsoleSoundEvent; label: string }[] = [
  { key: 'move', label: 'Navigation / Move' },
  { key: 'confirm', label: 'Confirm / Action' },
  { key: 'launch', label: 'Launch Game' },
  { key: 'back', label: 'Back / Cancel' },
  { key: 'filter', label: 'Switch Filter' },
  { key: 'sort', label: 'Change Sort' }
]

const ConsoleSoundSettings = () => {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useSetting('consoleSoundEnabled', true)
  const [volume, setVolume] = useSetting('consoleSoundVolume', 70)
  const [preset, setPreset] = useSetting('consoleSoundPreset', 'steam')
  const [customEvents, setCustomEvents] = useSetting(
    'consoleSoundCustomEvents',
    {} as ConsoleSoundCustomEvents
  )

  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    setConsoleSoundPreferences({
      consoleSoundEnabled: enabled,
      consoleSoundVolume: volume,
      consoleSoundPreset: preset as SoundPreset,
      consoleSoundCustomEvents: customEvents
    })
  }, [enabled, volume, preset, customEvents])

  const onPresetChange = (e: SelectChangeEvent) => {
    const newPreset = e.target.value as SoundPreset
    setPreset(newPreset)
    playConsoleSound('confirm')
  }

  const handleCustomEventChange = (
    eventKey: ConsoleSoundEvent,
    setting: ConsoleSoundEventSetting
  ) => {
    const updated: ConsoleSoundCustomEvents = {
      ...customEvents,
      [eventKey]: setting
    }
    setCustomEvents(updated)
    setConsoleSoundPreferences({ consoleSoundCustomEvents: updated })
    if (setting !== 'muted') {
      playConsoleSound(eventKey)
    }
  }

  return (
    <div
      tabIndex={-1}
      style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, gap: 16 }}
    >
      <ToggleSwitch
        htmlId="consoleSoundEnabled"
        value={enabled}
        handleChange={() => {
          setEnabled(!enabled)
          if (!enabled) playConsoleSound('confirm')
        }}
        title={t(
          'setting.console-sound-enabled',
          'Enable Console Mode sounds (Master Mute)'
        )}
      />

      <SelectField
        label={t('setting.console-sound-preset', 'Console Mode Sound Theme')}
        htmlId="consoleSoundPreset"
        value={preset ?? 'steam'}
        disabled={!enabled}
        onChange={onPresetChange}
      >
        <MenuItem value="steam">
          {t(
            'setting.console-sound-preset.steam',
            'Steam Big Picture (Ambient)'
          )}
        </MenuItem>
        <MenuItem value="chiptune">
          {t('setting.console-sound-preset.chiptune', 'Retro Chiptune')}
        </MenuItem>
      </SelectField>

      <SliderField
        htmlId="consoleSoundVolume"
        value={volume}
        min={0}
        max={100}
        step={5}
        disabled={!enabled}
        onChange={setVolume}
        label={t('setting.console-sound-volume', 'Console Mode sound volume')}
        marks={[
          { value: 0, label: '0%' },
          { value: 70, label: '70%' },
          { value: 100, label: '100%' }
        ]}
      />

      <div style={{ marginTop: 4 }}>
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent, #ff8500)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            padding: 0
          }}
        >
          {showAdvanced
            ? t(
                'setting.console-sound.hide-individual',
                '▼ Hide Individual Sound Customization'
              )
            : t(
                'setting.console-sound.show-individual',
                '▶ Customize Individual Sounds'
              )}
        </button>
      </div>

      {showAdvanced && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
            padding: 14,
            borderRadius: 8,
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          {SOUND_EVENTS.map(({ key, label }) => {
            const currentValue = customEvents?.[key] || 'inherit'
            return (
              <SelectField
                key={key}
                label={t(`setting.console-sound-cue.${key}`, label)}
                htmlId={`consoleSoundCue_${key}`}
                value={currentValue}
                disabled={!enabled}
                onChange={(e) =>
                  handleCustomEventChange(
                    key,
                    e.target.value as ConsoleSoundEventSetting
                  )
                }
              >
                <MenuItem value="inherit">
                  {t('setting.console-sound-option.inherit', 'Theme Default')}
                </MenuItem>
                <MenuItem value="steam">
                  {t('setting.console-sound-option.steam', 'Steam Big Picture')}
                </MenuItem>
                <MenuItem value="chiptune">
                  {t('setting.console-sound-option.chiptune', 'Retro Chiptune')}
                </MenuItem>
                <MenuItem value="muted">
                  {t('setting.console-sound-option.muted', '🔇 Muted')}
                </MenuItem>
              </SelectField>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ConsoleSoundSettings
