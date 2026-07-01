// 音符生成引擎：将 onset 转换为 RPE 音符（Tap/Hold/Drag/Flick 决策逻辑）
// 增强版：频段分离决策 + 节拍量化对齐 + 段落感知密度

import type { Onset, BandEnergy } from '../audioAnalysis/onsetDetection'
import type { MusicSegment } from '../audioAnalysis'
import type { Note, NoteType, BeatTime } from '../../types/rpe'
import { createNote, secondsToBeatTime } from '../../types/rpe'
import type { DifficultyParams } from './difficultyParams'

// 确定性伪随机数生成器（用 seed 保证可复现）
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 根据 onset 强度和难度密度参数过滤 onset
export function filterOnsetsByDensity(
  onsets: Onset[],
  density: number
): Onset[] {
  if (density >= 1.0) return [...onsets].sort((a, b) => a.time - b.time)
  // 按强度排序，选取前 density 比例的 onset
  const sorted = [...onsets].sort((a, b) => b.intensity - a.intensity)
  const count = Math.ceil(sorted.length * density)
  // 返回时按时间排序
  return sorted.slice(0, count).sort((a, b) => a.time - b.time)
}

// 节拍量化对齐：将秒级时间对齐到最近的 BPM 拍子网格
export function quantizeToBeat(time: number, bpm: number, subdivision: number = 4): number {
  const beatDur = 60 / bpm
  const gridDur = beatDur / subdivision
  return Math.round(time / gridDur) * gridDur
}

// 根据频段能量决定音符类型偏好
function decideNoteTypeByBand(
  bands: BandEnergy | undefined,
  rand: () => number,
  flickProb: number
): { preferDrag: boolean; preferFlick: boolean; preferTap: boolean } {
  const b = bands ?? { low: 0.33, mid: 0.34, high: 0.33 }
  return {
    preferTap: b.low > 0.4,
    preferDrag: b.mid > 0.4 || b.high > 0.35,
    preferFlick: b.high > 0.4 && rand() < flickProb * 1.5,
  }
}

interface NoteGenState {
  noteType: NoteType
  endTime: number
  lastPos: number
}

// 生成音符水平位置，避免连续音符过近
function generatePositionX(rand: () => number, lastPos: number, difficulty: number): number {
  const spread = Math.min(600, 200 + difficulty * 30)
  for (let attempt = 0; attempt < 5; attempt++) {
    const pos = Math.round((rand() - 0.5) * spread)
    if (Math.abs(pos - lastPos) > 80) return pos
  }
  return Math.round((rand() - 0.5) * spread)
}

// 核心：将单个 onset 转换为音符（频段分离 + 节拍量化增强版）
function onsetToNotes(
  onset: Onset,
  prev: NoteGenState,
  params: DifficultyParams,
  rand: () => number,
  bpm: number
): { notes: Note[]; next: NoteGenState } {
  const { time: rawTime, end: rawEnd } = onset
  // 节拍量化对齐
  const startTime = quantizeToBeat(rawTime, bpm)
  const endTime = quantizeToBeat(rawEnd, bpm)
  const duration = endTime - startTime
  const isLong = duration > params.holdThreshold
  const interval = prev.noteType === 1 ? params.clickInterval : params.holdInterval
  const tooClose = startTime - prev.endTime < interval
  // 频段决策
  const bandPref = decideNoteTypeByBand(onset.bands, rand, params.flickProbability)
  const flickEnd = bandPref.preferFlick || rand() < params.flickProbability
  const notes: Note[] = []
  const posX = generatePositionX(rand, prev.lastPos, params.level)

  const beatStart = secondsToBeatTime(startTime, bpm)
  const beatEnd = secondsToBeatTime(endTime, bpm)

  if (isLong) {
    if (tooClose) {
      const dragStep = params.dragInterval
      for (let t = startTime; t < endTime; t += dragStep) {
        const bt = secondsToBeatTime(t, bpm)
        notes.push(createNote({ type: 4, startTime: bt, endTime: bt, speed: params.fallSpeed, positionX: posX }))
      }
      if (flickEnd) {
        notes.push(createNote({ type: 3, startTime: beatEnd, endTime: beatEnd, speed: params.fallSpeed, positionX: posX }))
      }
      return { notes, next: { noteType: flickEnd ? 3 : 4, endTime, lastPos: posX } }
    } else {
      notes.push(createNote({ type: 2, startTime: beatStart, endTime: beatEnd, speed: params.fallSpeed, positionX: posX }))
      if (flickEnd) {
        notes.push(createNote({ type: 3, startTime: beatEnd, endTime: beatEnd, speed: params.fallSpeed, positionX: posX }))
      }
      return { notes, next: { noteType: flickEnd ? 3 : 2, endTime, lastPos: posX } }
    }
  } else if (tooClose) {
    notes.push(createNote({ type: 4, startTime: beatStart, endTime: beatStart, speed: params.fallSpeed, positionX: posX }))
    return { notes, next: { noteType: 4, endTime: startTime, lastPos: posX } }
  } else {
    notes.push(createNote({ type: 1, startTime: beatStart, endTime: beatStart, speed: params.fallSpeed, positionX: posX }))
    return { notes, next: { noteType: 1, endTime: startTime, lastPos: posX } }
  }
}

// 将 onset 列表转换为音符列表（支持段落感知密度调整）
export function generateNotes(
  onsets: Onset[],
  params: DifficultyParams,
  bpm: number = 120,
  seed: number = 42,
  segments?: MusicSegment[]
): Note[] {
  // 段落感知过滤：根据段落密度倍率调整 onset 选择
  let filtered: Onset[]
  if (segments && segments.length > 0) {
    const segmentFiltered = filterOnsetsBySegmentDensity(onsets, params.noteDensity, segments)
    filtered = segmentFiltered
  } else {
    filtered = filterOnsetsByDensity(onsets, params.noteDensity)
  }

  const rand = seededRandom(seed)
  const allNotes: Note[] = []
  let prev: NoteGenState = { noteType: 1, endTime: 0, lastPos: 0 }

  for (const onset of filtered) {
    const { notes, next } = onsetToNotes(onset, prev, params, rand, bpm)
    allNotes.push(...notes)
    prev = next
  }

  return allNotes
}

// 段落感知 onset 过滤：不同段落使用不同密度倍率
export function filterOnsetsBySegmentDensity(
  onsets: Onset[],
  baseDensity: number,
  segments: MusicSegment[]
): Onset[] {
  const adjusted = onsets.map(onset => {
    const seg = segments.find(s => onset.time >= s.start && onset.time < s.end) ?? segments[0]
    const effectiveIntensity = onset.intensity * seg.densityMultiplier
    return { ...onset, intensity: effectiveIntensity }
  })
  return filterOnsetsByDensity(adjusted, baseDensity)
}

// 统计音符类型分布
export function countNoteTypes(notes: Note[]): Record<string, number> {
  const counts: Record<string, number> = { tap: 0, hold: 0, flick: 0, drag: 0 }
  const typeNames: Record<number, string> = { 1: 'tap', 2: 'hold', 3: 'flick', 4: 'drag' }
  for (const note of notes) {
    const name = typeNames[note.type] ?? 'unknown'
    counts[name] = (counts[name] ?? 0) + 1
  }
  return counts
}
