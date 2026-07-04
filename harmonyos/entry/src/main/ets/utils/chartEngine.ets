import { AudioAnalysis } from './audioAnalysis'
import { RPEChart, Note, createNote, secondsToBeatTime } from '../model/chart'
import { buildChart, validateChart } from './chartBuilder'
import { DifficultyParams, Playstyle, levelToParams, applyPlaystyle, levelToRPEString } from './difficultyParams'

export interface ChartGenerationResult {
  chart: RPEChart
  noteCount: number
  noteTypeCounts: Map<string, number>
  validationErrors: string[]
}

export interface GenerateChartParams {
  analysis: AudioAnalysis
  difficultyLevel: number
  playstyle?: Playstyle
  songName: string
  composer: string
  charter: string
  seed?: number
}

export function generateChart(params: GenerateChartParams): ChartGenerationResult {
  let difficulty = levelToParams(params.difficultyLevel)
  if (params.playstyle) {
    difficulty = applyPlaystyle(difficulty, params.playstyle)
  }

  const bpm = params.analysis.bpm
  const duration = params.analysis.duration
  const beatDur = 60 / bpm

  const positions = [-540, -405, -270, -135, 0, 135, 270, 405, 540]
  const notes: Note[] = []
  let laneIdx = 4
  let noteIdx = 0
  for (let t = beatDur; t < duration - 1; t += beatDur) {
    if (noteIdx % 2 === 0) {
      laneIdx = (laneIdx + 1 + Math.floor(Math.random() * 3)) % 9
    }
    notes.push(createNote(1, secondsToBeatTime(t, bpm), secondsToBeatTime(t, bpm), 1, 1, positions[laneIdx]))
    noteIdx++
  }

  const chart = buildChart({
    name: params.songName,
    composer: params.composer,
    charter: params.charter,
    notes: notes,
    difficulty: difficulty,
    duration: duration,
    bpm: bpm
  })

  const errors = validateChart(chart)

  const counts = new Map<string, number>()
  counts.set('tap', notes.length)
  counts.set('hold', 0)
  counts.set('flick', 0)
  counts.set('drag', 0)

  return {
    chart: chart,
    noteCount: notes.length,
    noteTypeCounts: counts,
    validationErrors: errors
  }
}
