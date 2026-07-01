import { detectOnsets, type Onset, type OnsetDetectionParams } from './onsetDetection'
import { estimateBPM } from './bpmEstimation'

export interface AudioAnalysis {
  onsets: Onset[]
  bpm: number
  bpmConfidence: number
  duration: number
  energyCurve: number[]
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

  return {
    onsets, bpm: bpmResult.bpm, bpmConfidence: bpmResult.confidence,
    duration: audioBuffer.duration, energyCurve,
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

export type { Onset, OnsetDetectionParams }
