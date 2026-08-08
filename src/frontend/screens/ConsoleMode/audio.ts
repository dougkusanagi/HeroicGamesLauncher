type ConsoleSound = 'move' | 'confirm' | 'launch' | 'back' | 'filter' | 'sort'

type Tone = {
  at: number
  duration: number
  from: number
  to: number
  gain: number
  type?: OscillatorType
}

const MASTER_GAIN = 0.12
const MOVE_COOLDOWN_MS = 72

const tones: Record<ConsoleSound, Tone[]> = {
  move: [
    {
      at: 0,
      duration: 0.085,
      from: 430,
      to: 540,
      gain: 0.22,
      type: 'triangle'
    },
    {
      at: 0.012,
      duration: 0.12,
      from: 760,
      to: 1060,
      gain: 0.14
    },
    {
      at: 0.035,
      duration: 0.14,
      from: 1180,
      to: 1480,
      gain: 0.055
    }
  ],
  confirm: [
    {
      at: 0,
      duration: 0.095,
      from: 430,
      to: 600,
      gain: 0.24,
      type: 'triangle'
    },
    {
      at: 0.055,
      duration: 0.16,
      from: 680,
      to: 940,
      gain: 0.17
    },
    {
      at: 0.09,
      duration: 0.19,
      from: 960,
      to: 1240,
      gain: 0.08
    }
  ],
  launch: [
    {
      at: 0,
      duration: 0.34,
      from: 105,
      to: 170,
      gain: 0.2,
      type: 'triangle'
    },
    {
      at: 0.035,
      duration: 0.43,
      from: 220,
      to: 420,
      gain: 0.16
    },
    {
      at: 0.105,
      duration: 0.56,
      from: 420,
      to: 860,
      gain: 0.14,
      type: 'triangle'
    },
    {
      at: 0.17,
      duration: 0.66,
      from: 720,
      to: 1420,
      gain: 0.1
    },
    {
      at: 0.32,
      duration: 0.55,
      from: 1040,
      to: 1580,
      gain: 0.065
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

let audioContext: AudioContext | null = null
let masterNode: GainNode | null = null
let outputNode: DynamicsCompressorNode | null = null
let lastMoveAt = 0

function getAudioContext() {
  if (typeof window === 'undefined' || !window.AudioContext) return null
  if (!audioContext) {
    audioContext = new window.AudioContext()
    masterNode = audioContext.createGain()
    masterNode.gain.value = MASTER_GAIN
    outputNode = audioContext.createDynamicsCompressor()
    outputNode.threshold.value = -25
    outputNode.knee.value = 18
    outputNode.ratio.value = 3
    outputNode.attack.value = 0.004
    outputNode.release.value = 0.18
    masterNode.connect(outputNode)
    outputNode.connect(audioContext.destination)
  }
  return audioContext
}

function playTone(context: AudioContext, master: GainNode, tone: Tone) {
  const oscillator = context.createOscillator()
  const envelope = context.createGain()
  const start = context.currentTime + tone.at
  const end = start + tone.duration

  oscillator.type = tone.type ?? 'sine'
  oscillator.frequency.setValueAtTime(tone.from, start)
  oscillator.frequency.exponentialRampToValueAtTime(tone.to, end)

  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(tone.gain, start + 0.008)
  envelope.gain.exponentialRampToValueAtTime(0.0001, end)

  oscillator.connect(envelope)
  envelope.connect(master)
  oscillator.start(start)
  oscillator.stop(end + 0.02)
}

/**
 * Layered, synthesized UI cues keep console mode responsive without adding
 * copyrighted or platform-specific sound assets. Selection is deliberately
 * short; launch has a longer, gently rising tail so it feels like a transition
 * instead of a single confirmation beep.
 */
export function playConsoleSound(sound: ConsoleSound) {
  const now = performance.now()
  if (sound === 'move' && now - lastMoveAt < MOVE_COOLDOWN_MS) return
  if (sound === 'move') lastMoveAt = now

  const context = getAudioContext()
  if (!context || !masterNode) return

  void context.resume().catch(() => {})
  for (const tone of tones[sound]) playTone(context, masterNode, tone)
}
