export const NOTE_TYPE_TAP = 1
export const NOTE_TYPE_HOLD = 2
export const NOTE_TYPE_FLICK = 3
export const NOTE_TYPE_DRAG = 4

export const NOTE_HEIGHT = 90

export class BeatTime {
  whole: number = 0
  num: number = 0
  den: number = 1

  constructor(whole: number = 0, num: number = 0, den: number = 1) {
    this.whole = whole
    this.num = num
    this.den = den
  }

  toBeats(): number {
    return this.whole + (this.den !== 0 ? this.num / this.den : 0)
  }

  toJSON(): number[] {
    return [this.whole, this.num, this.den]
  }
}

export class Note {
  above: number = 1
  alpha: number = 255
  endTime: BeatTime = new BeatTime()
  isFake: number = 0
  positionX: number = 0
  size: number = 1
  speed: number = 1
  startTime: BeatTime = new BeatTime()
  type: number = NOTE_TYPE_TAP
  visibleTime: number = 999999
  yOffset: number = 0
}

export class AnimationEvent {
  startTime: BeatTime = new BeatTime()
  endTime: BeatTime = new BeatTime()
  start: number = 0
  end: number = 0
  easingType: number = 1
  bezier: number = 0
  bezierPoints: number[] = [0, 0, 0, 0]
  easingLeft: number = 0
  easingRight: number = 1
  linkgroup: number = 0
}

export class SpeedEvent {
  startTime: BeatTime = new BeatTime()
  endTime: BeatTime = new BeatTime()
  start: number = 0
  end: number = 0
  linkgroup: number = 0
  easingType: number = 1
  easingLeft: number = 0
  easingRight: number = 1
}

export class EventLayer {
  alphaEvents: AnimationEvent[] = []
  moveXEvents: AnimationEvent[] = []
  moveYEvents: AnimationEvent[] = []
  rotateEvents: AnimationEvent[] = []
  speedEvents: SpeedEvent[] = []
}

export class AlphaControlEntry {
  alpha: number = 1
  easing: number = 1
  x: number = 0
}

export class PosControlEntry {
  easing: number = 1
  pos: number = 1
  x: number = 0
}

export class SizeControlEntry {
  easing: number = 1
  size: number = 1
  x: number = 0
}

export class SkewControlEntry {
  easing: number = 1
  skew: number = 0
  x: number = 0
}

export class YControlEntry {
  easing: number = 1
  x: number = 0
  y: number = 1
}

export class ExtendedEvents {
  colorEvents: AnimationEvent[] = []
  inclineEvents: AnimationEvent[] = []
}

export class JudgeLine {
  Group: number = 0
  Name: string = ''
  Texture: string = 'line.png'
  alphaControl: AlphaControlEntry[] = []
  bpmfactor: number = 1
  eventLayers: EventLayer[] = []
  extended: ExtendedEvents = new ExtendedEvents()
  father: number = -1
  isCover: number = 1
  notes: Note[] = []
  numOfNotes: number = 0
  posControl: PosControlEntry[] = []
  sizeControl: SizeControlEntry[] = []
  skewControl: SkewControlEntry[] = []
  yControl: YControlEntry[] = []
  zOrder: number = 0
}

export class BPMEntry {
  bpm: number = 120
  startTime: BeatTime = new BeatTime()
}

export class RPEMeta {
  RPEVersion: number = 130
  background: string = 'cover.png'
  charter: string = ''
  composer: string = ''
  id: string = '99999988'
  level: string = ''
  name: string = ''
  offset: number = 0
  song: string = 'music.wav'
}

export class RPEChart {
  BPMList: BPMEntry[] = []
  META: RPEMeta = new RPEMeta()
  judgeLineGroup: string[] = ['Default', 'Border', 'Decoration']
  judgeLineList: JudgeLine[] = []
}

export function secondsToBeatTime(seconds: number, bpm: number = 120): BeatTime {
  const totalBeats = (seconds * bpm) / 60
  const integerPart = Math.floor(totalBeats)
  const fractionalPart = totalBeats - integerPart
  const denominator = 1000
  const numerator = Math.round(fractionalPart * denominator)
  return new BeatTime(integerPart, numerator, denominator)
}

export function createNote(type: number, startTime: BeatTime, endTime: BeatTime,
  above: number = 1, speed: number = 1, positionX: number = 0): Note {
  const note = new Note()
  note.above = above
  note.alpha = 255
  note.endTime = endTime
  note.isFake = 0
  note.positionX = positionX
  note.size = 1
  note.speed = speed
  note.startTime = startTime
  note.type = type
  note.visibleTime = 999999
  note.yOffset = 0
  return note
}

export function createJudgeLine(name: string, group: number = 0): JudgeLine {
  const line = new JudgeLine()
  line.Group = group
  line.Name = name
  line.Texture = 'line.png'

  const ac1 = new AlphaControlEntry(); ac1.alpha = 1; ac1.easing = 1; ac1.x = 0
  const ac2 = new AlphaControlEntry(); ac2.alpha = 1; ac2.easing = 1; ac2.x = 9999999
  line.alphaControl = [ac1, ac2]

  line.bpmfactor = 1

  const layer = new EventLayer()
  line.eventLayers = [layer]
  line.extended = new ExtendedEvents()
  line.father = -1
  line.isCover = 1
  line.notes = []
  line.numOfNotes = 0

  const pc1 = new PosControlEntry(); pc1.easing = 1; pc1.pos = 1; pc1.x = 0
  const pc2 = new PosControlEntry(); pc2.easing = 1; pc2.pos = 1; pc2.x = 9999999
  line.posControl = [pc1, pc2]

  const sc1 = new SizeControlEntry(); sc1.easing = 1; sc1.size = 1; sc1.x = 0
  const sc2 = new SizeControlEntry(); sc2.easing = 1; sc2.size = 1; sc2.x = 9999999
  line.sizeControl = [sc1, sc2]

  const skc1 = new SkewControlEntry(); skc1.easing = 1; skc1.skew = 0; skc1.x = 0
  const skc2 = new SkewControlEntry(); skc2.easing = 1; skc2.skew = 0; skc2.x = 9999999
  line.skewControl = [skc1, skc2]

  const yc1 = new YControlEntry(); yc1.easing = 1; yc1.x = 0; yc1.y = 1
  const yc2 = new YControlEntry(); yc2.easing = 1; yc2.x = 9999999; yc2.y = 1
  line.yControl = [yc1, yc2]

  line.zOrder = 0
  return line
}

export function createEmptyChart(name: string, composer: string, charter: string, level: string): RPEChart {
  const chart = new RPEChart()
  const bpmEntry = new BPMEntry()
  bpmEntry.bpm = 120
  bpmEntry.startTime = new BeatTime(0, 0, 1)
  chart.BPMList = [bpmEntry]

  const meta = new RPEMeta()
  meta.RPEVersion = 130
  meta.background = 'cover.png'
  meta.charter = charter
  meta.composer = composer
  meta.id = '99999988'
  meta.level = level
  meta.name = name
  meta.offset = 0
  meta.song = 'music.wav'
  chart.META = meta

  chart.judgeLineGroup = ['Default', 'Border', 'Decoration']
  chart.judgeLineList = []
  return chart
}
