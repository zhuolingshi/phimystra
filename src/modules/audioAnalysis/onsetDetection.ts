import { stft } from './stft'

export interface Onset {
  time: number
  end: number
  intensity: number
}

export interface OnsetDetectionParams {
  sampleRate: number
  fftSize?: number
  hopSize?: number
  thresholdStdScale?: number
  thresholdFloor?: number
  minOnsetInterval?: number
}

export function computeSpectralFlux(frames: Float32Array[]): Float32Array {
  const flux = new Float32Array(Math.max(0, frames.length - 1))
  for (let i = 1; i < frames.length; i++) {
    let sum = 0
    for (let j = 0; j < frames[i].length; j++) {
      const diff = frames[i][j] - frames[i - 1][j]
      if (diff > 0) sum += diff
    }
    flux[i - 1] = sum
  }
  return flux
}

function findPeaks(flux: Float32Array, stdScale: number, floor: number): number[] {
  if (flux.length === 0) return []
  let mean = 0
  for (let i = 0; i < flux.length; i++) mean += flux[i]
  mean /= flux.length
  let variance = 0
  for (let i = 0; i < flux.length; i++) variance += (flux[i] - mean) ** 2
  variance /= flux.length
  const threshold = Math.max(mean + stdScale * Math.sqrt(variance), floor)
  const peaks: number[] = []
  for (let i = 1; i < flux.length - 1; i++) {
    if (flux[i] > threshold && flux[i] > flux[i - 1] && flux[i] >= flux[i + 1])
      peaks.push(i)
  }
  return peaks
}

export function detectOnsets(signal: Float32Array, params: OnsetDetectionParams): Onset[] {
  const {
    sampleRate, fftSize = 2048, hopSize = 512,
    thresholdStdScale = 0.78, thresholdFloor = 0.043, minOnsetInterval = 0.05,
  } = params
  const frames = stft(signal, { fftSize, hopSize })
  const flux = computeSpectralFlux(frames)
  const peaks = findPeaks(flux, thresholdStdScale, thresholdFloor)
  const onsets: Onset[] = []
  const hopDur = hopSize / sampleRate
  let maxFlux = 0
  for (let i = 0; i < flux.length; i++) if (flux[i] > maxFlux) maxFlux = flux[i]

  for (const idx of peaks) {
    const time = idx * hopDur
    if (onsets.length > 0 && time - onsets[onsets.length - 1].time < minOnsetInterval)
      continue
    let endIdx = idx
    for (let i = idx + 1; i < flux.length; i++) {
      if (flux[i] < flux[idx] * 0.1) { endIdx = i; break }
      endIdx = i
    }
    onsets.push({
      time, end: endIdx * hopDur,
      intensity: maxFlux > 0 ? Math.min(1, flux[idx] / maxFlux) : 0,
    })
  }
  return onsets
}
