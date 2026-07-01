// AI 制谱引擎入口：整合音频分析和制谱流程

import type { AudioAnalysis } from '../audioAnalysis'
import type { Onset } from '../audioAnalysis/onsetDetection'
import type { RPEChart } from '../../types/rpe'
import { generateNotes, countNoteTypes } from './noteGenerator'
import { buildChart, validateChart } from './chartBuilder'
import { levelToParams, type DifficultyParams } from './difficultyParams'

export interface ChartGenerationResult {
  chart: RPEChart
  noteCount: number
  noteTypeCounts: Record<string, number>
  validationErrors: string[]
}

export interface GenerateChartParams {
  analysis: AudioAnalysis
  difficultyLevel: number  // 1-16
  songName: string
  composer: string
  charter: string
  seed?: number
}

export function generateChart(params: GenerateChartParams): ChartGenerationResult {
  const { analysis, difficultyLevel, songName, composer, charter, seed = 42 } = params

  const difficulty = levelToParams(difficultyLevel)
  const notes = generateNotes(analysis.onsets, difficulty, analysis.bpm, seed, analysis.segments)
  const chart = buildChart({
    name: songName,
    composer,
    charter,
    notes,
    difficulty,
    duration: analysis.duration,
    bpm: analysis.bpm,
  })

  const errors = validateChart(chart)

  return {
    chart,
    noteCount: notes.length,
    noteTypeCounts: countNoteTypes(notes),
    validationErrors: errors,
  }
}

export type { DifficultyParams, Onset }
