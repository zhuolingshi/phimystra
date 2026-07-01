// RPE (Re:PhiEdit) 谱面格式类型定义
// 参考: PhiGen 项目源码研究的格式规范

// 音符类型: 1=Tap, 2=Hold, 3=Flick, 4=Drag
export type NoteType = 1 | 2 | 3 | 4
export type BeatTime = [number, number, number]

export interface Note {
  above: 0 | 1
  alpha: number
  endTime: BeatTime
  isFake: 0 | 1
  positionX: number
  size: number
  speed: number
  startTime: BeatTime
  type: NoteType
  visibleTime: number
  yOffset: number
}

export interface AnimationEvent {
  startTime: BeatTime
  endTime: BeatTime
  startValue: number
  endValue: number
  easing: number
}

export interface SpeedEvent {
  startTime: BeatTime
  endTime: BeatTime
  value: number
  linkgroup: number
}

export interface EventLayer {
  alphaEvents: AnimationEvent[]
  moveXEvents: AnimationEvent[]
  moveYEvents: AnimationEvent[]
  rotateEvents: AnimationEvent[]
  speedEvents: SpeedEvent[]
}

export interface JudgeLine {
  Group: number
  Name: string
  Texture: string
  bpmfactor: number
  eventLayers: EventLayer[]
  father: number
  isCover: 0 | 1
  notes: Note[]
  numOfNotes: number
  posControl: unknown[]
  sizeControl: unknown[]
  skewControl: unknown[]
  yControl: unknown[]
  zOrder: number
  extended?: { inclineEvents: AnimationEvent[] }
}

export interface BPMEntry { bpm: number; startTime: BeatTime }

export interface RPEMeta {
  RPEVersion: number
  background: string
  charter: string
  composer: string
  id: string
  level: string
  name: string
  offset: number
  song: string
}

export interface RPEChart {
  BPMList: BPMEntry[]
  META: RPEMeta
  judgeLineGroup: string[]
  judgeLineList: JudgeLine[]
}

export const PIXELS_PER_SECOND = 512

export function secondsToBeatTime(seconds: number, bpm = 120): BeatTime {
  const totalBeats = (seconds * bpm) / 60
  const integerPart = Math.floor(totalBeats)
  const fractionalPart = totalBeats - integerPart
  const denominator = 1000
  const numerator = Math.round(fractionalPart * denominator)
  return [numerator, denominator, integerPart]
}

export function createNote(params: {
  type: NoteType; startTime: BeatTime; endTime: BeatTime
  above?: 0 | 1; speed?: number; positionX?: number
}): Note {
  return {
    above: params.above ?? 1, alpha: 255, endTime: params.endTime,
    isFake: 0, positionX: params.positionX ?? 0, size: 1,
    speed: params.speed ?? 0.25, startTime: params.startTime,
    type: params.type, visibleTime: 999999, yOffset: 0,
  }
}

export function createJudgeLine(params: { name: string; group?: number }): JudgeLine {
  return {
    Group: params.group ?? 0, Name: params.name, Texture: 'line.png',
    bpmfactor: 1,
    eventLayers: [{
      alphaEvents: [], moveXEvents: [], moveYEvents: [],
      rotateEvents: [], speedEvents: [],
    }],
    father: -1, isCover: 1, notes: [], numOfNotes: 0,
    posControl: [{ easing: 1, x: 0, y: 0 }, { easing: 1, x: 9999999, y: 0 }],
    sizeControl: [{ easing: 1, x: 0, y: 1 }, { easing: 1, x: 9999999, y: 1 }],
    skewControl: [{ easing: 1, x: 0, y: 0 }, { easing: 1, x: 9999999, y: 0 }],
    yControl: [{ easing: 1, x: 0, y: 1 }, { easing: 1, x: 9999999, y: 1 }],
    zOrder: 0,
  }
}

export function createEmptyChart(params: {
  name: string; composer: string; charter: string; level: string
}): RPEChart {
  return {
    BPMList: [{ bpm: 120, startTime: [0, 0, 1] }],
    META: {
      RPEVersion: 130, background: 'cover.png',
      charter: params.charter, composer: params.composer,
      id: '99999988', level: params.level, name: params.name,
      offset: 0, song: 'music.wav',
    },
    judgeLineGroup: ['Default', 'Border', 'Decoration'],
    judgeLineList: [],
  }
}
