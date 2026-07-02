// 判定线模板系统 v3：基于真实谱面分析
//
// 关键发现：
// 1. 主判定线承载 70%+ 音符，位于 y≈-225（屏幕上 1/3）
// 2. speedEvents 值几乎全为 10.0（不是 6-9）
// 3. alpha 用 0-255 整数（255=可见，0=不可见）
// 4. 真实谱面有 19-56 条线，但大部分是装饰线
// 5. above 93%+ 为 1（音符在线上方）

import type { JudgeLine, Note, AnimationEvent, SpeedEvent } from '../../types/rpe'
import { createJudgeLine, secondsToBeatTime } from '../../types/rpe'

// 真实谱面分析：判定线默认位置
const MAIN_LINE_Y = -225   // 主判定线 Y 坐标（屏幕上 1/3 处）
const DEFAULT_SPEED = 10.0 // 真实谱面 speedEvents 值

function makeAnimationEvent(
  startSec: number, endSec: number,
  startVal: number, endVal: number,
  bpm: number, easing: number = 1,
): AnimationEvent {
  return {
    startTime: secondsToBeatTime(startSec, bpm),
    endTime: secondsToBeatTime(endSec, bpm),
    start: startVal, end: endVal,
    easingType: easing, bezier: 0,
    bezierPoints: [0, 0, 0, 0],
    easingLeft: 0, easingRight: 1,
    linkgroup: 0,
  }
}

function makeSpeedEvent(
  startSec: number, endSec: number,
  startVal: number, endVal: number,
  bpm: number,
): SpeedEvent {
  return {
    startTime: secondsToBeatTime(startSec, bpm),
    endTime: secondsToBeatTime(endSec, bpm),
    start: startVal, end: endVal,
    linkgroup: 0, easingType: 1,
    easingLeft: 0, easingRight: 1,
  }
}

// 创建主判定线（承载所有音符）
function makeMainLine(notes: Note[], duration: number, bpm: number, fallSpeed: number): JudgeLine {
  const line = createJudgeLine({ name: 'Main line', group: 0 })
  line.Texture = 'line.png'
  line.notes = notes
  line.numOfNotes = notes.length
  line.father = -1
  line.isCover = 1
  line.zOrder = 1

  const layer = line.eventLayers[0]

  // moveX: 居中不动
  layer.moveXEvents = [makeAnimationEvent(0, duration, 0, 0, bpm)]

  // moveY: 主线在 y=-225，加轻微上下浮动模拟真实谱面
  // 真实谱面 moveY 范围 -330~330，但主线多数在 -300~-200
  const yEvents: AnimationEvent[] = []
  yEvents.push(makeAnimationEvent(0, 0, MAIN_LINE_Y, MAIN_LINE_Y, bpm))
  // 每 8 拍轻微移动一次（增加动感但不影响可打性）
  const beatDur = 60 / bpm
  for (let t = 0; t < duration; t += beatDur * 8) {
    const tEnd = Math.min(t + beatDur * 8, duration)
    const yOffset = Math.sin(t * 0.3) * 30 // ±30 像素浮动
    yEvents.push(makeAnimationEvent(t, tEnd, MAIN_LINE_Y + yOffset, MAIN_LINE_Y - yOffset, bpm, 2))
  }
  layer.moveYEvents = yEvents

  // rotate: 基本不旋转，微小角度增加动感
  layer.rotateEvents = [makeAnimationEvent(0, duration, 0, 0, bpm)]

  // alpha: 全程可见（255 = 完全可见）
  // 真实谱面用 0-255 整数范围
  const alphaEvents: AnimationEvent[] = []
  alphaEvents.push(makeAnimationEvent(0, 0, 0, 0, bpm)) // 开始不可见
  alphaEvents.push(makeAnimationEvent(0.5, 1.0, 0, 255, bpm, 2)) // 0.5s 淡入
  alphaEvents.push(makeAnimationEvent(1.0, duration - 1.0, 255, 255, bpm)) // 保持可见
  alphaEvents.push(makeAnimationEvent(duration - 1.0, duration, 255, 0, bpm, 2)) // 结尾淡出
  layer.alphaEvents = alphaEvents

  // speed: 固定 10.0（真实谱面标准值）
  layer.speedEvents = [makeSpeedEvent(0, duration, fallSpeed, fallSpeed, bpm)]

  return line
}

// 创建装饰判定线（无音符，纯视觉效果）
function makeDecorLine(
  index: number, duration: number, bpm: number, fallSpeed: number
): JudgeLine {
  const line = createJudgeLine({ name: `Decor ${index}`, group: 2 })
  line.Texture = 'line.png'
  line.father = -1
  line.isCover = 0
  line.zOrder = 0

  const layer = line.eventLayers[0]
  const offset = index * 100

  layer.moveXEvents = [makeAnimationEvent(0, duration, 0, 0, bpm)]
  layer.moveYEvents = [makeAnimationEvent(0, duration, offset, offset, bpm)]
  layer.rotateEvents = [makeAnimationEvent(0, duration, 0, 0, bpm)]

  // 装饰线闪烁效果
  const beatDur = 60 / bpm
  const alphaEvents: AnimationEvent[] = []
  for (let t = beatDur * 4; t < duration; t += beatDur * 4) {
    alphaEvents.push(makeAnimationEvent(t, t + beatDur, 0, 100, bpm, 2))
    alphaEvents.push(makeAnimationEvent(t + beatDur, t + beatDur * 2, 100, 0, bpm, 2))
  }
  layer.alphaEvents = alphaEvents.length > 0 ? alphaEvents : [makeAnimationEvent(0, duration, 0, 0, bpm)]
  layer.speedEvents = [makeSpeedEvent(0, duration, fallSpeed, fallSpeed, bpm)]

  return line
}

export function buildJudgeLinesForTemplate(params: {
  template: string
  notes: Note[]
  lastTime: number
  bpm: number
  judgeLineCount: number
  fallSpeed?: number
}): JudgeLine[] {
  const { notes, lastTime, bpm } = params
  const speed = params.fallSpeed ?? DEFAULT_SPEED

  const lines: JudgeLine[] = []

  // 主判定线：承载所有音符
  lines.push(makeMainLine(notes, lastTime, bpm, speed))

  // 添加 1-2 条装饰判定线（模拟真实谱面的视觉效果）
  lines.push(makeDecorLine(0, lastTime, bpm, speed))

  return lines
}
