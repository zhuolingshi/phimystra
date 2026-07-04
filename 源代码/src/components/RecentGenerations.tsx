import { useState, useRef, useCallback } from 'react'
import { listGenerations, getGeneration, deleteGeneration, type GenerationPreview } from '../modules/history/db'
import { decodeAudioFile } from '../modules/audioImport/audioDecoder'
import { useProjectStore } from '../stores/projectStore'
import type { AudioAnalysis } from '../modules/audioAnalysis'
import type { RPEChart } from '../types/rpe'

const DIFFICULTY_LABELS = ['EZ', 'HD', 'IN', 'AT', 'SP']
const DIFFICULTY_COLORS = ['#4caf50', '#2196f3', '#ff9800', '#f44336', '#9c27b0']

function formatDate(ts: number): string {
  const diff = Date.now() - ts
  const day = Math.floor(diff / 86400000)
  const hour = Math.floor(diff / 3600000)
  if (day > 0) return `${day}天前`
  if (hour > 0) return `${hour}小时前`
  const min = Math.floor(diff / 60000)
  return min > 0 ? `${min}分钟前` : '刚刚'
}

export function useRecentGenerations() {
  const [items, setItems] = useState<GenerationPreview[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setItems(await listGenerations())
    } catch { /* ignore */ }
  }, [])

  return { items, refresh, loading, setLoading }
}

export function RecentGenerations({
  items, onRestored, onDeleted, isPhone,
}: {
  items: GenerationPreview[]
  onRestored: () => void
  onDeleted: () => void
  isPhone: boolean
}) {
  const { setAudio, setAnalysis, setChart, setSongName, setComposer, setDifficulty } = useProjectStore()
  const [restoring, setRestoring] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleRestore = async (id: string) => {
    if (restoring) return
    setRestoring(id)
    try {
      const entry = await getGeneration(id)
      if (!entry) return
      const blob = new Blob([entry.audioData])
      const decoded = await decodeAudioFile(blob, entry.audioName)
      setAudio(decoded)
      setAnalysis(entry.analysis as AudioAnalysis)
      setChart(entry.chart as RPEChart)
      setSongName(entry.songName)
      setComposer(entry.composer)
      setDifficulty(entry.difficulty)
      onRestored()
    } catch (err) {
      console.error('恢复失败:', err)
    } finally {
      setRestoring(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteGeneration(deleteTarget)
      setDeleteTarget(null)
      onDeleted()
    } catch { /* ignore */ }
  }

  if (items.length === 0) return null

  return (
    <div>
      <div style={{
        marginBottom: '12px', color: '#888', fontSize: '15px',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        🕒 最近生成
        <span style={{ fontSize: '12px', opacity: 0.6 }}>（长按可删除，保留 7 天）</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map(item => {
          const diffIdx = Math.min(Math.floor(item.difficulty / 3), 4)
          return (
            <div
              key={item.id}
              onTouchStart={() => {
                longPressTimer.current = setTimeout(() => setDeleteTarget(item.id), 600)
              }}
              onTouchMove={() => {
                if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
              }}
              onTouchEnd={() => {
                if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current)
                  longPressTimer.current = null
                }
              }}
              onClick={() => handleRestore(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: isPhone ? '14px 16px' : '16px 20px',
                backgroundColor: '#1a1a2e', borderRadius: '10px',
                cursor: 'pointer', border: '1px solid #252535',
                opacity: restoring === item.id ? 0.5 : 1,
                transition: 'background-color 0.15s',
              }}
            >
              <div style={{
                width: '40px', height: '40px', borderRadius: '8px',
                backgroundColor: DIFFICULTY_COLORS[diffIdx] + '22',
                border: `1px solid ${DIFFICULTY_COLORS[diffIdx]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: 'bold', color: DIFFICULTY_COLORS[diffIdx],
                flexShrink: 0,
              }}>
                {DIFFICULTY_LABELS[diffIdx]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: isPhone ? '15px' : '16px', color: '#eee',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {item.songName || '未命名'}
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                  {item.composer || '未知'} · {formatDate(item.timestamp)}
                </div>
              </div>
              {restoring === item.id && (
                <span style={{ fontSize: '13px', color: '#888' }}>恢复中...</span>
              )}
            </div>
          )
        })}
      </div>

      {deleteTarget && (
        <div
          onClick={() => setDeleteTarget(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#1a1a2e', borderRadius: '16px', padding: '24px',
              maxWidth: '320px', width: '88%', border: '1px solid #333',
            }}
          >
            <div style={{ fontSize: '17px', textAlign: 'center', marginBottom: '20px', color: '#eee' }}>
              删除这条记录？
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #444',
                  backgroundColor: 'transparent', color: '#aaa', fontSize: '15px', cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#f44336', color: '#fff', fontSize: '15px', cursor: 'pointer',
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
