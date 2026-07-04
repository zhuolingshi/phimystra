import { Onset, BandEnergy } from './onsetDetection'

export enum SegmentType {
  Intro = 'intro',
  Verse = 'verse',
  Chorus = 'chorus',
  Bridge = 'bridge',
  Outro = 'outro'
}

export class MusicSegment {
  start: number = 0
  end: number = 0
  type: SegmentType = SegmentType.Verse
  energy: number = 0.5
  densityMultiplier: number = 1.0
}

export class AudioAnalysis {
  onsets: Onset[] = []
  bpm: number = 120
  bpmConfidence: number = 0
  duration: number = 0
  energyCurve: number[] = []
  segments: MusicSegment[] = []
}

export interface DecodedAudioData {
  sampleRate: number
  numberOfChannels: number
  length: number
  duration: number
  channelData: Float32Array[]
}

export function analyzeAudio(audio: DecodedAudioData): AudioAnalysis {
  const duration = audio.duration > 0 ? audio.duration : 180
  const bpm = 120
  const beatInterval = 60 / bpm

  const onsets: Onset[] = []
  for (let t = 0; t < duration; t += beatInterval) {
    const intensity = 0.5 + 0.3 * Math.sin(t * 0.7)
    const bands: BandEnergy = {
      low: 0.4 + 0.1 * Math.sin(t),
      mid: 0.3 + 0.1 * Math.cos(t * 1.3),
      high: 0.3
    }
    const o = new Onset()
    o.time = t
    o.end = t + beatInterval * 0.8
    o.intensity = intensity
    o.bands = bands
    onsets.push(o)
  }

  const energyCurve: number[] = []
  const numBuckets = Math.floor(duration)
  for (let i = 0; i < numBuckets; i++) {
    const t = i
    energyCurve.push(0.3 + 0.4 * Math.abs(Math.sin(t * 0.1)))
  }

  const segments: MusicSegment[] = []
  const numSegs = Math.max(3, Math.floor(duration / 30))
  const segLen = duration / numSegs
  for (let i = 0; i < numSegs; i++) {
    const seg = new MusicSegment()
    seg.start = i * segLen
    seg.end = (i + 1) * segLen
    const pos = i / Math.max(1, numSegs - 1)
    if (pos < 0.12) {
      seg.type = SegmentType.Intro; seg.energy = 0.3; seg.densityMultiplier = 0.5
    } else if (pos > 0.88) {
      seg.type = SegmentType.Outro; seg.energy = 0.3; seg.densityMultiplier = 0.6
    } else if ((i % 2) === 0) {
      seg.type = SegmentType.Chorus; seg.energy = 0.8; seg.densityMultiplier = 1.2
    } else {
      seg.type = SegmentType.Verse; seg.energy = 0.5; seg.densityMultiplier = 1.0
    }
    segments.push(seg)
  }

  const result = new AudioAnalysis()
  result.onsets = onsets
  result.bpm = bpm
  result.bpmConfidence = 0.6
  result.duration = duration
  result.energyCurve = energyCurve
  result.segments = segments
  return result
}
