import type { Onset } from './onsetDetection'

export interface BPMResult {
  bpm: number
  confidence: number
}

export function estimateBPM(onsets: Onset[]): BPMResult {
  if (onsets.length < 2) return { bpm: 120, confidence: 0 }

  const intervals: number[] = []
  for (let i = 1; i < onsets.length; i++) {
    intervals.push(onsets[i].time - onsets[i - 1].time)
  }

  const minInterval = 0.2
  const maxInterval = 2.0
  const binCount = 180
  const binSize = (maxInterval - minInterval) / binCount
  const histogram = new Array(binCount).fill(0)

  for (const interval of intervals) {
    if (interval >= minInterval && interval <= maxInterval) {
      const bin = Math.floor((interval - minInterval) / binSize)
      histogram[bin]++
    }
  }

  let maxBin = 0
  let maxCount = 0
  for (let i = 0; i < binCount; i++) {
    if (histogram[i] > maxCount) {
      maxCount = histogram[i]
      maxBin = i
    }
  }

  if (maxCount === 0) return { bpm: 120, confidence: 0 }

  const peakInterval = minInterval + (maxBin + 0.5) * binSize
  let bpm = 60 / peakInterval

  while (bpm < 60) bpm *= 2
  while (bpm > 200) bpm /= 2

  const totalIntervals = intervals.length
  const confidence = totalIntervals > 0 ? maxCount / totalIntervals : 0

  return { bpm: Math.round(bpm), confidence }
}
