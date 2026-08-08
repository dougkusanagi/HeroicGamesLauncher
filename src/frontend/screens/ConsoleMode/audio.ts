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
const MOVE_COOLDOWN_MS = 42

const tones: Record<ConsoleSound, Tone[]> = {
  move: [
    {
      at: 0,
      duration: 0.055,
      from: 520,
      to: 680,
      gain: 0.34
    }
  ],
  confirm: [
    {
      at: 0,
      duration: 0.075,
      from: 470,
      to: 650,
      gain: 0.32
    },
    {
      at: 0.045,
      duration: 0.11,
      from: 720,
      to: 980,
      gain: 0.25
    }
  ],
  launch: [
    {
      at: 0,
      duration: 0.12,
      from: 220,
      to: 360,
      gain: 0.32,
      type: 'triangle'
    },
    {
      at: 0.06,
      duration: 0.16,
      from: 400,
      to: 740,
      gain: 0.28
    },
    {
      at: 0.12,
      duration: 0.22,
      from: 680,
      to: 1150,
      gain: 0.22
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
let lastMoveAt = 0

function getAudioContext() {
  if (typeof window === 'undefined' || !window.AudioContext) return null
  if (!audioContext) {
    audioContext = new window.AudioContext()
    masterNode = audioContext.createGain()
    masterNode.gain.value = MASTER_GAIN
    masterNode.connect(audioContext.destination)
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
 * Small, synthesized UI cues keep console mode responsive without adding
 * copyrighted or platform-specific sound assets.
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
