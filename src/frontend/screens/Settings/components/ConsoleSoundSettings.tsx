import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { ToggleSwitch } from 'frontend/components/UI'
import SliderField from 'frontend/components/UI/SliderField'
import { setConsoleSoundPreferences } from 'frontend/screens/ConsoleMode/audio'
import useSetting from 'frontend/hooks/useSetting'

const ConsoleSoundSettings = () => {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useSetting('consoleSoundEnabled', true)
  const [volume, setVolume] = useSetting('consoleSoundVolume', 70)

  useEffect(() => {
    setConsoleSoundPreferences({
      consoleSoundEnabled: enabled,
      consoleSoundVolume: volume
    })
  }, [enabled, volume])

  return (
    <div
      tabIndex={-1}
      style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}
    >
      <ToggleSwitch
        htmlId="consoleSoundEnabled"
        value={enabled}
        handleChange={() => setEnabled(!enabled)}
        title={t('setting.console-sound-enabled', 'Enable Console Mode sounds')}
      />
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
    </div>
  )
}

export default ConsoleSoundSettings
