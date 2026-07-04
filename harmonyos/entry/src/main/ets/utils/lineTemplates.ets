import { JudgeLine, Note, AnimationEvent, SpeedEvent,
  createJudgeLine, secondsToBeatTime, BeatTime } from '../model/chart'

const MAIN_LINE_Y = -225
const DEFAULT_SPEED = 10.0

function makeAnimationEvent(
  startSec: number, endSec: number, startVal: number, endVal: number,
  bpm: number, easing: number = 1
): AnimationEvent {
  const ev = new AnimationEvent()
  ev.startTime = secondsToBeatTime(startSec, bpm)
  ev.endTime = secondsToBeatTime(endSec, bpm)
  ev.start = startVal; ev.end = endVal
  ev.easingType = easing; ev.bezier = 0
  ev.bezierPoints = [0, 0, 0, 0]
  ev.easingLeft = 0; ev.easingRight = 1
  ev.linkgroup = 0
  return ev
}

function makeSpeedEvent(
  startSec: number, endSec: number, startVal: number, endVal: number, bpm: number
): SpeedEvent {
  const ev = new SpeedEvent()
  ev.startTime = secondsToBeatTime(startSec, bpm)
  ev.endTime = secondsToBeatTime(endSec, bpm)
  ev.start = startVal; ev.end = endVal
  ev.linkgroup = 0; ev.easingType = 1
  ev.easingLeft = 0; ev.easingRight = 1
  return ev
}

function makeMainLine(notes: Note[], duration: number, bpm: number, fallSpeed: number): JudgeLine {
  const line = createJudgeLine('Main line', 0)
  line.Texture = 'line.png'
  line.notes = notes
  line.numOfNotes = notes.length
  line.father = -1
  line.isCover = 1
  line.zOrder = 1

  const layer = line.eventLayers[0]
  layer.moveXEvents = [makeAnimationEvent(0, duration, 0, 0, bpm)]

  const yEvents: AnimationEvent[] = []
  yEvents.push(makeAnimationEvent(0, 0, MAIN_LINE_Y, MAIN_LINE_Y, bpm))
  const beatDur = 60 / bpm
  for (let t = 0; t < duration; t += beatDur * 8) {
    const tEnd = Math.min(t + beatDur * 8, duration)
    const yOffset = Math.sin(t * 0.3) * 30
    yEvents.push(makeAnimationEvent(t, tEnd, MAIN_LINE_Y + yOffset, MAIN_LINE_Y - yOffset, bpm, 2))
  }
  layer.moveYEvents = yEvents
  layer.rotateEvents = [makeAnimationEvent(0, duration, 0, 0, bpm)]

  const alphaEvents: AnimationEvent[] = []
  alphaEvents.push(makeAnimationEvent(0, 0, 0, 0, bpm))
  alphaEvents.push(makeAnimationEvent(0.5, 1.0, 0, 255, bpm, 2))
  alphaEvents.push(makeAnimationEvent(1.0, duration - 1.0, 255, 255, bpm))
  alphaEvents.push(makeAnimationEvent(duration - 1.0, duration, 255, 0, bpm, 2))
  layer.alphaEvents = alphaEvents
  layer.speedEvents = [makeSpeedEvent(0, duration, fallSpeed, fallSpeed, bpm)]

  return line
}

function makeDecorLine(index: number, duration: number, bpm: number, fallSpeed: number): JudgeLine {
  const line = createJudgeLine(`Decor ${index}`, 2)
  line.Texture = 'line.png'
  line.father = -1
  line.isCover = 0
  line.zOrder = 0

  const layer = line.eventLayers[0]
  const offset = index * 100

  layer.moveXEvents = [makeAnimationEvent(0, duration, 0, 0, bpm)]
  layer.moveYEvents = [makeAnimationEvent(0, duration, offset, offset, bpm)]
  layer.rotateEvents = [makeAnimationEvent(0, duration, 0, 0, bpm)]

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

export function buildJudgeLinesForTemplate(
  template: string, notes: Note[], lastTime: number, bpm: number,
  judgeLineCount: number, fallSpeed: number = DEFAULT_SPEED
): JudgeLine[] {
  const lines: JudgeLine[] = []
  lines.push(makeMainLine(notes, lastTime, bpm, fallSpeed))
  lines.push(makeDecorLine(0, lastTime, bpm, fallSpeed))
  return lines
}
