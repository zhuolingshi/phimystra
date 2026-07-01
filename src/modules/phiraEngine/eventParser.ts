// RPE 事件解析器：借鉴 phi-chart-render 预处理策略 + PhiZone 实时缓动计算
// 负责：beat→sec 转换、事件值插值、floorPosition 预积分

import type { RPEChart, Note, BeatTime, BPMEntry } from '../../types/rpe'
import { getEasingFn } from './easings'

export interface ProcessedBPM {
  bpm: number
  startBeat: number
  startTimeSec: number
}

export interface TimedEvent {
  startTime: number
  endTime: number
  start: number
  end: number
  easing: number
}

export interface FloorPosEntry {
  time: number
  floorPos: number
  speed: number
}

export interface ProcessedNote {
  type: number
  startTime: number
  endTime: number
  positionX: number
  speed: number
  floorPosition: number
  above: boolean
  yOffset: number
  alpha: number
  size: number
}

export interface ProcessedLine {
  index: number
  moveXEvents: TimedEvent[]
  moveYEvents: TimedEvent[]
  rotateEvents: TimedEvent[]
  alphaEvents: TimedEvent[]
  speedEvents: TimedEvent[]
  floorPosTable: FloorPosEntry[]
  notes: ProcessedNote[]
  father: number
  isCover: boolean
  bpmfactor: number
}

export interface ProcessedChart {
  lines: ProcessedLine[]
  bpmList: ProcessedBPM[]
  duration: number
  offset: number
}

function beatTimeToBeats(bt: BeatTime): number {
  return bt[2] + (bt[1] !== 0 ? bt[0] / bt[1] : 0)
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
  return beatsToSeconds(beatTimeToBeats(bt), bpmList)
}

function processBPMList(bpmEntries: BPMEntry[]): ProcessedBPM[] {
  const sorted = [...bpmEntries].sort((a, b) => beatTimeToBeats(a.startTime) - beatTimeToBeats(b.startTime))
  const result: ProcessedBPM[] = []
  let prevSec = 0
  for (const entry of sorted) {
    const startBeat = beatTimeToBeats(entry.startTime)
    const startTimeSec = result.length === 0 ? 0 : prevSec + (startBeat - result[result.length - 1].startBeat) * (60 / result[result.length - 1].bpm)
    result.push({ bpm: entry.bpm, startBeat, startTimeSec })
    prevSec = startTimeSec
  }
  return result
}

function convertEvents(
  events: { startTime: BeatTime; endTime: BeatTime; startValue: number; endValue: number; easing: number }[],
  bpmList: ProcessedBPM[]
): TimedEvent[] {
  return events.map(e => ({
    startTime: beatTimeToSeconds(e.startTime, bpmList),
    endTime: beatTimeToSeconds(e.endTime, bpmList),
    start: e.startValue,
    end: e.endValue,
    easing: e.easing,
  })).sort((a, b) => a.startTime - b.startTime)
}

function computeFloorPosTable(speedEvents: TimedEvent[]): FloorPosEntry[] {
  if (speedEvents.length === 0) {
    return [{ time: -999999, floorPos: 0, speed: 0.6 }]
  }
  const table: FloorPosEntry[] = []
  let floorPos = 0
  for (const e of speedEvents) {
    table.push({ time: e.startTime, floorPos, speed: e.start })
    const dt = e.endTime - e.startTime
    const avgSpeed = (e.start + e.end) / 2
    floorPos += dt * avgSpeed
  }
  const last = speedEvents[speedEvents.length - 1]
  table.push({ time: last.endTime, floorPos, speed: last.end })
  return table
}

function processNotes(
  notes: Note[],
  bpmList: ProcessedBPM[],
  speedEvents: TimedEvent[]
): ProcessedNote[] {
  const floorTable = computeFloorPosTable(speedEvents)
  return notes.map(note => {
    const startTime = beatTimeToSeconds(note.startTime, bpmList)
    const endTime = beatTimeToSeconds(note.endTime, bpmList)
    const floorPos = queryFloorPosition(floorTable, startTime)
    return {
      type: note.type,
      startTime, endTime,
      positionX: note.positionX,
      speed: note.speed,
      floorPosition: floorPos,
      above: note.above === 1,
      yOffset: note.yOffset ?? 0,
      alpha: note.alpha ?? 255,
      size: note.size ?? 1,
    }
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
  if (table.length === 0) return 0.6
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

export function parseChart(chart: RPEChart): ProcessedChart {
  const bpmList = processBPMList(chart.BPMList)
  const lines: ProcessedLine[] = chart.judgeLineList.map((line, idx) => {
    const layer = line.eventLayers[0] ?? line.eventLayers[0]
    const moveXEvents = layer ? convertEvents(layer.moveXEvents, bpmList) : []
    const moveYEvents = layer ? convertEvents(layer.moveYEvents, bpmList) : []
    const rotateEvents = layer ? convertEvents(layer.rotateEvents, bpmList) : []
    const alphaEvents = layer ? convertEvents(layer.alphaEvents, bpmList) : []
    const speedEventsRaw = layer ? convertEvents(
      layer.speedEvents.map(s => ({
        startTime: s.startTime, endTime: s.endTime,
        startValue: s.value, endValue: s.value, easing: 1,
      })), bpmList
    ) : []
    const floorPosTable = computeFloorPosTable(speedEventsRaw)
    const notes = processNotes(line.notes, bpmList, speedEventsRaw)
    return {
      index: idx,
      moveXEvents, moveYEvents, rotateEvents, alphaEvents,
      speedEvents: speedEventsRaw,
      floorPosTable,
      notes,
      father: line.father,
      isCover: line.isCover === 1,
      bpmfactor: line.bpmfactor ?? 1,
    }
  })
  const maxNoteTime = Math.max(...lines.flatMap(l => l.notes.map(n => n.endTime)), 0)
  return {
    lines, bpmList,
    duration: maxNoteTime + 2,
    offset: chart.META.offset ?? 0,
  }
}

export function getLineState(line: ProcessedLine, time: number) {
  const x = getEventValue(line.moveXEvents, time, 0)
  const y = getEventValue(line.moveYEvents, time, 0)
  const rotation = getEventValue(line.rotateEvents, time, 0)
  const rawAlpha = getEventValue(line.alphaEvents, time, 1)
  const alpha = rawAlpha > 1 ? rawAlpha / 255 : rawAlpha
  const floorPos = queryFloorPosition(line.floorPosTable, time)
  const speed = queryFloorSpeed(line.floorPosTable, time)
  return { x, y, rotation, alpha, floorPos, speed }
}
