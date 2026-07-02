import { detectOnsets, type Onset, type OnsetDetectionParams, type BandEnergy } from './onsetDetection'
import { estimateBPM } from './bpmEstimation'

export type SegmentType = 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro'

export interface MusicSegment {
  start: number
  end: number
  type: SegmentType
  energy: number
  densityMultiplier: number
}

export interface AudioAnalysis {
  onsets: Onset[]
  bpm: number
  bpmConfidence: number
  duration: number
  energyCurve: number[]
  segments: MusicSegment[]
}

export async function analyzeAudio(
  audioBuffer: AudioBuffer,
  params?: Partial<OnsetDetectionParams>
): Promise<AudioAnalysis> {
  const sampleRate = audioBuffer.sampleRate
  const channelCount = audioBuffer.numberOfChannels
  const length = audioBuffer.length
  const mono = new Float32Array(length)
  for (let ch = 0; ch < channelCount; ch++) {
    const data = audioBuffer.getChannelData(ch)
    for (let i = 0; i < length; i++)
      mono[i] += data[i] / channelCount
  }

  const onsets = detectOnsets(mono, { sampleRate, ...params })
  const bpmResult = estimateBPM(onsets)
  const energyCurve = computeEnergyCurve(mono, sampleRate)
  const segments = detectSegments(energyCurve, audioBuffer.duration, onsets)

  return {
    onsets, bpm: bpmResult.bpm, bpmConfidence: bpmResult.confidence,
    duration: audioBuffer.duration, energyCurve, segments,
  }
}

function computeEnergyCurve(signal: Float32Array, sampleRate: number): number[] {
  const winSize = sampleRate
  const curve: number[] = []
  for (let start = 0; start < signal.length; start += winSize) {
    const end = Math.min(start + winSize, signal.length)
    let sum = 0
    for (let i = start; i < end; i++) sum += signal[i] * signal[i]
    curve.push(Math.sqrt(sum / (end - start)))
  }
  const max = Math.max(...curve, 1)
  return curve.map((v) => v / max)
}

export type { Onset, OnsetDetectionParams, BandEnergy }

function detectSegments(
  energyCurve: number[], duration: number, _onsets: Onset[]
): MusicSegment[] {
  if (energyCurve.length === 0) {
    return [{ start: 0, end: duration, type: 'verse', energy: 0.5, densityMultiplier: 1.0 }]
  }

  const segLen = duration / energyCurve.length
  const windowSize = Math.max(3, Math.floor(energyCurve.length / 8))

  const avgEnergies: number[] = []
  for (let i = 0; i < energyCurve.length; i++) {
    let sum = 0, count = 0
    for (let j = Math.max(0, i - windowSize); j <= Math.min(energyCurve.length - 1, i + windowSize); j++) {
      sum += energyCurve[j]
      count++
    }
    avgEnergies.push(sum / count)
  }

  const boundaries: number[] = [0]
  const threshold = 0.15
  for (let i = windowSize; i < avgEnergies.length - windowSize; i++) {
    const before = avgEnergies[i - windowSize]
    const after = avgEnergies[i + windowSize]
    if (Math.abs(after - before) > threshold) {
      const t = i * segLen
      if (boundaries.length === 0 || t - boundaries[boundaries.length - 1] > 5) {
        boundaries.push(t)
      }
    }
  }
  boundaries.push(duration)

  const segments: MusicSegment[] = []
  const numSegs = boundaries.length - 1
  for (let i = 0; i < numSegs; i++) {
    const start = boundaries[i]
    const end = boundaries[i + 1]
    const segStartIdx = Math.floor(start / segLen)
    const segEndIdx = Math.floor(end / segLen)
    let energy = 0, count = 0
    for (let j = segStartIdx; j < Math.min(segEndIdx, energyCurve.length); j++) {
      energy += energyCurve[j]
      count++
    }
    energy = count > 0 ? energy / count : 0.5

    let type: SegmentType
    let densityMultiplier: number
    const position = numSegs === 1 ? 0.5 : i / (numSegs - 1)

    if (position < 0.12) {
      type = 'intro'; densityMultiplier = 0.5
    } else if (position > 0.88) {
      type = 'outro'; densityMultiplier = 0.6
    } else if (energy > 0.65) {
      type = 'chorus'; densityMultiplier = 1.2
    } else if (energy < 0.35) {
      type = 'bridge'; densityMultiplier = 0.7
    } else {
      type = 'verse'; densityMultiplier = 1.0
    }

    segments.push({ start, end, type, energy, densityMultiplier })
  }

  return segments
}
