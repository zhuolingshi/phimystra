import { describe, it, expect } from 'vitest'
import { computeSpectralFlux, detectOnsets } from '../src/modules/audioAnalysis/onsetDetection'
import { stft } from '../src/modules/audioAnalysis/stft'

describe('computeSpectralFlux', () => {
  it('静音信号 flux 全为 0', () => {
    const silence = new Float32Array(44100)
    const frames = stft(silence, { fftSize: 2048, hopSize: 512 })
    const flux = computeSpectralFlux(frames)
    expect(flux.every((v) => v === 0)).toBe(true)
  })

  it('脉冲信号产生非零 flux', () => {
    const sr = 44100
    const signal = new Float32Array(sr * 2)
    for (const t of [0.5, 1.0, 1.5]) {
      const s = Math.floor(t * sr)
      for (let i = 0; i < 2048; i++)
        signal[s + i] = Math.sin(2 * Math.PI * 440 * (i / sr)) * Math.exp(-i / 1000)
    }
    const frames = stft(signal, { fftSize: 2048, hopSize: 512 })
    const flux = computeSpectralFlux(frames)
    expect(flux.some((v) => v > 0)).toBe(true)
  })
})

describe('detectOnsets', () => {
  it('从脉冲信号检测 onset', () => {
    const sr = 44100
    const signal = new Float32Array(sr * 2)
    for (const t of [0.5, 1.5]) {
      const s = Math.floor(t * sr)
      for (let i = 0; i < 2048; i++)
        signal[s + i] = Math.sin(2 * Math.PI * 440 * (i / sr)) * Math.exp(-i / 500)
    }
    const onsets = detectOnsets(signal, { sampleRate: sr, fftSize: 2048, hopSize: 512 })
    expect(onsets.length).toBeGreaterThanOrEqual(1)
    expect(onsets.length).toBeLessThanOrEqual(4)
    for (const o of onsets) {
      const closest = [0.5, 1.5].reduce((p, c) =>
        Math.abs(c - o.time) < Math.abs(p - o.time) ? c : p)
      expect(Math.abs(o.time - closest)).toBeLessThan(0.2)
    }
  })

  it('静音不产生 onset', () => {
    const onsets = detectOnsets(new Float32Array(44100 * 2), {
      sampleRate: 44100, fftSize: 2048, hopSize: 512,
    })
    expect(onsets.length).toBe(0)
  })
})
