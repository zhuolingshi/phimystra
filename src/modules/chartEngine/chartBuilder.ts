// RPE Chart 构建器：将音符和判定线组装为完整的 RPE 谱面对象

import type { RPEChart, Note } from '../../types/rpe'
import { createEmptyChart } from '../../types/rpe'
import { buildJudgeLinesForTemplate } from './lineTemplates'
import type { DifficultyParams } from './difficultyParams'
import { levelToRPEString } from './difficultyParams'

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
  const { name, composer, charter, notes, difficulty, duration, bpm } = params

  const chart = createEmptyChart({
    name,
    composer,
    charter,
    level: levelToRPEString(difficulty.level),
  })

  // 设置 BPM
  chart.BPMList = [{ bpm, startTime: [0, 0, 1] }]

  // 构建判定线
  const judgeLines = buildJudgeLinesForTemplate({
    template: difficulty.lineTemplate,
    notes,
    lastTime: duration,
    bpm,
    judgeLineCount: difficulty.judgeLineCount,
    fallSpeed: difficulty.fallSpeed,
  })

  chart.judgeLineList = judgeLines

  return chart
}

// 验证 chart 结构完整性
export function validateChart(chart: RPEChart): string[] {
  const errors: string[] = []

  if (!chart.META?.name) errors.push('META.name 缺失')
  if (!chart.META?.RPEVersion) errors.push('META.RPEVersion 缺失')
  if (chart.BPMList?.length === 0) errors.push('BPMList 为空')
  if (chart.judgeLineList?.length === 0) errors.push('judgeLineList 为空')

  let totalNotes = 0
  for (const line of chart.judgeLineList) {
    if (!line.eventLayers?.length) {
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
