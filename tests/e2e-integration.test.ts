import { describe, it, expect } from 'vitest'
import { generateNotes, countNoteTypes, filterOnsetsByDensity, quantizeToBeat } from '../src/modules/chartEngine/noteGenerator'
import { levelToParams } from '../src/modules/chartEngine/difficultyParams'
import { buildChart, validateChart } from '../src/modules/chartEngine/chartBuilder'
import { parseChart, getLineState } from '../src/modules/phiraEngine/eventParser'
import { exportPez } from '../src/modules/pezExporter'
import type { Onset } from '../src/modules/audioAnalysis/onsetDetection'
import type { MusicSegment } from '../src/modules/audioAnalysis'
import type { AudioAnalysis } from '../src/modules/audioAnalysis'

function makeRealisticOnsets(): Onset[] {
  const onsets: Onset[] = []
  for (let beat = 0; beat < 32; beat++) {
    const time = beat * 0.5
    const isKick = beat % 4 === 0
    const isSnare = beat % 4 === 2
    const isHihat = beat % 2 === 1
    onsets.push({
      time,
      end: time + (isKick ? 0.15 : 0.05),
      intensity: isKick ? 0.9 : isSnare ? 0.7 : 0.4,
      bands: isKick
        ? { low: 0.6, mid: 0.3, high: 0.1 }
        : isSnare
        ? { low: 0.2, mid: 0.5, high: 0.3 }
        : { low: 0.1, mid: 0.2, high: 0.7 },
    })
  }
  return onsets
}

function makeTestSegments(duration: number): MusicSegment[] {
  return [
    { start: 0, end: duration * 0.12, type: 'intro', energy: 0.3, densityMultiplier: 0.5 },
    { start: duration * 0.12, end: duration * 0.4, type: 'verse', energy: 0.5, densityMultiplier: 1.0 },
    { start: duration * 0.4, end: duration * 0.7, type: 'chorus', energy: 0.8, densityMultiplier: 1.3 },
    { start: duration * 0.7, end: duration * 0.85, type: 'bridge', energy: 0.4, densityMultiplier: 0.7 },
    { start: duration * 0.85, end: duration, type: 'outro', energy: 0.3, densityMultiplier: 0.5 },
  ]
}

describe('端到端集成测试：完整制谱流程', () => {
  const onsets = makeRealisticOnsets()
  const bpm = 120
  const duration = 16
  const segments = makeTestSegments(duration)

  it('Step 1: onset 含频段信息', () => {
    expect(onsets.length).toBe(32)
    expect(onsets[0].bands).toBeDefined()
    expect(onsets[0].bands.low).toBeGreaterThan(0.5)
    expect(onsets[3].bands.high).toBeGreaterThan(0.5)
  })

  it('Step 2: 节拍量化对齐', () => {
    const quantized = quantizeToBeat(1.234, bpm)
    expect(quantized).toBeCloseTo(1.25, 1) // 1/4 拍 = 0.125s
  })

  it('Step 3: 段落感知 onset 过滤', () => {
    const easyParams = levelToParams(3)
    const easyNotes = generateNotes(onsets, easyParams, bpm, 42, segments)
    const hardParams = levelToParams(14)
    const hardNotes = generateNotes(onsets, hardParams, bpm, 42, segments)
    expect(hardNotes.length).toBeGreaterThan(easyNotes.length)
  })

  it('Step 4: 生成谱面并通过验证', () => {
    const params = levelToParams(10)
    const notes = generateNotes(onsets, params, bpm, 42, segments)
    const chart = buildChart({
      name: '集成测试曲', composer: 'AI', charter: 'AI制谱器',
      notes, difficulty: params, duration, bpm,
    })
    const errors = validateChart(chart)
    expect(errors).toHaveLength(0)
    expect(chart.judgeLineList.length).toBeGreaterThan(0)
    expect(chart.BPMList[0].bpm).toBe(120)
  })

  it('Step 5: 谱面可被事件解析器正确解析', () => {
    const params = levelToParams(10)
    const notes = generateNotes(onsets, params, bpm, 42, segments)
    const chart = buildChart({
      name: '解析测试', composer: 'AI', charter: 'AI',
      notes, difficulty: params, duration, bpm,
    })
    const processed = parseChart(chart)

    expect(processed.lines.length).toBeGreaterThan(0)
    expect(processed.bpmList[0].bpm).toBe(120)

    const line0 = processed.lines[0]
    expect(line0.moveXEvents.length).toBeGreaterThan(0)
    expect(line0.moveYEvents.length).toBeGreaterThan(0)
    expect(line0.rotateEvents.length).toBeGreaterThan(0)
    expect(line0.alphaEvents.length).toBeGreaterThan(0)
    expect(line0.floorPosTable.length).toBeGreaterThan(0)
  })

  it('Step 6: 渲染状态查询返回有效值', () => {
    const params = levelToParams(10)
    const notes = generateNotes(onsets, params, bpm, 42, segments)
    const chart = buildChart({
      name: '渲染测试', composer: 'AI', charter: 'AI',
      notes, difficulty: params, duration, bpm,
    })
    const processed = parseChart(chart)
    const state = getLineState(processed.lines[0], 5.0)

    expect(state).toBeDefined()
    expect(typeof state.x).toBe('number')
    expect(typeof state.y).toBe('number')
    expect(typeof state.rotation).toBe('number')
    expect(state.alpha).toBeGreaterThan(0)
    expect(state.alpha).toBeLessThanOrEqual(1)
  })

  it('Step 7: 导出 pez 文件', () => {
    const params = levelToParams(10)
    const notes = generateNotes(onsets, params, bpm, 42, segments)
    const chart = buildChart({
      name: '导出测试', composer: 'AI', charter: 'AI',
      notes, difficulty: params, duration, bpm,
    })
    const result = exportPez({
      chart,
      audioData: new Uint8Array(1024),
      audioFormat: 'wav',
    })
    expect(result.data.length).toBeGreaterThan(100)
    expect(result.data[0]).toBe(0x50) // PK
    expect(result.filename).toBe('导出测试.pez')
  })

  it('Step 8: 不同难度生成不同特征谱面', () => {
    const results: Record<string, number> = {}
    for (const level of [2, 6, 10, 14]) {
      const params = levelToParams(level)
      const notes = generateNotes(onsets, params, bpm, 42, segments)
      const counts = countNoteTypes(notes)
      results[`lv${level}`] = notes.length
    }
    // 更高难度应该有更多音符（或至少不少于低难度）
    expect(results.lv14).toBeGreaterThanOrEqual(results.lv2)
  })

  it('Step 9: 音符 positionX 有分布变化', () => {
    const params = levelToParams(12)
    const notes = generateNotes(onsets, params, bpm, 42, segments)
    const positions = new Set(notes.map(n => n.positionX))
    expect(positions.size).toBeGreaterThan(1)
  })

  it('Step 10: 相同 seed 生成完全相同的谱面', () => {
    const params = levelToParams(10)
    const notes1 = generateNotes(onsets, params, bpm, 123, segments)
    const notes2 = generateNotes(onsets, params, bpm, 123, segments)
    expect(notes1).toEqual(notes2)
  })
})
