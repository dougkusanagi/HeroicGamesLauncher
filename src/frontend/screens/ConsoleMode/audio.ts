type ConsoleSound = 'move' | 'confirm' | 'launch' | 'back' | 'filter' | 'sort'

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

type Noise = {
  at: number
  duration: number
  gain: number
  filterFrom: number
  filterTo: number
}

const MASTER_GAIN = 0.12
const MOVE_COOLDOWN_MS = 72

const tones: Record<ConsoleSound, Tone[]> = {
  move: [
    {
      at: 0,
      duration: 0.075,
      from: 520,
      to: 610,
      gain: 0.17,
      filterFrom: 2200,
      filterTo: 3000,
      type: 'sine'
    },
    {
      at: 0.018,
      duration: 0.135,
      from: 780,
      to: 920,
      gain: 0.09,
      filterFrom: 2800,
      filterTo: 3600,
      type: 'triangle'
    }
  ],
  confirm: [
    {
      at: 0,
      duration: 0.1,
      from: 430,
      to: 520,
      gain: 0.2,
      filterFrom: 2200,
      filterTo: 3000,
      type: 'triangle'
    },
    {
      at: 0.055,
      duration: 0.17,
      from: 650,
      to: 780,
      gain: 0.13,
      filterFrom: 2600,
      filterTo: 3600
    },
    {
      at: 0.12,
      duration: 0.23,
      from: 975,
      to: 1170,
      gain: 0.065,
      filterFrom: 3000,
      filterTo: 4200
    }
  ],
  launch: [
    {
      at: 0,
      duration: 0.3,
      from: 98,
      to: 131,
      gain: 0.15,
      filterFrom: 900,
      filterTo: 1300,
      type: 'triangle'
    },
    {
      at: 0.035,
      duration: 0.43,
      from: 196,
      to: 233,
      gain: 0.105,
      filterFrom: 1500,
      filterTo: 2300
    },
    {
      at: 0.08,
      duration: 0.52,
      from: 294,
      to: 349,
      gain: 0.105,
      filterFrom: 1800,
      filterTo: 2900,
      type: 'triangle'
    },
    {
      at: 0.15,
      duration: 0.64,
      from: 392,
      to: 466,
      gain: 0.09,
      filterFrom: 2200,
      filterTo: 3400
    },
    {
      at: 0.23,
      duration: 0.76,
      from: 587,
      to: 698,
      gain: 0.07,
      filterFrom: 2600,
      filterTo: 4000
    },
    {
      at: 0.4,
      duration: 0.78,
      from: 784,
      to: 932,
      gain: 0.045,
      filterFrom: 3000,
      filterTo: 4600
    },
    {
      at: 0.52,
      duration: 0.72,
      from: 1046,
      to: 1046,
      gain: 0.04,
      filterFrom: 3200,
      filterTo: 4200
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

const noise: Partial<Record<ConsoleSound, Noise[]>> = {
  launch: [
    {
      at: 0.12,
      duration: 0.86,
      gain: 0.035,
      filterFrom: 700,
      filterTo: 3600
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
  oscillator.frequency.exponentialRampToValueAtTime(tone.to, end)

  filter.type = 'lowpass'
  filter.Q.value = 0.55
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

function playNoise(context: AudioContext, master: GainNode, effect: Noise) {
  const sampleCount = Math.ceil(context.sampleRate * effect.duration)
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate)
  const samples = buffer.getChannelData(0)

  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = Math.random() * 2 - 1
  }

  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const envelope = context.createGain()
  const start = context.currentTime + effect.at
  const end = start + effect.duration

  filter.type = 'lowpass'
  filter.Q.value = 0.35
  filter.frequency.setValueAtTime(effect.filterFrom, start)
  filter.frequency.exponentialRampToValueAtTime(effect.filterTo, end)

  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(effect.gain, start + 0.08)
  envelope.gain.exponentialRampToValueAtTime(0.0001, end)

  source.buffer = buffer
  source.connect(filter)
  filter.connect(envelope)
  envelope.connect(master)
  source.start(start)
  source.stop(end + 0.02)
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
  for (const effect of noise[sound] ?? [])
    playNoise(context, masterNode, effect)
}
