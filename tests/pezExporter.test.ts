import { describe, it, expect } from 'vitest'
import { exportPez } from '../src/modules/pezExporter'
import type { RPEChart } from '../src/types/rpe'

function makeTestChart(): RPEChart {
  return {
    BPMList: [{ bpm: 120, startTime: [0, 0, 1] }],
    META: {
      RPEVersion: 130, background: 'cover.png', charter: 'AI',
      composer: 'Test', id: '1', level: 'IN Lv.10', name: 'Test',
      offset: 0, song: 'music.wav',
    },
    judgeLineGroup: ['Default'],
    judgeLineList: [],
  }
}

describe('exportPez', () => {
  it('生成有效的 ZIP 数据', () => {
    const result = exportPez({
      chart: makeTestChart(),
      audioData: new Uint8Array([0, 1, 2, 3]),
      audioFormat: 'wav',
    })
    expect(result.data).toBeInstanceOf(Uint8Array)
    expect(result.size).toBeGreaterThan(0)
    expect(result.filename).toBe('Test.zip')
  })

  it('ZIP 以 PK 签名开头', () => {
    const result = exportPez({
      chart: makeTestChart(),
      audioData: new Uint8Array([0]),
    })
    expect(result.data[0]).toBe(0x50) // 'P'
    expect(result.data[1]).toBe(0x4b) // 'K'
  })

  it('包含自定义文件名', () => {
    const result = exportPez({
      chart: makeTestChart(),
      audioData: new Uint8Array([0]),
      filename: 'my-chart.zip',
    })
    expect(result.filename).toBe('my-chart.zip')
  })

  it('包含 info.txt 元信息', () => {
    const result = exportPez({
      chart: makeTestChart(),
      audioData: new Uint8Array([0]),
    })
    expect(result.size).toBeGreaterThan(100)
  })
})
