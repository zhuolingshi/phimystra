import { stft } from './stft'

export interface BandEnergy {
  low: number
  mid: number
  high: number
}

export class Onset {
  time: number = 0
  end: number = 0
  intensity: number = 0
  bands: BandEnergy = { low: 0.33, mid: 0.33, high: 0.34 }
}

export interface OnsetDetectionParams {
  sampleRate: number
  fftSize: number
  hopSize: number
  thresholdStdScale: number
  thresholdFloor: number
  minOnsetInterval: number
}

export function computeSpectralFlux(frames: Float32Array[]): Float32Array {
  const len = Math.max(0, frames.length - 1)
  const flux = new Float32Array(len)
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

function computeBandEnergies(
  frame: Float32Array, sampleRate: number, fftSize: number
): BandEnergy {
  const lowEnd = Math.floor(250 * fftSize / sampleRate)
  const midEnd = Math.floor(2000 * fftSize / sampleRate)
  let low = 0, mid = 0, high = 0
  for (let i = 1; i < frame.length; i++) {
    const energy = frame[i] * frame[i]
    if (i < lowEnd) low += energy
    else if (i < midEnd) mid += energy
    else high += energy
  }
  const total = low + mid + high || 1
  return { low: low / total, mid: mid / total, high: high / total }
}

export function detectOnsets(signal: Float32Array, params: OnsetDetectionParams): Onset[] {
  const sampleRate = params.sampleRate
  const fftSize = params.fftSize || 2048
  const hopSize = params.hopSize || 512
  const thresholdStdScale = params.thresholdStdScale || 0.78
  const thresholdFloor = params.thresholdFloor || 0.043
  const minOnsetInterval = params.minOnsetInterval || 0.05

  const frames = stft(signal, fftSize, hopSize)
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
    const onset = new Onset()
    onset.time = time
    onset.end = endIdx * hopDur
    onset.intensity = maxFlux > 0 ? Math.min(1, flux[idx] / maxFlux) : 0
    onset.bands = computeBandEnergies(frames[idx], sampleRate, fftSize)
    onsets.push(onset)
  }
  return onsets
}
