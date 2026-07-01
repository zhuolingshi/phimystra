import { describe, it, expect } from 'vitest'
import { createEmptyChart, createNote, createJudgeLine, secondsToBeatTime } from '../src/types/rpe'

describe('RPE 类型', () => {
  it('createEmptyChart 返回有效空谱面', () => {
    const chart = createEmptyChart({
      name: '测试曲目', composer: '作曲', charter: '谱师', level: 'IN Lv.14',
    })
    expect(chart.META.name).toBe('测试曲目')
    expect(chart.META.RPEVersion).toBe(130)
    expect(chart.judgeLineList).toHaveLength(0)
    expect(chart.BPMList[0].bpm).toBe(120)
  })

  it('createNote 返回正确音符', () => {
    const note = createNote({ type: 1, startTime: [0, 0, 1], endTime: [0, 0, 1] })
    expect(note.type).toBe(1)
    expect(note.isFake).toBe(0)
    expect(note.alpha).toBe(255)
  })

  it('createJudgeLine 返回正确判定线', () => {
    const line = createJudgeLine({ name: '测试线' })
    expect(line.Name).toBe('测试线')
    expect(line.father).toBe(-1)
    expect(line.eventLayers).toHaveLength(1)
    expect(line.notes).toHaveLength(0)
  })

  it('secondsToBeatTime 正确转换', () => {
    expect(secondsToBeatTime(1, 120)[2]).toBe(2)
    expect(secondsToBeatTime(0, 120)).toEqual([0, 1000, 0])
  })
})
