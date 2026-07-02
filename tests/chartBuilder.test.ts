import { describe, it, expect } from 'vitest'
import { buildChart, validateChart } from '../src/modules/chartEngine/chartBuilder'
import { levelToParams } from '../src/modules/chartEngine/difficultyParams'
import { generateNotes } from '../src/modules/chartEngine/noteGenerator'
import type { Onset } from '../src/modules/audioAnalysis/onsetDetection'

function makeTestChart(level: number = 10) {
  const onsets: Onset[] = [
    { time: 1, end: 1.05, intensity: 0.8 },
    { time: 2, end: 2.05, intensity: 0.6 },
    { time: 3, end: 3.05, intensity: 0.7 },
    { time: 4, end: 4.05, intensity: 0.5 },
  ]
  const difficulty = levelToParams(level)
  const notes = generateNotes(onsets, difficulty)
  return buildChart({
    name: '测试曲', composer: '作曲', charter: '谱师',
    notes, difficulty, duration: 10, bpm: 120,
  })
}

describe('buildChart', () => {
  it('生成有效的 RPE chart', () => {
    const chart = makeTestChart()
    expect(chart.META.name).toBe('测试曲')
    expect(chart.META.RPEVersion).toBe(130)
    expect(chart.BPMList[0].bpm).toBe(120)
    expect(chart.judgeLineList.length).toBeGreaterThan(0)
  })

  it('判定线包含音符', () => {
    const chart = makeTestChart()
    const totalNotes = chart.judgeLineList.reduce((sum, l) => sum + l.numOfNotes, 0)
    expect(totalNotes).toBeGreaterThan(0)
  })

  it('判定线有位置事件', () => {
    const chart = makeTestChart()
    for (const line of chart.judgeLineList) {
      expect(line.eventLayers[0].moveXEvents.length).toBeGreaterThan(0)
      expect(line.eventLayers[0].moveYEvents.length).toBeGreaterThan(0)
      expect(line.eventLayers[0].rotateEvents.length).toBeGreaterThan(0)
    }
  })

  it('低难度和高难度都生成判定线', () => {
    const easyChart = makeTestChart(3)
    const hardChart = makeTestChart(14)
    expect(easyChart.judgeLineList.length).toBeGreaterThanOrEqual(1)
    expect(hardChart.judgeLineList.length).toBeGreaterThanOrEqual(1)
  })
})

describe('validateChart', () => {
  it('有效 chart 无错误', () => {
    const chart = makeTestChart()
    const errors = validateChart(chart)
    expect(errors).toHaveLength(0)
  })

  it('空谱面报告错误', () => {
    const chart = makeTestChart()
    chart.judgeLineList = []
    const errors = validateChart(chart)
    expect(errors.length).toBeGreaterThan(0)
  })
})
