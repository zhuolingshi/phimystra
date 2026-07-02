import { describe, it, expect } from 'vitest'
import { stft, magnitudeSpectrum, hammingWindow } from '../src/modules/audioAnalysis/stft'

describe('hammingWindow', () => {
  it('生成正确长度汉明窗', () => {
    const win = hammingWindow(512)
    expect(win).toHaveLength(512)
    expect(win[0]).toBeCloseTo(0.08, 1)
    expect(win[256]).toBeCloseTo(1.0, 1)
  })
})

describe('magnitudeSpectrum', () => {
  it('直流分量幅度正确', () => {
    const result = magnitudeSpectrum(new Float32Array([1, 0, 0, 0, 0, 0, 0, 0]))
    expect(result[0]).toBeCloseTo(1, 1)
  })
})

describe('stft', () => {
  it('产生正确帧数', () => {
    const signal = new Float32Array(44100)
    const frames = stft(signal, { fftSize: 2048, hopSize: 512 })
    const expected = Math.floor((44100 - 2048) / 512) + 1
    expect(frames.length).toBeGreaterThan(expected - 5)
    expect(frames.length).toBeLessThan(expected + 5)
    expect(frames[0].length).toBe(1025)
  })

  it('检测到正弦波频率峰值', () => {
    const sampleRate = 44100
    const freq = 1000
    const samples = new Float32Array(sampleRate * 0.1)
    for (let i = 0; i < samples.length; i++)
      samples[i] = Math.sin(2 * Math.PI * freq * (i / sampleRate))

    const frames = stft(samples, { fftSize: 2048, hopSize: 512 })
    const frame = frames[Math.floor(frames.length / 2)]
    let maxBin = 0
    for (let i = 0; i < frame.length; i++)
      if (frame[i] > frame[maxBin]) maxBin = i

    const peakFreq = (maxBin * sampleRate) / 2048
    expect(peakFreq).toBeGreaterThan(900)
    expect(peakFreq).toBeLessThan(1100)
  })
})
