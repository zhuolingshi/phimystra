import { AudioAnalysis } from './audioAnalysis'
import { RPEChart } from '../model/chart'
import { generateNotes, countNoteTypes } from './noteGenerator'
import { buildChart, validateChart } from './chartBuilder'
import { DifficultyParams, Playstyle, levelToParams, applyPlaystyle } from './difficultyParams'

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
  const seed = params.seed ?? (Date.now() % 2147483647)

  let difficulty = levelToParams(params.difficultyLevel)
  if (params.playstyle) {
    difficulty = applyPlaystyle(difficulty, params.playstyle)
  }
  const notes = generateNotes(params.analysis.onsets, difficulty, params.analysis.bpm, seed, params.analysis.segments, params.analysis.duration)
  const chart = buildChart({
    name: params.songName,
    composer: params.composer,
    charter: params.charter,
    notes: notes,
    difficulty: difficulty,
    duration: params.analysis.duration,
    bpm: params.analysis.bpm
  })

  const errors = validateChart(chart)

  return {
    chart: chart,
    noteCount: notes.length,
    noteTypeCounts: countNoteTypes(notes),
    validationErrors: errors
  }
}
