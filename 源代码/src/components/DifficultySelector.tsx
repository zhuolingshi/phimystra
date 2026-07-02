import { useProjectStore } from '../stores/projectStore'
import { levelToParams, levelToRPEString, getDifficultyTier } from '../modules/chartEngine/difficultyParams'

const TIER_COLORS: Record<string, string> = {
  beginner: '#4caf50',
  easy: '#2196f3',
  normal: '#ff9800',
  hard: '#f44336',
}

const TIER_LABELS: Record<string, string> = {
  beginner: '入门',
  easy: '简单',
  normal: '中等',
  hard: '困难',
}

export function DifficultySelector() {
  const { difficulty, setDifficulty } = useProjectStore()
  const params = levelToParams(difficulty)
  const tier = getDifficultyTier(difficulty)
  const color = TIER_COLORS[tier]

  return (
    <div style={{ padding: '16px', backgroundColor: '#1a1a2e', borderRadius: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ color: '#ccc' }}>难度选择</span>
        <span style={{
          padding: '4px 12px', borderRadius: '6px',
          backgroundColor: color, color: '#fff', fontWeight: 'bold',
        }}>
          {levelToRPEString(difficulty)} · {TIER_LABELS[tier]}
        </span>
      </div>

      <input
        type="range"
        min={1}
        max={16}
        value={difficulty}
        onChange={(e) => setDifficulty(Number(e.target.value))}
        style={{ width: '100%', accentColor: color }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.8em', color: '#666' }}>
        <span>Lv.1</span>
        <span>Lv.16</span>
      </div>

      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85em', color: '#999' }}>
        <div>音符密度: {(params.noteDensity * 100).toFixed(0)}%</div>
        <div>判定线: {params.judgeLineCount} 条</div>
        <div>Flick 概率: {(params.flickProbability * 100).toFixed(0)}%</div>
        <div>长按阈值: {params.holdThreshold}s</div>
      </div>
    </div>
  )
}
