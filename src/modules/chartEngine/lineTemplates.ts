// 判定线模板系统：预设的判定线布局和动画

import type { JudgeLine, Note, AnimationEvent, BeatTime } from '../../types/rpe'
import { createJudgeLine, secondsToBeatTime } from '../../types/rpe'

export interface LinePreset {
  x: number
  y: number
  rotation: number
}

// 判定线预设位置（屏幕中心为原点）
export const LINE_PRESETS: Record<string, LinePreset> = {
  center: { x: 0, y: 0, rotation: 0 },
  left: { x: -500, y: 0, rotation: -90 },
  right: { x: 500, y: 0, rotation: 90 },
  up: { x: 0, y: 300, rotation: 0 },
  down: { x: 0, y: -300, rotation: 180 },
}

// 创建静态动画事件（值不变）
function staticEvent(value: number, lastTime: number, bpm: number): AnimationEvent {
  const start = secondsToBeatTime(0, bpm)
  const end = secondsToBeatTime(lastTime, bpm)
  return { startTime: start, endTime: end, startValue: value, endValue: value, easing: 1 }
}

// 创建一条判定线
function makeLine(params: {
  name: string
  group?: number
  notes?: Note[]
  preset?: LinePreset
  lastTime: number
  bpm: number
  alpha?: number
}): JudgeLine {
  const line = createJudgeLine({ name: params.name, group: params.group ?? 0 })
  const preset = params.preset ?? LINE_PRESETS.center

  if (params.notes) {
    line.notes = params.notes
    line.numOfNotes = params.notes.length
  }

  // 设置位置和旋转事件
  const layer = line.eventLayers[0]
  layer.moveXEvents = [staticEvent(preset.x, params.lastTime, params.bpm)]
  layer.moveYEvents = [staticEvent(preset.y, params.lastTime, params.bpm)]
  layer.rotateEvents = [staticEvent(preset.rotation, params.lastTime, params.bpm)]
  layer.alphaEvents = [staticEvent(params.alpha ?? 255, params.lastTime, params.bpm)]

  return line
}

// 根据模板名生成判定线列表
export function buildJudgeLinesForTemplate(params: {
  template: string
  notes: Note[]
  lastTime: number
  bpm: number
  judgeLineCount: number
}): JudgeLine[] {
  const { template, notes, lastTime, bpm } = params

  if (template === 'static-four') {
    // 4 条判定线，音符分配到上下
    // 简单分配：交替分配到上方和下方
    const upperNotes: Note[] = []
    const lowerNotes: Note[] = []
    notes.forEach((note, i) => {
      if (i % 2 === 0) upperNotes.push(note)
      else lowerNotes.push(note)
    })

    return [
      makeLine({ name: 'Upper line', group: 0, notes: upperNotes, preset: LINE_PRESETS.up, lastTime, bpm }),
      makeLine({ name: 'Lower line', group: 0, notes: lowerNotes, preset: LINE_PRESETS.down, lastTime, bpm }),
    ]
  }

  // 默认：单条中央判定线
  return [
    makeLine({ name: 'Main line', group: 0, notes, preset: LINE_PRESETS.center, lastTime, bpm }),
  ]
}
