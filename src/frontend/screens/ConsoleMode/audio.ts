import type {
  AppSettings,
  ConsoleSoundCustomEvents,
  ConsoleSoundEvent,
  ConsoleSoundEventSetting
} from 'common/types'

type ConsoleSound = ConsoleSoundEvent
export type SoundPreset = 'steam' | 'chiptune'

type Tone = {
  at: number
  duration: number
  from: number
  to: number
  gain: number
  type?: OscillatorType
  filterFrom?: number
  filterTo?: number
  attack?: number
  release?: number
  pan?: number
}

const MASTER_GAIN = 0.1
const DEFAULT_SOUND_VOLUME = 70
const MOVE_COOLDOWN_MS = 72

type ConsoleSoundPreferences = Pick<
  AppSettings,
  | 'consoleSoundEnabled'
  | 'consoleSoundVolume'
  | 'consoleSoundPreset'
  | 'consoleSoundCustomEvents'
>

const chiptuneTones: Record<ConsoleSound, Tone[]> = {
  move: [
    {
      at: 0,
      duration: 0.085,
      from: 523.25,
      to: 535,
      gain: 0.14,
      filterFrom: 1500,
      filterTo: 2100,
      attack: 0.004,
      release: 0.065,
      pan: -0.08,
      type: 'square'
    },
    {
      at: 0.038,
      duration: 0.11,
      from: 783.99,
      to: 795,
      gain: 0.105,
      filterFrom: 1700,
      filterTo: 2500,
      attack: 0.004,
      release: 0.08,
      pan: 0.06,
      type: 'square'
    },
    {
      at: 0.078,
      duration: 0.17,
      from: 1046.5,
      to: 1058,
      gain: 0.05,
      filterFrom: 2200,
      filterTo: 3000,
      release: 0.12,
      type: 'triangle'
    }
  ],
  confirm: [
    {
      at: 0,
      duration: 0.1,
      from: 523.25,
      to: 535,
      gain: 0.15,
      filterFrom: 1600,
      filterTo: 2300,
      type: 'square'
    },
    {
      at: 0.055,
      duration: 0.14,
      from: 659.25,
      to: 670,
      gain: 0.12,
      filterFrom: 1800,
      filterTo: 2600,
      pan: 0.04,
      type: 'square'
    },
    {
      at: 0.12,
      duration: 0.22,
      from: 783.99,
      to: 796,
      gain: 0.09,
      filterFrom: 2200,
      filterTo: 3200,
      release: 0.14,
      pan: -0.04,
      type: 'triangle'
    }
  ],
  launch: [
    {
      at: 0,
      duration: 0.38,
      from: 130.81,
      to: 130.81,
      gain: 0.13,
      filterFrom: 700,
      filterTo: 1100,
      type: 'triangle'
    },
    {
      at: 0.02,
      duration: 0.18,
      from: 261.63,
      to: 266,
      gain: 0.095,
      filterFrom: 1300,
      filterTo: 1900,
      pan: -0.08,
      type: 'square'
    },
    {
      at: 0.11,
      duration: 0.2,
      from: 329.63,
      to: 334,
      gain: 0.09,
      filterFrom: 1500,
      filterTo: 2200,
      pan: 0.08,
      type: 'square'
    },
    {
      at: 0.2,
      duration: 0.23,
      from: 392,
      to: 397,
      gain: 0.085,
      filterFrom: 1700,
      filterTo: 2500,
      pan: -0.06,
      type: 'square'
    },
    {
      at: 0.31,
      duration: 0.27,
      from: 523.25,
      to: 529,
      gain: 0.08,
      filterFrom: 1900,
      filterTo: 2800,
      pan: 0.06,
      type: 'square'
    },
    {
      at: 0.43,
      duration: 0.31,
      from: 659.25,
      to: 666,
      gain: 0.07,
      filterFrom: 2200,
      filterTo: 3100,
      pan: -0.04,
      type: 'square'
    },
    {
      at: 0.55,
      duration: 0.38,
      from: 783.99,
      to: 792,
      gain: 0.06,
      filterFrom: 2400,
      filterTo: 3400,
      pan: 0.04,
      type: 'square'
    },
    {
      at: 0.67,
      duration: 0.62,
      from: 1046.5,
      to: 1046.5,
      gain: 0.065,
      filterFrom: 2600,
      filterTo: 3600,
      release: 0.2,
      type: 'triangle'
    },
    {
      at: 0.67,
      duration: 0.64,
      from: 523.25,
      to: 523.25,
      gain: 0.035,
      filterFrom: 2200,
      filterTo: 3200,
      release: 0.2,
      pan: -0.08,
      type: 'sine'
    },
    {
      at: 0.67,
      duration: 0.64,
      from: 659.25,
      to: 659.25,
      gain: 0.032,
      filterFrom: 2400,
      filterTo: 3400,
      release: 0.2,
      pan: 0.08,
      type: 'sine'
    }
  ],
  back: [
    {
      at: 0,
      duration: 0.08,
      from: 650,
      to: 430,
      gain: 0.28
    },
    {
      at: 0.04,
      duration: 0.12,
      from: 450,
      to: 250,
      gain: 0.2
    }
  ],
  filter: [
    {
      at: 0,
      duration: 0.07,
      from: 580,
      to: 760,
      gain: 0.24
    },
    {
      at: 0.045,
      duration: 0.09,
      from: 820,
      to: 1040,
      gain: 0.2
    }
  ],
  sort: [
    {
      at: 0,
      duration: 0.06,
      from: 730,
      to: 870,
      gain: 0.22
    },
    {
      at: 0.04,
      duration: 0.08,
      from: 870,
      to: 1080,
      gain: 0.18
    }
  ]
}

/** Steam Big Picture inspired warm, acoustic/ambient synthesized sound profile */
const steamTones: Record<ConsoleSound, Tone[]> = {
  move: [
    {
      at: 0,
      duration: 0.055,
      from: 260,
      to: 340,
      gain: 0.18,
      filterFrom: 800,
      filterTo: 1400,
      attack: 0.003,
      release: 0.04,
      type: 'sine'
    },
    {
      at: 0,
      duration: 0.045,
      from: 140,
      to: 170,
      gain: 0.1,
      filterFrom: 400,
      filterTo: 800,
      attack: 0.003,
      release: 0.035,
      type: 'sine'
    }
  ],
  confirm: [
    {
      at: 0,
      duration: 0.14,
      from: 392,
      to: 523.25,
      gain: 0.16,
      filterFrom: 1800,
      filterTo: 2800,
      attack: 0.005,
      release: 0.1,
      type: 'sine'
    },
    {
      at: 0.04,
      duration: 0.2,
      from: 523.25,
      to: 659.25,
      gain: 0.13,
      filterFrom: 2200,
      filterTo: 3200,
      attack: 0.005,
      release: 0.14,
      pan: 0.06,
      type: 'sine'
    },
    {
      at: 0.08,
      duration: 0.28,
      from: 783.99,
      to: 1046.5,
      gain: 0.07,
      filterFrom: 2600,
      filterTo: 3800,
      attack: 0.005,
      release: 0.2,
      pan: -0.06,
      type: 'sine'
    }
  ],
  launch: [
    {
      at: 0,
      duration: 0.6,
      from: 65.41,
      to: 130.81,
      gain: 0.22,
      filterFrom: 250,
      filterTo: 700,
      attack: 0.02,
      release: 0.35,
      type: 'sine'
    },
    {
      at: 0.05,
      duration: 0.5,
      from: 261.63,
      to: 392.0,
      gain: 0.14,
      filterFrom: 1200,
      filterTo: 2200,
      attack: 0.015,
      release: 0.3,
      pan: -0.08,
      type: 'sine'
    },
    {
      at: 0.12,
      duration: 0.55,
      from: 392.0,
      to: 523.25,
      gain: 0.12,
      filterFrom: 1600,
      filterTo: 2800,
      attack: 0.015,
      release: 0.35,
      pan: 0.08,
      type: 'sine'
    },
    {
      at: 0.22,
      duration: 0.65,
      from: 523.25,
      to: 783.99,
      gain: 0.1,
      filterFrom: 2000,
      filterTo: 3400,
      attack: 0.015,
      release: 0.4,
      pan: -0.05,
      type: 'sine'
    },
    {
      at: 0.35,
      duration: 0.75,
      from: 1046.5,
      to: 1046.5,
      gain: 0.08,
      filterFrom: 2400,
      filterTo: 4000,
      attack: 0.01,
      release: 0.5,
      pan: 0.05,
      type: 'sine'
    }
  ],
  back: [
    {
      at: 0,
      duration: 0.1,
      from: 523.25,
      to: 392.0,
      gain: 0.16,
      filterFrom: 1600,
      filterTo: 1000,
      attack: 0.004,
      release: 0.07,
      type: 'sine'
    },
    {
      at: 0.035,
      duration: 0.13,
      from: 392.0,
      to: 261.63,
      gain: 0.12,
      filterFrom: 1200,
      filterTo: 700,
      attack: 0.004,
      release: 0.09,
      type: 'sine'
    }
  ],
  filter: [
    {
      at: 0,
      duration: 0.07,
      from: 349.23,
      to: 440.0,
      gain: 0.15,
      filterFrom: 1400,
      filterTo: 2200,
      type: 'sine'
    },
    {
      at: 0.03,
      duration: 0.09,
      from: 440.0,
      to: 554.37,
      gain: 0.12,
      filterFrom: 1800,
      filterTo: 2600,
      type: 'sine'
    }
  ],
  sort: [
    {
      at: 0,
      duration: 0.06,
      from: 440.0,
      to: 554.37,
      gain: 0.14,
      filterFrom: 1600,
      filterTo: 2400,
      type: 'sine'
    },
    {
      at: 0.03,
      duration: 0.08,
      from: 554.37,
      to: 659.25,
      gain: 0.11,
      filterFrom: 2000,
      filterTo: 2800,
      type: 'sine'
    }
  ]
}

const soundProfiles: Record<SoundPreset, Record<ConsoleSound, Tone[]>> = {
  steam: steamTones,
  chiptune: chiptuneTones
}

let audioContext: AudioContext | null = null
let masterNode: GainNode | null = null
let outputNode: DynamicsCompressorNode | null = null
let lastMoveAt = 0
let consoleSoundEnabled = true
let consoleSoundVolume = DEFAULT_SOUND_VOLUME / 100
let consoleSoundPreset: SoundPreset = 'steam'
let consoleSoundCustomEvents: ConsoleSoundCustomEvents = {}
let soundPreferencesLoaded = false
let soundPreferencesRequest: Promise<void> | null = null

function clampSoundVolume(volume: number) {
  return Math.max(0, Math.min(100, volume)) / 100
}

export function setConsoleSoundPreferences(
  preferences: Partial<ConsoleSoundPreferences>
) {
  if (preferences.consoleSoundEnabled !== undefined) {
    consoleSoundEnabled = preferences.consoleSoundEnabled
  }
  if (preferences.consoleSoundVolume !== undefined) {
    consoleSoundVolume = clampSoundVolume(preferences.consoleSoundVolume)
  }
  if (preferences.consoleSoundPreset !== undefined) {
    consoleSoundPreset = preferences.consoleSoundPreset
  }
  if (preferences.consoleSoundCustomEvents !== undefined) {
    consoleSoundCustomEvents = preferences.consoleSoundCustomEvents
  }

  if (masterNode && audioContext) {
    masterNode.gain.setTargetAtTime(
      MASTER_GAIN * consoleSoundVolume,
      audioContext.currentTime,
      0.015
    )
  }
}

/** Load persisted preferences once without delaying the first UI cue. */
export function loadConsoleSoundPreferences() {
  if (
    soundPreferencesLoaded ||
    soundPreferencesRequest ||
    typeof window === 'undefined' ||
    !window.api
  ) {
    return
  }

  soundPreferencesRequest = window.api
    .requestAppSettings()
    .then((settings) => {
      setConsoleSoundPreferences({
        consoleSoundEnabled: settings.consoleSoundEnabled ?? true,
        consoleSoundVolume: settings.consoleSoundVolume ?? DEFAULT_SOUND_VOLUME,
        consoleSoundPreset: settings.consoleSoundPreset ?? 'steam',
        consoleSoundCustomEvents: settings.consoleSoundCustomEvents ?? {}
      })
    })
    .catch(() => undefined)
    .finally(() => {
      soundPreferencesLoaded = true
      soundPreferencesRequest = null
    })
}

function getAudioContext() {
  if (typeof window === 'undefined' || !window.AudioContext) return null
  if (!audioContext) {
    audioContext = new window.AudioContext()
    masterNode = audioContext.createGain()
    masterNode.gain.value = MASTER_GAIN * consoleSoundVolume
    outputNode = audioContext.createDynamicsCompressor()
    outputNode.threshold.value = -25
    outputNode.knee.value = 18
    outputNode.ratio.value = 3
    outputNode.attack.value = 0.004
    outputNode.release.value = 0.18
    const delayNode = audioContext.createDelay(0.6)
    const delayFeedback = audioContext.createGain()
    const delayWet = audioContext.createGain()
    delayNode.delayTime.value = 0.17
    delayFeedback.gain.value = 0.2
    delayWet.gain.value = 0.16

    masterNode.connect(outputNode)
    masterNode.connect(delayNode)
    delayNode.connect(delayFeedback)
    delayFeedback.connect(delayNode)
    delayNode.connect(delayWet)
    delayWet.connect(outputNode)
    outputNode.connect(audioContext.destination)
  }
  return audioContext
}

function playTone(context: AudioContext, master: GainNode, tone: Tone) {
  const oscillator = context.createOscillator()
  const filter = context.createBiquadFilter()
  const panner = context.createStereoPanner()
  const envelope = context.createGain()
  const start = context.currentTime + tone.at
  const end = start + tone.duration
  const attack = Math.min(tone.attack ?? 0.012, tone.duration * 0.3)
  const release = Math.min(tone.release ?? 0.09, tone.duration * 0.45)
  const sustainEnd = Math.max(start + attack, end - release)

  oscillator.type = tone.type ?? 'sine'
  oscillator.frequency.setValueAtTime(tone.from, start)
  if (tone.from === tone.to) {
    oscillator.frequency.setValueAtTime(tone.to, end)
  } else {
    oscillator.frequency.exponentialRampToValueAtTime(tone.to, end)
  }

  filter.type = 'lowpass'
  filter.Q.value = 0.7
  filter.frequency.setValueAtTime(tone.filterFrom ?? 3200, start)
  filter.frequency.exponentialRampToValueAtTime(tone.filterTo ?? 4200, end)

  panner.pan.value = tone.pan ?? 0
  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(tone.gain, start + attack)
  envelope.gain.setValueAtTime(tone.gain, sustainEnd)
  envelope.gain.exponentialRampToValueAtTime(0.0001, end)

  oscillator.connect(filter)
  filter.connect(panner)
  panner.connect(envelope)
  envelope.connect(master)
  oscillator.start(start)
  oscillator.stop(end + 0.02)
}

export function playConsoleSound(sound: ConsoleSound) {
  loadConsoleSoundPreferences()
  if (!consoleSoundEnabled || consoleSoundVolume <= 0) return

  const customEventSetting: ConsoleSoundEventSetting =
    consoleSoundCustomEvents[sound] || 'inherit'
  if (customEventSetting === 'muted') return

  const activePreset: SoundPreset =
    customEventSetting === 'steam' || customEventSetting === 'chiptune'
      ? customEventSetting
      : consoleSoundPreset

  const profileTones = soundProfiles[activePreset] || soundProfiles.steam
  const activeTones = profileTones[sound]
  if (!activeTones || activeTones.length === 0) return

  const now = performance.now()
  if (sound === 'move' && now - lastMoveAt < MOVE_COOLDOWN_MS) return
  if (sound === 'move') lastMoveAt = now

  const context = getAudioContext()
  if (!context || !masterNode) return

  void context.resume().catch(() => {})
  for (const tone of activeTones) playTone(context, masterNode, tone)
}
