import { describe, it, expect } from 'vitest'
import { parseChart, getEventValue, queryFloorPosition, beatsToSeconds } from '../src/modules/phiraEngine/eventParser'
import type { RPEChart } from '../src/types/rpe'
import type { ProcessedBPM, TimedEvent } from '../src/modules/phiraEngine/eventParser'

const testBpmList: ProcessedBPM[] = [
  { bpm: 120, startBeat: 0, startTimeSec: 0 },
]

describe('beatsToSeconds', () => {
  it('BPM 120: 1 beat = 0.5s', () => {
    expect(beatsToSeconds(1, testBpmList)).toBeCloseTo(0.5)
  })

  it('BPM 120: 4 beats = 2s', () => {
    expect(beatsToSeconds(4, testBpmList)).toBeCloseTo(2)
  })
})

describe('getEventValue', () => {
  it('线性插值', () => {
    const events: TimedEvent[] = [
      { startTime: 0, endTime: 1, start: 0, end: 10, easing: 1 },
    ]
    expect(getEventValue(events, 0.5, 0)).toBeCloseTo(5)
  })

  it('事件结束后保持末值', () => {
    const events: TimedEvent[] = [
      { startTime: 0, endTime: 1, start: 0, end: 10, easing: 1 },
    ]
    expect(getEventValue(events, 2, 0)).toBe(0)
  })

  it('空事件列表返回默认值', () => {
    expect(getEventValue([], 1, 42)).toBe(42)
  })

  it('非线性缓动端点正确', () => {
    const events: TimedEvent[] = [
      { startTime: 0, endTime: 1, start: 0, end: 1, easing: 2 },
    ]
    expect(getEventValue(events, 0, 0)).toBeCloseTo(0, 1)
    expect(getEventValue(events, 1, 0)).toBeCloseTo(1, 1)
  })
})

describe('queryFloorPosition', () => {
  it('空表返回 0', () => {
    expect(queryFloorPosition([], 1)).toBe(0)
  })

  it('匀速累积正确', () => {
    const table = [
      { time: 0, floorPos: 0, speed: 1 },
      { time: 10, floorPos: 10, speed: 1 },
    ]
    expect(queryFloorPosition(table, 5)).toBeCloseTo(5)
    expect(queryFloorPosition(table, 10)).toBeCloseTo(10)
  })
})

describe('parseChart', () => {
  it('正确解析简单 chart', () => {
    const chart: RPEChart = {
      BPMList: [{ bpm: 120, startTime: [0, 0, 1] }],
      META: {
        RPEVersion: 130, background: '', charter: 'test', composer: 'test',
        id: '1', level: 'IN Lv.10', name: 'test', offset: 0, song: '',
      },
      judgeLineGroup: ['Default'],
      judgeLineList: [{
        Group: 0, Name: 'line1', Texture: '', bpmfactor: 1,
        eventLayers: [{
          alphaEvents: [{ startTime: [0, 0, 1], endTime: [1, 0, 1], startValue: 1, endValue: 1, easing: 1 }],
          moveXEvents: [],
          moveYEvents: [],
          rotateEvents: [],
          speedEvents: [{ startTime: [0, 0, 1], endTime: [100, 0, 1], value: 0.6, linkgroup: 0 }],
        }],
        father: -1, isCover: 1, notes: [], numOfNotes: 0,
        posControl: [], sizeControl: [], skewControl: [], yControl: [], zOrder: 0,
      }],
    }

    const result = parseChart(chart)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].alphaEvents).toHaveLength(1)
    expect(result.lines[0].floorPosTable.length).toBeGreaterThan(0)
  })
})
