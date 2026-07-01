import { describe, it, expect } from 'vitest'
import { estimateBPM } from '../src/modules/audioAnalysis/bpmEstimation'
import type { Onset } from '../src/modules/audioAnalysis/onsetDetection'

describe('estimateBPM', () => {
  it('从均匀间隔 onset 估算正确 BPM', () => {
    const onsets: Onset[] = []
    for (let t = 0; t < 10; t += 0.5)
      onsets.push({ time: t, end: t + 0.1, intensity: 0.8 })
    const result = estimateBPM(onsets)
    expect(result.bpm).toBeGreaterThanOrEqual(115)
    expect(result.bpm).toBeLessThanOrEqual(125)
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('空 onset 返回默认 BPM', () => {
    const result = estimateBPM([])
    expect(result.bpm).toBe(120)
    expect(result.confidence).toBe(0)
  })

  it('不规则 onset 置信度低', () => {
    const onsets: Onset[] = [
      { time: 0.1, end: 0.2, intensity: 0.5 },
      { time: 0.37, end: 0.4, intensity: 0.3 },
      { time: 1.1, end: 1.2, intensity: 0.7 },
      { time: 1.3, end: 1.4, intensity: 0.4 },
    ]
    const result = estimateBPM(onsets)
    expect(result.confidence).toBeLessThan(0.5)
  })
})
