import { RPEChart, Note, JudgeLine, AnimationEvent, SpeedEvent,
  createJudgeLine, createEmptyChart, secondsToBeatTime, BeatTime, BPMEntry } from '../model/chart'
import { buildJudgeLinesForTemplate } from './lineTemplates'
import { DifficultyParams, levelToRPEString } from './difficultyParams'

export interface ChartBuildParams {
  name: string
  composer: string
  charter: string
  notes: Note[]
  difficulty: DifficultyParams
  duration: number
  bpm: number
}

export function buildChart(params: ChartBuildParams): RPEChart {
  const chart = createEmptyChart(params.name, params.composer, params.charter,
    levelToRPEString(params.difficulty.level))

  const bpmEntry = new BPMEntry()
  bpmEntry.bpm = params.bpm
  bpmEntry.startTime = new BeatTime(0, 0, 1)
  chart.BPMList = [bpmEntry]

  const judgeLines = buildJudgeLinesForTemplate(
    params.difficulty.lineTemplate, params.notes, params.duration,
    params.bpm, params.difficulty.judgeLineCount, params.difficulty.fallSpeed
  )

  chart.judgeLineList = judgeLines
  return chart
}

export function validateChart(chart: RPEChart): string[] {
  const errors: string[] = []

  if (!chart.META.name) errors.push('META.name 缺失')
  if (!chart.META.RPEVersion) errors.push('META.RPEVersion 缺失')
  if (chart.BPMList.length === 0) errors.push('BPMList 为空')
  if (chart.judgeLineList.length === 0) errors.push('judgeLineList 为空')

  let totalNotes = 0
  for (const line of chart.judgeLineList) {
    if (!line.eventLayers || line.eventLayers.length === 0) {
      errors.push(`判定线 "${line.Name}" 缺少 eventLayers`)
    }
    for (const note of line.notes) {
      totalNotes++
      if (note.type < 1 || note.type > 4) {
        errors.push(`音符类型无效: ${note.type}`)
      }
    }
  }

  if (totalNotes === 0) errors.push('谱面没有音符')

  return errors
}
