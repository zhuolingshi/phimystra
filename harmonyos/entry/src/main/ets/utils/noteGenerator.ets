import { Onset, BandEnergy } from './onsetDetection'
import { MusicSegment, SegmentType } from './audioAnalysis'
import { Note, BeatTime, NOTE_TYPE_TAP, NOTE_TYPE_HOLD, NOTE_TYPE_FLICK, NOTE_TYPE_DRAG,
  secondsToBeatTime, createNote } from '../model/chart'
import { DifficultyParams } from './difficultyParams'

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

class GridPoint {
  time: number = 0
  beatIndex: number = 0
  isStrong: boolean = false
  isMedium: boolean = false
}

function buildBeatGrid(bpm: number, duration: number, subdivision: number): GridPoint[] {
  const beatDur = 60 / bpm
  const gridDur = beatDur / subdivision
  const grid: GridPoint[] = []
  let beatIndex = 0
  for (let t = 0; t < duration; t += gridDur) {
    const gp = new GridPoint()
    gp.time = Math.round(t * 1000) / 1000
    gp.beatIndex = beatIndex
    gp.isStrong = beatIndex % subdivision === 0
    gp.isMedium = beatIndex % Math.max(1, Math.floor(subdivision / 2)) === 0
    grid.push(gp)
    beatIndex++
  }
  return grid
}

class NoteCandidate {
  time: number = 0
  intensity: number = 0
  onsetDuration: number = 0
  isStrong: boolean = false
  isMedium: boolean = false
  hasOnset: boolean = false
  bands: BandEnergy = { low: 0.33, mid: 0.33, high: 0.34 }
}

function snapOnsetsToGrid(
  onsets: Onset[], grid: GridPoint[], subdivision: number, bpm: number
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
      const c = new NoteCandidate()
      c.time = point.time
      c.intensity = onset.intensity
      c.onsetDuration = dur
      c.isStrong = point.isStrong
      c.isMedium = point.isMedium
      c.hasOnset = true
      c.bands = onset.bands
      candidates.push(c)
    }
  }
  candidates.sort((a, b) => a.time - b.time)
  return candidates
}

function getSegMultiplier(time: number, segments: MusicSegment[] | undefined): number {
  if (!segments || segments.length === 0) return 1.0
  for (const seg of segments) {
    if (time >= seg.start && time < seg.end) return seg.densityMultiplier
  }
  return 1.0
}

function regulateDensity(
  candidates: NoteCandidate[], params: DifficultyParams, segments: MusicSegment[] | undefined
): NoteCandidate[] {
  const minSpacing = params.clickInterval

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
          Math.max(1, Math.ceil(params.targetNPS * gap * segMul * 0.2))
        )
        for (let j = 1; j <= numFill; j++) {
          const fillTime = spaced[i].time + (gap / (numFill + 1)) * j
          const fc = new NoteCandidate()
          fc.time = Math.round(fillTime * 1000) / 1000
          fc.intensity = 0.15
          fc.onsetDuration = 0
          fc.isStrong = false
          fc.isMedium = true
          fc.hasOnset = false
          fc.bands = { low: 0.33, mid: 0.33, high: 0.34 }
          filled.push(fc)
        }
      }
    }
  }
  return filled
}

class NoteTypeDecision {
  type: number = NOTE_TYPE_TAP
  holdDuration: number = 0
}

function classifyNoteType(
  c: NoteCandidate, prev: NoteCandidate | null, params: DifficultyParams,
  activeHoldCount: number, isSimultaneous: boolean, rand: () => number
): NoteTypeDecision {
  const d = new NoteTypeDecision()
  if (!c.hasOnset) { return d }

  const gapToPrev = prev ? c.time - prev.time : Infinity
  const fastThreshold = params.clickInterval * 1.8

  if (c.onsetDuration > params.holdThreshold && c.bands.low > 0.35 &&
    !isSimultaneous && activeHoldCount < MAX_SIMULTANEOUS_HOLDS && rand() < 0.35) {
    d.type = NOTE_TYPE_HOLD
    d.holdDuration = Math.max(0.2, Math.min(1.0, c.onsetDuration))
    return d
  }

  const isAccent = c.intensity > 0.4 && (c.bands.high > 0.32 || (c.isStrong && c.intensity > 0.55))
  if (isAccent && rand() < params.flickProbability * 3) {
    d.type = NOTE_TYPE_FLICK
    return d
  }

  if (gapToPrev < fastThreshold && prev && prev.hasOnset && rand() < params.dragProbability * 2) {
    d.type = NOTE_TYPE_DRAG
    return d
  }

  return d
}

class ActiveHold {
  endTime: number = 0
  positionX: number = 0
}

class GeneratedNote {
  type: number = NOTE_TYPE_TAP
  time: number = 0
  endTime: number = 0
  positionX: number = 0
  above: number = 1
}

class PositionAllocator {
  private currentLane: number = CENTER_LANE
  private lastDir: number = 0
  private sameLaneCount: number = 0

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
    const preferred: number[] = []
    for (const l of pool) {
      if (Math.sign(l - this.currentLane) === preferDir || l === this.currentLane) preferred.push(l)
    }
    const finalPool = preferred.length > 0 ? preferred : pool
    const newLane = finalPool[Math.floor(rand() * finalPool.length)]

    const dir = Math.sign(newLane - this.currentLane)
    if (dir === 0) this.sameLaneCount++
    else { this.sameLaneCount = 0; this.lastDir = dir }
    this.currentLane = newLane

    return LANE_POSITIONS[newLane]
  }

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
  candidates: NoteCandidate[], params: DifficultyParams, rand: () => number
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
    const allBlocked = new Set<number>()
    exactBlocked.forEach(v => { allBlocked.add(v) })
    nearBlocked.forEach(v => { allBlocked.add(v) })

    let recentCount = 0
    for (const r of result) {
      if (Math.abs(r.time - c.time) < SIMULTANEOUS_WINDOW) recentCount++
    }
    if (recentCount >= params.maxSimultaneous) continue

    const isSimultaneous = recentCount > 0
    const decision = classifyNoteType(c, prev, params, activeHolds.length, isSimultaneous, rand)
    let type = decision.type

    let positionX: number
    if (type === NOTE_TYPE_HOLD) {
      positionX = allocator.pickRandom(rand, allBlocked)
      if (positionX === -1) {
        type = NOTE_TYPE_TAP
        positionX = allocator.pick(rand, params.maxLaneJump, allBlocked)
      }
    } else if (type === NOTE_TYPE_FLICK || type === NOTE_TYPE_DRAG) {
      positionX = allocator.pick(rand, params.maxLaneJump, nearBlocked)
    } else {
      positionX = allocator.pick(rand, params.maxLaneJump, allBlocked)
      if (positionX === -1) {
        type = NOTE_TYPE_FLICK
        positionX = allocator.pick(rand, params.maxLaneJump, nearBlocked)
      }
    }

    if (positionX === -1) continue

    let endTime = c.time
    if (type === NOTE_TYPE_HOLD) {
      endTime = c.time + decision.holdDuration
      const ah = new ActiveHold()
      ah.endTime = endTime; ah.positionX = positionX
      activeHolds.push(ah)
      activeHolds.sort((a, b) => a.endTime - b.endTime)
    }

    const gn = new GeneratedNote()
    gn.type = type; gn.time = c.time; gn.endTime = endTime
    gn.positionX = positionX; gn.above = 1
    result.push(gn)
  }

  return cleanupHoldConflicts(result)
}

function cleanupHoldConflicts(notes: GeneratedNote[]): GeneratedNote[] {
  const holds: GeneratedNote[] = notes.filter(n => n.type === NOTE_TYPE_HOLD)
  if (holds.length === 0) return notes

  const toRemove = new Set<number>()

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]
    if (n.type === NOTE_TYPE_HOLD) continue

    for (const h of holds) {
      if (n.time < h.time || n.time >= h.endTime) continue
      const dist = Math.abs(n.positionX - h.positionX)

      if (n.type === NOTE_TYPE_TAP) {
        if (dist <= 135) { toRemove.add(i); break }
      } else if (n.type === NOTE_TYPE_FLICK || n.type === NOTE_TYPE_DRAG) {
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

class TimeRange {
  start: number = 0
  end: number = 0
}

class HoldRange {
  start: number = 0
  end: number = 0
  positionX: number = 0
}

function beatTimeToSec(note: Note, bpm: number): TimeRange {
  const beatDur = 60 / bpm
  const r = new TimeRange()
  r.start = note.startTime.toBeats() * beatDur
  r.end = note.endTime.toBeats() * beatDur
  return r
}

function finalHoldSafetyCheck(notes: Note[], bpm: number): Note[] {
  const holdRanges: HoldRange[] = []
  for (const n of notes) {
    if (n.type === NOTE_TYPE_HOLD) {
      const r = beatTimeToSec(n, bpm)
      const hr = new HoldRange()
      hr.start = r.start
      hr.end = r.end
      hr.positionX = n.positionX
      holdRanges.push(hr)
    }
  }

  if (holdRanges.length === 0) return notes

  return notes.filter(n => {
    if (n.type === NOTE_TYPE_FLICK || n.type === NOTE_TYPE_DRAG) return true
    if (n.type === NOTE_TYPE_HOLD) return true

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
  onsets: Onset[], params: DifficultyParams, bpm: number = 120,
  seed: number = 42, segments?: MusicSegment[], duration: number = 300
): Note[] {
  const rand = seededRandom(seed)

  const grid = buildBeatGrid(bpm, duration, params.beatSubdivision)
  let candidates = snapOnsetsToGrid(onsets, grid, params.beatSubdivision, bpm)

  if (candidates.length < 10) {
    for (const point of grid) {
      if (point.isStrong && point.time > 0) {
        const c = new NoteCandidate()
        c.time = point.time; c.intensity = 0.15; c.onsetDuration = 0
        c.isStrong = true; c.isMedium = false; c.hasOnset = false
        c.bands = { low: 0.33, mid: 0.33, high: 0.34 }
        candidates.push(c)
      }
    }
    candidates.sort((a, b) => a.time - b.time)
  }

  candidates = regulateDensity(candidates, params, segments)
  const generated = generateNotesUnified(candidates, params, rand)

  const notes: Note[] = generated.map(g =>
    createNote(g.type, secondsToBeatTime(g.time, bpm), secondsToBeatTime(g.endTime, bpm),
      g.above, 1, g.positionX)
  )

  return finalHoldSafetyCheck(notes, bpm)
}

export function countNoteTypes(notes: Note[]): Map<string, number> {
  const counts = new Map<string, number>([
    ['tap', 0], ['hold', 0], ['flick', 0], ['drag', 0]
  ])
  const typeNames = new Map<number, string>([
    [1, 'tap'], [2, 'hold'], [3, 'flick'], [4, 'drag']
  ])
  for (const note of notes) {
    const name = typeNames.get(note.type) ?? 'unknown'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return counts
}
