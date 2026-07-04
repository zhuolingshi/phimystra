import { RPEChart, Note, BeatTime, BPMEntry, NOTE_HEIGHT, JudgeLine, EventLayer, AlphaControlEntry, PosControlEntry, SizeControlEntry, SkewControlEntry, YControlEntry } from '../model/chart'
import { getEasingFn } from './easings'

export class ProcessedBPM {
  bpm: number = 120
  startBeat: number = 0
  startTimeSec: number = 0
}

export class TimedEvent {
  startTime: number = 0
  endTime: number = 0
  start: number = 0
  end: number = 0
  easing: number = 1
}

export class FloorPosEntry {
  time: number = 0
  floorPos: number = 0
  speed: number = 6.0
}

export class ProcessedNote {
  type: number = 1
  startTime: number = 0
  endTime: number = 0
  positionX: number = 0
  speed: number = 1
  floorPosition: number = 0
  endFloorPosition: number = 0
  above: boolean = true
  yOffset: number = 0
  alpha: number = 255
  size: number = 1
}

export class ProcessedLine {
  index: number = 0
  moveXEvents: TimedEvent[] = []
  moveYEvents: TimedEvent[] = []
  rotateEvents: TimedEvent[] = []
  alphaEvents: TimedEvent[] = []
  speedEvents: TimedEvent[] = []
  sizeEvents: TimedEvent[] = []
  skewEvents: TimedEvent[] = []
  floorPosTable: FloorPosEntry[] = []
  notes: ProcessedNote[] = []
  father: number = -1
  isCover: boolean = true
  bpmfactor: number = 1
}

export class ProcessedChart {
  lines: ProcessedLine[] = []
  bpmList: ProcessedBPM[] = []
  duration: number = 0
  offset: number = 0
}

export class LineState {
  x: number = 0
  y: number = 0
  rotation: number = 0
  alpha: number = 1
  floorPos: number = 0
  speed: number = 6.0
  size: number = 1
  skew: number = 0
}

export function beatsToSeconds(beats: number, bpmList: ProcessedBPM[]): number {
  if (bpmList.length === 0) return 0
  let bpm = bpmList[0]
  for (let i = bpmList.length - 1; i >= 0; i--) {
    if (bpmList[i].startBeat <= beats) { bpm = bpmList[i]; break }
  }
  return bpm.startTimeSec + (beats - bpm.startBeat) * (60 / bpm.bpm)
}

function beatTimeToSeconds(bt: BeatTime, bpmList: ProcessedBPM[]): number {
  return beatsToSeconds(bt.toBeats(), bpmList)
}

function processBPMList(bpmEntries: BPMEntry[]): ProcessedBPM[] {
  const sorted = [...bpmEntries].sort((a, b) => a.startTime.toBeats() - b.startTime.toBeats())
  const result: ProcessedBPM[] = []
  let prevSec = 0
  for (const entry of sorted) {
    const startBeat = entry.startTime.toBeats()
    const startTimeSec = result.length === 0 ? 0
      : prevSec + (startBeat - result[result.length - 1].startBeat) * (60 / result[result.length - 1].bpm)
    const pb = new ProcessedBPM()
    pb.bpm = entry.bpm; pb.startBeat = startBeat; pb.startTimeSec = startTimeSec
    result.push(pb)
    prevSec = startTimeSec
  }
  return result
}

function convertEvents(
  events: { startTime: BeatTime; endTime: BeatTime; start: number; end: number; easingType?: number; easing?: number }[],
  bpmList: ProcessedBPM[]
): TimedEvent[] {
  return events.map(e => {
    const te = new TimedEvent()
    te.startTime = beatTimeToSeconds(e.startTime, bpmList)
    te.endTime = beatTimeToSeconds(e.endTime, bpmList)
    te.start = e.start; te.end = e.end
    te.easing = e.easingType ?? e.easing ?? 1
    return te
  }).sort((a, b) => a.startTime - b.startTime)
}

function computeFloorPosTable(speedEvents: TimedEvent[]): FloorPosEntry[] {
  if (speedEvents.length === 0) {
    const e = new FloorPosEntry()
    e.time = -999999; e.floorPos = 0; e.speed = 6.0
    return [e]
  }
  const table: FloorPosEntry[] = []
  let floorPos = 0
  for (const e of speedEvents) {
    const fe = new FloorPosEntry()
    fe.time = e.startTime; fe.floorPos = floorPos; fe.speed = e.start
    table.push(fe)
    const dt = e.endTime - e.startTime
    const avgSpeed = (e.start + e.end) / 2
    floorPos += dt * avgSpeed
  }
  const last = speedEvents[speedEvents.length - 1]
  const fe = new FloorPosEntry()
  fe.time = last.endTime; fe.floorPos = floorPos; fe.speed = last.end
  table.push(fe)
  return table
}

function processNotes(notes: Note[], bpmList: ProcessedBPM[], speedEvents: TimedEvent[]): ProcessedNote[] {
  const floorTable = computeFloorPosTable(speedEvents)
  return notes.map(note => {
    const startTime = beatTimeToSeconds(note.startTime, bpmList)
    const endTime = beatTimeToSeconds(note.endTime, bpmList)
    const pn = new ProcessedNote()
    pn.type = note.type; pn.startTime = startTime; pn.endTime = endTime
    pn.positionX = note.positionX; pn.speed = note.speed
    pn.floorPosition = queryFloorPosition(floorTable, startTime)
    pn.endFloorPosition = queryFloorPosition(floorTable, endTime)
    pn.above = note.above === 1; pn.yOffset = note.yOffset ?? 0
    pn.alpha = note.alpha ?? 255; pn.size = note.size ?? 1
    return pn
  })
}

export function queryFloorPosition(table: FloorPosEntry[], time: number): number {
  if (table.length === 0) return 0
  for (let i = 0; i < table.length - 1; i++) {
    if (time >= table[i].time && time < table[i + 1].time) {
      return table[i].floorPos + (time - table[i].time) * table[i].speed
    }
  }
  return table[table.length - 1].floorPos
}

export function queryFloorSpeed(table: FloorPosEntry[], time: number): number {
  if (table.length === 0) return 6.0
  for (let i = 0; i < table.length - 1; i++) {
    if (time >= table[i].time && time < table[i + 1].time) return table[i].speed
  }
  return table[table.length - 1].speed
}

export function getEventValue(events: TimedEvent[], time: number, defaultValue: number = 0): number {
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (time < e.startTime) break
    if (time > e.endTime) continue
    if (e.start === e.end) return e.start
    const x = (time - e.startTime) / (e.endTime - e.startTime)
    if (e.easing <= 1) return e.start + (e.end - e.start) * x
    const fn = getEasingFn(e.easing)
    return e.start + (e.end - e.start) * fn(x)
  }
  return defaultValue
}

function convertControlEntriesAlpha(entries: AlphaControlEntry[]): TimedEvent[] {
  if (entries.length < 2) return []
  const sorted = [...entries].sort((a, b) => a.x - b.x)
  const result: TimedEvent[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const te = new TimedEvent()
    te.startTime = sorted[i].x; te.endTime = sorted[i + 1].x
    te.start = sorted[i].alpha; te.end = sorted[i + 1].alpha
    te.easing = sorted[i + 1].easing
    result.push(te)
  }
  return result
}

function convertControlEntriesPos(entries: PosControlEntry[]): TimedEvent[] {
  if (entries.length < 2) return []
  const sorted = [...entries].sort((a, b) => a.x - b.x)
  const result: TimedEvent[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const te = new TimedEvent()
    te.startTime = sorted[i].x; te.endTime = sorted[i + 1].x
    te.start = sorted[i].pos * NOTE_HEIGHT * 4.5; te.end = sorted[i + 1].pos * NOTE_HEIGHT * 4.5
    te.easing = sorted[i + 1].easing
    result.push(te)
  }
  return result
}

function convertControlEntriesSize(entries: SizeControlEntry[]): TimedEvent[] {
  if (entries.length < 2) return []
  const sorted = [...entries].sort((a, b) => a.x - b.x)
  const result: TimedEvent[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const te = new TimedEvent()
    te.startTime = sorted[i].x; te.endTime = sorted[i + 1].x
    te.start = sorted[i].size; te.end = sorted[i + 1].size
    te.easing = sorted[i + 1].easing
    result.push(te)
  }
  return result
}

function convertControlEntriesSkew(entries: SkewControlEntry[]): TimedEvent[] {
  if (entries.length < 2) return []
  const sorted = [...entries].sort((a, b) => a.x - b.x)
  const result: TimedEvent[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const te = new TimedEvent()
    te.startTime = sorted[i].x; te.endTime = sorted[i + 1].x
    te.start = sorted[i].skew; te.end = sorted[i + 1].skew
    te.easing = sorted[i + 1].easing
    result.push(te)
  }
  return result
}

function convertControlEntriesY(entries: YControlEntry[]): TimedEvent[] {
  if (entries.length < 2) return []
  const sorted = [...entries].sort((a, b) => a.x - b.x)
  const result: TimedEvent[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const te = new TimedEvent()
    te.startTime = sorted[i].x; te.endTime = sorted[i + 1].x
    te.start = sorted[i].y * NOTE_HEIGHT; te.end = sorted[i + 1].y * NOTE_HEIGHT
    te.easing = sorted[i + 1].easing
    result.push(te)
  }
  return result
}

function mergeEvents(a: TimedEvent[], b: TimedEvent[]): TimedEvent[] {
  return [...a, ...b].sort((x, y) => x.startTime - y.startTime)
}

export function parseChart(chart: RPEChart): ProcessedChart {
  const bpmList = processBPMList(chart.BPMList)
  const lines: ProcessedLine[] = chart.judgeLineList.map((line, idx) => {
    let moveXEvents: TimedEvent[] = []
    let moveYEvents: TimedEvent[] = []
    let rotateEvents: TimedEvent[] = []
    let alphaEvents: TimedEvent[] = []
    let speedEventsRaw: TimedEvent[] = []

    for (const layer of line.eventLayers) {
      if (!layer) continue
      moveXEvents = mergeEvents(moveXEvents, convertEvents(layer.moveXEvents, bpmList))
      moveYEvents = mergeEvents(moveYEvents, convertEvents(layer.moveYEvents, bpmList))
      rotateEvents = mergeEvents(rotateEvents, convertEvents(layer.rotateEvents, bpmList))
      alphaEvents = mergeEvents(alphaEvents, convertEvents(layer.alphaEvents, bpmList))
      const layerSpeed = convertEvents(
        layer.speedEvents.map(s => ({
          startTime: s.startTime, endTime: s.endTime,
          start: s.start, end: s.end, easingType: 1
        })), bpmList
      )
      speedEventsRaw = mergeEvents(speedEventsRaw, layerSpeed)
    }

    moveYEvents = mergeEvents(moveYEvents, convertControlEntriesPos(line.posControl))
    moveYEvents = mergeEvents(moveYEvents, convertControlEntriesY(line.yControl))
    alphaEvents = mergeEvents(alphaEvents, convertControlEntriesAlpha(line.alphaControl))
    const sizeEvents = convertControlEntriesSize(line.sizeControl)
    const skewEvents = convertControlEntriesSkew(line.skewControl)

    const floorPosTable = computeFloorPosTable(speedEventsRaw)
    const notes = processNotes(line.notes, bpmList, speedEventsRaw)

    const pl = new ProcessedLine()
    pl.index = idx
    pl.moveXEvents = moveXEvents; pl.moveYEvents = moveYEvents
    pl.rotateEvents = rotateEvents; pl.alphaEvents = alphaEvents
    pl.speedEvents = speedEventsRaw; pl.floorPosTable = floorPosTable
    pl.sizeEvents = sizeEvents; pl.skewEvents = skewEvents
    pl.notes = notes; pl.father = line.father
    pl.isCover = line.isCover === 1; pl.bpmfactor = line.bpmfactor ?? 1
    return pl
  })

  let maxNoteTime = 0
  for (const l of lines) {
    for (const n of l.notes) {
      if (n.endTime > maxNoteTime) maxNoteTime = n.endTime
    }
  }

  const pc = new ProcessedChart()
  pc.lines = lines; pc.bpmList = bpmList
  pc.duration = maxNoteTime + 2; pc.offset = chart.META.offset ?? 0
  return pc
}

export function getLineState(line: ProcessedLine, time: number): LineState {
  const state = new LineState()
  state.x = getEventValue(line.moveXEvents, time, 0)
  state.y = getEventValue(line.moveYEvents, time, 0)
  state.rotation = getEventValue(line.rotateEvents, time, 0)
  const rawAlpha = getEventValue(line.alphaEvents, time, 1)
  state.alpha = rawAlpha > 1 ? rawAlpha / 255 : rawAlpha
  state.floorPos = queryFloorPosition(line.floorPosTable, time)
  state.speed = queryFloorSpeed(line.floorPosTable, time)
  state.size = getEventValue(line.sizeEvents, time, 1)
  state.skew = getEventValue(line.skewEvents, time, 0)
  return state
}
