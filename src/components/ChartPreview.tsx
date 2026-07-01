import { useProjectStore } from '../stores/projectStore'
import type { ChartGenerationResult } from '../modules/chartEngine'

const NOTE_TYPE_COLORS: Record<string, string> = {
  tap: '#64c8ff',
  hold: '#a864ff',
  flick: '#ff6464',
  drag: '#64ff96',
}

const NOTE_TYPE_LABELS: Record<string, string> = {
  tap: 'Tap (点击)',
  hold: 'Hold (长按)',
  flick: 'Flick (滑动)',
  drag: 'Drag (滑过)',
}

export function ChartPreview() {
  const { chart, analysis } = useProjectStore()

  if (!chart) return null

  const lineCount = chart.judgeLineList.length
  const totalNotes = chart.judgeLineList.reduce((sum, l) => sum + l.numOfNotes, 0)

  // 统计音符类型
  const typeCounts: Record<string, number> = { tap: 0, hold: 0, flick: 0, drag: 0 }
  const typeMap: Record<number, string> = { 1: 'tap', 2: 'hold', 3: 'flick', 4: 'drag' }
  for (const line of chart.judgeLineList) {
    for (const note of line.notes) {
      const name = typeMap[note.type] ?? 'unknown'
      typeCounts[name] = (typeCounts[name] ?? 0) + 1
    }
  }

  return (
    <div style={{ padding: '16px', backgroundColor: '#1a1a2e', borderRadius: '12px' }}>
      <h3 style={{ marginBottom: '12px', color: '#eee' }}>📋 谱面信息</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <div style={{ color: '#999' }}>曲名: <strong style={{ color: '#eee' }}>{chart.META.name}</strong></div>
        <div style={{ color: '#999' }}>难度: <strong style={{ color: '#eee' }}>{chart.META.level}</strong></div>
        <div style={{ color: '#999' }}>BPM: <strong style={{ color: '#eee' }}>{chart.BPMList[0]?.bpm}</strong></div>
        <div style={{ color: '#999' }}>时长: <strong style={{ color: '#eee' }}>{analysis?.duration.toFixed(1)}s</strong></div>
        <div style={{ color: '#999' }}>判定线: <strong style={{ color: '#eee' }}>{lineCount} 条</strong></div>
        <div style={{ color: '#999' }}>总音符: <strong style={{ color: '#eee' }}>{totalNotes} 个</strong></div>
      </div>

      <h4 style={{ marginBottom: '8px', color: '#ccc' }}>音符分布</h4>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {Object.entries(typeCounts).map(([type, count]) => (
          <div key={type} style={{
            padding: '6px 12px', borderRadius: '6px',
            backgroundColor: NOTE_TYPE_COLORS[type] + '22',
            border: `1px solid ${NOTE_TYPE_COLORS[type]}`,
            color: NOTE_TYPE_COLORS[type],
            fontSize: '0.85em',
          }}>
            {NOTE_TYPE_LABELS[type]}: {count}
          </div>
        ))}
      </div>
    </div>
  )
}

export type { ChartGenerationResult }
