// 音符生成引擎：将 onset 转换为 RPE 音符（Tap/Hold/Drag/Flick 决策逻辑）
// 参考 PhiGen 的 appendPattern 算法

import type { Onset } from '../audioAnalysis/onsetDetection'
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

interface NoteGenState {
  noteType: NoteType
  endTime: number  // 上一个音符的结束时间(秒)
}

// 核心：将单个 onset 转换为音符（参考 PhiGen appendPattern）
function onsetToNotes(
  onset: Onset,
  prev: NoteGenState,
  params: DifficultyParams,
  rand: () => number,
  bpm: number
): { notes: Note[]; next: NoteGenState } {
  const { time: startTime, end: endTime } = onset
  const duration = endTime - startTime
  const isLong = duration > params.holdThreshold
  const interval = prev.noteType === 1 ? params.clickInterval : params.holdInterval
  const tooClose = startTime - prev.endTime < interval
  const flickEnd = rand() < params.flickProbability
  const notes: Note[] = []

  const beatStart = secondsToBeatTime(startTime, bpm)
  const beatEnd = secondsToBeatTime(endTime, bpm)

  if (isLong) {
    if (tooClose) {
      // Drag 链
      const dragStep = params.dragInterval
      for (let t = startTime; t < endTime; t += dragStep) {
        const bt = secondsToBeatTime(t, bpm)
        notes.push(createNote({ type: 4, startTime: bt, endTime: bt, speed: params.fallSpeed }))
      }
      if (flickEnd) {
        notes.push(createNote({ type: 3, startTime: beatEnd, endTime: beatEnd, speed: params.fallSpeed }))
      }
      return { notes, next: { noteType: flickEnd ? 3 : 4, endTime } }
    } else {
      // Hold 长按
      notes.push(createNote({ type: 2, startTime: beatStart, endTime: beatEnd, speed: params.fallSpeed }))
      if (flickEnd) {
        notes.push(createNote({ type: 3, startTime: beatEnd, endTime: beatEnd, speed: params.fallSpeed }))
      }
      return { notes, next: { noteType: flickEnd ? 3 : 2, endTime } }
    }
  } else if (tooClose) {
    // Drag
    notes.push(createNote({ type: 4, startTime: beatStart, endTime: beatStart, speed: params.fallSpeed }))
    return { notes, next: { noteType: 4, endTime: startTime } }
  } else {
    // Tap
    notes.push(createNote({ type: 1, startTime: beatStart, endTime: beatStart, speed: params.fallSpeed }))
    return { notes, next: { noteType: 1, endTime: startTime } }
  }
}

// 将 onset 列表转换为音符列表
export function generateNotes(
  onsets: Onset[],
  params: DifficultyParams,
  bpm: number = 120,
  seed: number = 42
): Note[] {
  const filtered = filterOnsetsByDensity(onsets, params.noteDensity)
  const rand = seededRandom(seed)
  const allNotes: Note[] = []
  let prev: NoteGenState = { noteType: 1, endTime: 0 }

  for (const onset of filtered) {
    const { notes, next } = onsetToNotes(onset, prev, params, rand, bpm)
    allNotes.push(...notes)
    prev = next
  }

  return allNotes
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
