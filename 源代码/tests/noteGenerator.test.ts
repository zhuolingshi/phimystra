import { describe, it, expect } from 'vitest'
import { generateNotes, filterOnsetsByDensity, countNoteTypes } from '../src/modules/chartEngine/noteGenerator'
import { levelToParams } from '../src/modules/chartEngine/difficultyParams'
import type { Onset } from '../src/modules/audioAnalysis/onsetDetection'

function makeOnsets(times: number[]): Onset[] {
  return times.map((t) => ({ time: t, end: t + 0.05, intensity: 0.8 }))
}

describe('filterOnsetsByDensity', () => {
  it('density=1.0 返回全部', () => {
    const onsets = makeOnsets([1, 2, 3, 4, 5])
    const result = filterOnsetsByDensity(onsets, 1.0)
    expect(result).toHaveLength(5)
  })

  it('density=0.4 返回约 40%', () => {
    const onsets = makeOnsets([1, 2, 3, 4, 5])
    const result = filterOnsetsByDensity(onsets, 0.4)
    expect(result.length).toBe(2) // ceil(5 * 0.4) = 2
  })

  it('结果按时间排序', () => {
    const onsets = [
      { time: 5, end: 5.1, intensity: 0.9 },
      { time: 1, end: 1.1, intensity: 0.3 },
      { time: 3, end: 3.1, intensity: 0.6 },
    ]
    const result = filterOnsetsByDensity(onsets, 1.0)
    expect(result[0].time).toBeLessThanOrEqual(result[1].time)
    expect(result[1].time).toBeLessThanOrEqual(result[2].time)
  })
})

describe('generateNotes', () => {
  it('生成音符数量 > 0', () => {
    const onsets = makeOnsets([1, 2, 3, 4])
    const params = levelToParams(10)
    const notes = generateNotes(onsets, params)
    expect(notes.length).toBeGreaterThan(0)
  })

  it('低难度主要生成 Tap', () => {
    const onsets = makeOnsets([1, 2, 3, 4, 5, 6])
    const params = levelToParams(2)
    const notes = generateNotes(onsets, params)
    const counts = countNoteTypes(notes)
    expect(counts.tap).toBeGreaterThan(0)
    expect(counts.tap).toBeGreaterThanOrEqual(counts.drag ?? 0)
  })

  it('相同 seed 生成相同结果（可复现）', () => {
    const onsets = makeOnsets([1, 2, 3, 4, 5])
    const params = levelToParams(12)
    const notes1 = generateNotes(onsets, params, 120, 42)
    const notes2 = generateNotes(onsets, params, 120, 42)
    expect(notes1).toEqual(notes2)
  })

  it('所有音符类型有效（1-4）', () => {
    const onsets = makeOnsets([1, 2, 3, 4])
    const params = levelToParams(14)
    const notes = generateNotes(onsets, params)
    for (const note of notes) {
      expect(note.type).toBeGreaterThanOrEqual(1)
      expect(note.type).toBeLessThanOrEqual(4)
    }
  })

  it('音符时间按 onset 时间排列', () => {
    const onsets = makeOnsets([1, 3, 5, 7])
    const params = levelToParams(8)
    const notes = generateNotes(onsets, params)
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].startTime[2]).toBeGreaterThanOrEqual(notes[i - 1].startTime[2])
    }
  })
})

describe('countNoteTypes', () => {
  it('正确统计', () => {
    const onsets = makeOnsets([1, 2, 3, 4])
    const params = levelToParams(10)
    const notes = generateNotes(onsets, params)
    const counts = countNoteTypes(notes)
    const total = (counts.tap ?? 0) + (counts.hold ?? 0) + (counts.flick ?? 0) + (counts.drag ?? 0)
    expect(total).toBe(notes.length)
  })
})
