import { Onset, BandEnergy, detectOnsets, OnsetDetectionParams } from './onsetDetection'
import { estimateBPM, BPMResult } from './bpmEstimation'

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
  const sampleRate = audio.sampleRate
  const channelCount = audio.numberOfChannels
  const length = audio.length
  const mono = new Float32Array(length)
  for (let ch = 0; ch < channelCount; ch++) {
    const data = audio.channelData[ch]
    for (let i = 0; i < length; i++)
      mono[i] += data[i] / channelCount
  }

  const detectParams: OnsetDetectionParams = {
    sampleRate: sampleRate,
    fftSize: 2048,
    hopSize: 512,
    thresholdStdScale: 0.78,
    thresholdFloor: 0.043,
    minOnsetInterval: 0.05
  }

  const onsets = detectOnsets(mono, detectParams)
  const bpmResult = estimateBPM(onsets)
  const energyCurve = computeEnergyCurve(mono, sampleRate)
  const segments = detectSegments(energyCurve, audio.duration, onsets)

  const result = new AudioAnalysis()
  result.onsets = onsets
  result.bpm = bpmResult.bpm
  result.bpmConfidence = bpmResult.confidence
  result.duration = audio.duration
  result.energyCurve = energyCurve
  result.segments = segments
  return result
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
  let max = 0
  for (const v of curve) if (v > max) max = v
  if (max < 1) max = 1
  return curve.map((v) => v / max)
}

function detectSegments(
  energyCurve: number[], duration: number, _onsets: Onset[]
): MusicSegment[] {
  if (energyCurve.length === 0) {
    const seg = new MusicSegment()
    seg.start = 0; seg.end = duration; seg.type = SegmentType.Verse
    seg.energy = 0.5; seg.densityMultiplier = 1.0
    return [seg]
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
      type = SegmentType.Intro; densityMultiplier = 0.5
    } else if (position > 0.88) {
      type = SegmentType.Outro; densityMultiplier = 0.6
    } else if (energy > 0.65) {
      type = SegmentType.Chorus; densityMultiplier = 1.2
    } else if (energy < 0.35) {
      type = SegmentType.Bridge; densityMultiplier = 0.7
    } else {
      type = SegmentType.Verse; densityMultiplier = 1.0
    }

    const seg = new MusicSegment()
    seg.start = start; seg.end = end; seg.type = type
    seg.energy = energy; seg.densityMultiplier = densityMultiplier
    segments.push(seg)
  }

  return segments
}
