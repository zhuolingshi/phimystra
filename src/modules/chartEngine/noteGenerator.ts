// 音符生成引擎 v5：音乐驱动的音符类型分配
//
// 核心理念：音符类型由音频特征决定，不是随机概率
//
// 类型分配规则（按音乐特征）：
// 1. Flick = 高频强冲击（镲片/军鼓/人声爆发）→ bands.high 高 + intensity 高
// 2. Drag  = 连续急促音符（快速旋律/鼓点连打）→ 与前一个音符间隔短
// 3. Hold  = 持续低频长音（贝斯/Pad/长音）→ onsetDuration 很长 + bands.low 高（极少）
// 4. Tap   = 其他所有正常节拍（默认）
//
// 约束规则：
// - 同一时间最多 2 个 Hold
// - Hold 持续时间内同 positionX 不能放 Tap/Hold，可以放 Flick/Drag
// - 同一时间可以有多个音符（不同 positionX）

import type { Onset, BandEnergy } from '../audioAnalysis/onsetDetection'
import type { MusicSegment } from '../audioAnalysis'
import type { Note, NoteType, BeatTime } from '../../types/rpe'
import { createNote, secondsToBeatTime } from '../../types/rpe'
import type { DifficultyParams } from './difficultyParams'

const LANE_POSITIONS = [-540, -405, -270, -135, 0, 135, 270, 405, 540]
const NUM_LANES = LANE_POSITIONS.length
const CENTER_LANE = 4
const MAX_SIMULTANEOUS_HOLDS = 2

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

// ============ Phase 1: 节拍网格 ============

interface GridPoint {
  time: number
  beatIndex: number
  isStrong: boolean
  isMedium: boolean
}

function buildBeatGrid(bpm: number, duration: number, subdivision: number): GridPoint[] {
  const beatDur = 60 / bpm
  const gridDur = beatDur / subdivision
  const grid: GridPoint[] = []
  let beatIndex = 0
  for (let t = 0; t < duration; t += gridDur) {
    grid.push({
      time: Math.round(t * 1000) / 1000,
      beatIndex,
      isStrong: beatIndex % subdivision === 0,
      isMedium: beatIndex % Math.max(1, Math.floor(subdivision / 2)) === 0,
    })
    beatIndex++
  }
  return grid
}

// ============ Phase 2: Onset → 网格对齐（保留频段信息） ============

interface NoteCandidate {
  time: number
  intensity: number
  onsetDuration: number
  isStrong: boolean
  isMedium: boolean
  hasOnset: boolean
  bands: BandEnergy
}

function snapOnsetsToGrid(
  onsets: Onset[],
  grid: GridPoint[],
  subdivision: number,
  bpm: number,
): NoteCandidate[] {
  const beatDur = 60 / bpm
  const gridDur = beatDur / subdivision
  const tolerance = gridDur * 0.5

  const gridMap = new Map<number, Onset>()
  for (const onset of onsets) {
    const gridIdx = Math.round(onset.time / gridDur)
    const gridTime = gridIdx * gridDur
    const dist = Math.abs(onset.time - gridTime)
    if (dist <= tolerance) {
      const existing = gridMap.get(gridIdx)
      if (!existing || onset.intensity > existing.intensity) {
        gridMap.set(gridIdx, onset)
      }
    }
  }

  const candidates: NoteCandidate[] = []
  for (const point of grid) {
    const onset = gridMap.get(point.beatIndex)
    if (onset) {
      const dur = Math.max(0, (onset.end ?? onset.time) - onset.time)
      candidates.push({
        time: point.time,
        intensity: onset.intensity,
        onsetDuration: dur,
        isStrong: point.isStrong,
        isMedium: point.isMedium,
        hasOnset: true,
        bands: onset.bands ?? { low: 0.33, mid: 0.33, high: 0.34 },
      })
    }
  }
  return candidates.sort((a, b) => a.time - b.time)
}

// ============ Phase 3: 密度调控 ============

function getSegMultiplier(time: number, segments: MusicSegment[] | undefined): number {
  if (!segments || segments.length === 0) return 1.0
  const seg = segments.find(s => time >= s.start && time < s.end)
  return seg ? seg.densityMultiplier : 1.0
}

function regulateDensity(
  candidates: NoteCandidate[],
  params: DifficultyParams,
  segments: MusicSegment[] | undefined,
): NoteCandidate[] {
  const minSpacing = params.clickInterval
  const targetNPS = params.targetNPS

  const spaced: NoteCandidate[] = []
  let lastTime = -minSpacing
  for (const c of candidates) {
    if (c.time - lastTime >= minSpacing) {
      spaced.push(c)
      lastTime = c.time
    } else {
      const last = spaced[spaced.length - 1]
      if (last && c.intensity > last.intensity) {
        spaced[spaced.length - 1] = c
        lastTime = c.time
      }
    }
  }

  const filled: NoteCandidate[] = []
  for (let i = 0; i < spaced.length; i++) {
    filled.push(spaced[i])
    if (i < spaced.length - 1) {
      const gap = spaced[i + 1].time - spaced[i].time
      const maxGap = Math.max(minSpacing * 4, 1.5)
      if (gap > maxGap) {
        const segMul = getSegMultiplier(spaced[i].time + gap / 2, segments)
        const fillInterval = Math.max(minSpacing * 2, 0.25)
        const numFill = Math.min(
          Math.floor(gap / fillInterval) - 1,
          Math.max(1, Math.ceil(targetNPS * gap * segMul * 0.2)),
        )
        for (let j = 1; j <= numFill; j++) {
          const fillTime = spaced[i].time + (gap / (numFill + 1)) * j
          filled.push({
            time: Math.round(fillTime * 1000) / 1000,
            intensity: 0.15,
            onsetDuration: 0,
            isStrong: false,
            isMedium: true,
            hasOnset: false,
            bands: { low: 0.33, mid: 0.33, high: 0.34 },
          })
        }
      }
    }
  }
  return filled
}

// ============ Phase 4: 音乐驱动的类型决策 ============

function classifyNoteType(
  c: NoteCandidate,
  prev: NoteCandidate | null,
  params: DifficultyParams,
  activeHoldCount: number,
  isSimultaneous: boolean,
  rand: () => number,
): { type: NoteType; holdDuration: number } {
  if (!c.hasOnset) {
    return { type: 1, holdDuration: 0 }
  }

  const gapToPrev = prev ? c.time - prev.time : Infinity
  const fastThreshold = params.clickInterval * 1.8

  // 1. Hold：只有真正持续的低频长音才做 Hold（极少）
  if (
    c.onsetDuration > params.holdThreshold &&
    c.bands.low > 0.35 &&
    !isSimultaneous &&
    activeHoldCount < MAX_SIMULTANEOUS_HOLDS &&
    rand() < 0.35
  ) {
    return { type: 2, holdDuration: Math.max(0.2, Math.min(1.0, c.onsetDuration)) }
  }

  // 2. Flick：高频强冲击（镲片/军鼓/人声爆发）
  const isAccent = c.intensity > 0.4 && (
    c.bands.high > 0.32 ||
    (c.isStrong && c.intensity > 0.55)
  )
  if (isAccent && rand() < params.flickProbability * 3) {
    return { type: 3, holdDuration: 0 }
  }

  // 3. Drag：连续急促音符（快速旋律/鼓点连打）
  if (
    gapToPrev < fastThreshold &&
    prev && prev.hasOnset &&
    rand() < params.dragProbability * 2
  ) {
    return { type: 4, holdDuration: 0 }
  }

  // 4. 默认 Tap
  return { type: 1, holdDuration: 0 }
}

// ============ Phase 5: 位置分配（带 Hold 冲突检测） ============

interface ActiveHold { endTime: number; positionX: number }
interface GeneratedNote {
  type: NoteType; time: number; endTime: number; positionX: number; above: 0 | 1
}

// Zigzag 位置选择器
class PositionAllocator {
  private currentLane = CENTER_LANE
  private lastDir = 0
  private sameLaneCount = 0

  pick(rand: () => number, maxJump: number, blocked: Set<number> | null): number {
    const minLane = Math.max(0, this.currentLane - maxJump)
    const maxLane = Math.min(NUM_LANES - 1, this.currentLane + maxJump)

    const pool: number[] = []
    for (let l = minLane; l <= maxLane; l++) {
      if (blocked && blocked.has(LANE_POSITIONS[l])) continue
      if (l === this.currentLane && this.sameLaneCount >= 1) continue
      pool.push(l)
    }

    if (pool.length === 0) {
      if (blocked) {
        for (let l = 0; l < NUM_LANES; l++) {
          if (!blocked.has(LANE_POSITIONS[l])) pool.push(l)
        }
      }
      if (pool.length === 0) return -1
    }

    const preferDir = -this.lastDir || (rand() < 0.5 ? -1 : 1)
    const preferred = pool.filter(l => Math.sign(l - this.currentLane) === preferDir || l === this.currentLane)
    const finalPool = preferred.length > 0 ? preferred : pool
    const newLane = finalPool[Math.floor(rand() * finalPool.length)]

    const dir = Math.sign(newLane - this.currentLane)
    if (dir === 0) this.sameLaneCount++
    else { this.sameLaneCount = 0; this.lastDir = dir }
    this.currentLane = newLane

    return LANE_POSITIONS[newLane]
  }

  // Hold 用随机选位（不走 zigzag）
  pickRandom(rand: () => number, blocked: Set<number>): number {
    const available: number[] = []
    for (let l = 0; l < NUM_LANES; l++) {
      if (!blocked.has(LANE_POSITIONS[l])) available.push(l)
    }
    if (available.length === 0) return -1
    const lane = available[Math.floor(rand() * available.length)]
    this.currentLane = lane
    return LANE_POSITIONS[lane]
  }
}

function generateNotesUnified(
  candidates: NoteCandidate[],
  params: DifficultyParams,
  rand: () => number,
): GeneratedNote[] {
  const result: GeneratedNote[] = []
  const activeHolds: ActiveHold[] = []
  const allocator = new PositionAllocator()

  const SIMULTANEOUS_WINDOW = params.clickInterval * 2.1

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    const prev = i > 0 ? candidates[i - 1] : null

    while (activeHolds.length > 0 && activeHolds[0].endTime <= c.time) {
      activeHolds.shift()
    }

    const exactBlocked = new Set<number>()
    const nearBlocked = new Set<number>()
    for (const h of activeHolds) {
      exactBlocked.add(h.positionX)
      const laneIdx = LANE_POSITIONS.indexOf(h.positionX)
      if (laneIdx > 0) nearBlocked.add(LANE_POSITIONS[laneIdx - 1])
      if (laneIdx < NUM_LANES - 1) nearBlocked.add(LANE_POSITIONS[laneIdx + 1])
    }
    const allBlocked = new Set([...exactBlocked, ...nearBlocked])

    const recentCount = result.filter(r => Math.abs(r.time - c.time) < SIMULTANEOUS_WINDOW).length
    if (recentCount >= params.maxSimultaneous) continue

    const isSimultaneous = recentCount > 0

    // 类型决策
    const decision = classifyNoteType(c, prev, params, activeHolds.length, isSimultaneous, rand)
    let type = decision.type

    // 位置分配
    let positionX: number
    if (type === 2) {
      // Hold：避开所有被占据和相邻位置
      positionX = allocator.pickRandom(rand, allBlocked)
      if (positionX === -1) { type = 1; positionX = allocator.pick(rand, params.maxLaneJump, allBlocked) }
    } else if (type === 3 || type === 4) {
      // Flick/Drag：可以放在 Hold 正上方，但不能放旁边
      positionX = allocator.pick(rand, params.maxLaneJump, nearBlocked)
    } else {
      // Tap：避开 Hold 位置和旁边
      positionX = allocator.pick(rand, params.maxLaneJump, allBlocked)
      if (positionX === -1) {
        // 所有位置被 Hold 影响范围占据 → 改为 Flick（可以放 Hold 正上方）
        type = 3
        positionX = allocator.pick(rand, params.maxLaneJump, nearBlocked)
      }
    }

    if (positionX === -1) continue

    let endTime = c.time
    if (type === 2) {
      endTime = c.time + decision.holdDuration
      activeHolds.push({ endTime, positionX })
      activeHolds.sort((a, b) => a.endTime - b.endTime)
    }

    result.push({ type, time: c.time, endTime, positionX, above: 1 })
  }

  // 安全网：后处理清除 Hold 期间 nearby 的 Tap
  return cleanupHoldConflicts(result)
}

function cleanupHoldConflicts(notes: GeneratedNote[]): GeneratedNote[] {
  const holds = notes.filter(n => n.type === 2)
  if (holds.length === 0) return notes

  const toRemove = new Set<number>()

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]
    if (n.type === 2) continue

    for (const h of holds) {
      if (n.time < h.time || n.time >= h.endTime) continue
      const dist = Math.abs(n.positionX - h.positionX)

      if (n.type === 1) {
        if (dist <= 135) { toRemove.add(i); break }
      } else if (n.type === 3 || n.type === 4) {
        if (dist > 0 && dist <= 135) { toRemove.add(i); break }
      }
    }
  }

  for (let i = 0; i < holds.length; i++) {
    for (let j = i + 1; j < holds.length; j++) {
      if (holds[i].endTime <= holds[j].time || holds[j].endTime <= holds[i].time) continue
      const dist = Math.abs(holds[i].positionX - holds[j].positionX)
      if (dist <= 135) {
        const idx = notes.indexOf(holds[j])
        if (idx >= 0) toRemove.add(idx)
      }
    }
  }

  return notes.filter((_, i) => !toRemove.has(i))
}

// ============ 主入口 ============

function beatTimeToSec(bt: { startTime: BeatTime; endTime: BeatTime }, bpm: number): { start: number; end: number } {
  const beatDur = 60 / bpm
  const start = (bt.startTime[0] + bt.startTime[1] / bt.startTime[2]) * beatDur
  const end = (bt.endTime[0] + bt.endTime[1] / bt.endTime[2]) * beatDur
  return { start, end }
}

function finalHoldSafetyCheck(notes: Note[], bpm: number): Note[] {
  const holdRanges = notes
    .filter(n => n.type === 2)
    .map(n => ({ ...beatTimeToSec(n, bpm), positionX: n.positionX }))

  if (holdRanges.length === 0) return notes

  return notes.filter(n => {
    if (n.type === 3 || n.type === 4) return true
    if (n.type === 2) return true

    const nTime = beatTimeToSec(n, bpm).start
    for (const h of holdRanges) {
      if (nTime >= h.start - 0.02 && nTime <= h.end + 0.02) {
        const dist = Math.abs(n.positionX - h.positionX)
        if (dist <= 135) return false
      }
    }
    return true
  })
}

export function generateNotes(
  onsets: Onset[],
  params: DifficultyParams,
  bpm: number = 120,
  seed: number = 42,
  segments?: MusicSegment[],
): Note[] {
  const rand = seededRandom(seed)

  const grid = buildBeatGrid(bpm, 9999, params.beatSubdivision)
  let candidates = snapOnsetsToGrid(onsets, grid, params.beatSubdivision, bpm)

  if (candidates.length < 10) {
    for (const point of grid) {
      if (point.isStrong && point.time > 0) {
        candidates.push({
          time: point.time,
          intensity: 0.15,
          onsetDuration: 0,
          isStrong: true,
          isMedium: false,
          hasOnset: false,
          bands: { low: 0.33, mid: 0.33, high: 0.34 },
        })
      }
    }
    candidates.sort((a, b) => a.time - b.time)
  }

  candidates = regulateDensity(candidates, params, segments)
  const generated = generateNotesUnified(candidates, params, rand)

  const notes = generated.map(g =>
    createNote({
      type: g.type,
      startTime: secondsToBeatTime(g.time, bpm),
      endTime: secondsToBeatTime(g.endTime, bpm),
      speed: 1,
      positionX: g.positionX,
      above: g.above,
    })
  )

  return finalHoldSafetyCheck(notes, bpm)
}

// ============ 兼容函数 ============

export function filterOnsetsByDensity(onsets: Onset[], density: number): Onset[] {
  if (density >= 1.0) return [...onsets].sort((a, b) => a.time - b.time)
  const sorted = [...onsets].sort((a, b) => b.intensity - a.intensity)
  const count = Math.ceil(sorted.length * density)
  return sorted.slice(0, count).sort((a, b) => a.time - b.time)
}

export function quantizeToBeat(time: number, bpm: number, subdivision: number = 4): number {
  const beatDur = 60 / bpm
  const gridDur = beatDur / subdivision
  return Math.round(time / gridDur) * gridDur
}

export function filterOnsetsBySegmentDensity(
  onsets: Onset[],
  baseDensity: number,
  segments: MusicSegment[],
): Onset[] {
  const adjusted = onsets.map(onset => {
    const seg = segments.find(s => onset.time >= s.start && onset.time < s.end) ?? segments[0]
    return { ...onset, intensity: onset.intensity * seg.densityMultiplier }
  })
  return filterOnsetsByDensity(adjusted, baseDensity)
}

export function countNoteTypes(notes: Note[]): Record<string, number> {
  const counts: Record<string, number> = { tap: 0, hold: 0, flick: 0, drag: 0 }
  const typeNames: Record<number, string> = { 1: 'tap', 2: 'hold', 3: 'flick', 4: 'drag' }
  for (const note of notes) {
    const name = typeNames[note.type] ?? 'unknown'
    counts[name] = (counts[name] ?? 0) + 1
  }
  return counts
}
