import { useRef, useEffect, useState, useCallback } from 'react'
import { useProjectStore } from '../stores/projectStore'
import { createPreviewEngine, type PreviewEngine } from '../modules/phiraEngine'
import { useScreenSize } from '../hooks/useScreenSize'

export function ChartPlayer() {
  const { chart, audio } = useProjectStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<PreviewEngine | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const { size } = useScreenSize()

  const canvasW = size === 'phone' ? 800 : 1000
  const canvasH = size === 'phone' ? 533 : 667

  useEffect(() => {
    if (!chart || !audio || !canvasRef.current) return

    const engine = createPreviewEngine()
    engine.setCanvas(canvasRef.current)
    engine.setRenderOptions({ debug: true })
    engine.loadChart(chart, audio.audioBuffer)
    engine.setCallbacks({
      onTimeUpdate: (t, d) => { setCurrentTime(t); setDuration(d) },
      onEnd: () => setIsPlaying(false),
      onError: (err) => setError(err.message),
    })
    engineRef.current = engine
    setDuration(engine.getDuration())
    engine.renderOnce()

    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [chart, audio])

  const togglePlay = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) return
    if (isPlaying) {
      engine.pause()
      setIsPlaying(false)
    } else {
      await engine.play()
      setIsPlaying(true)
    }
  }, [isPlaying])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value)
    engineRef.current?.seek(time)
    setCurrentTime(time)
  }, [])

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div style={{
      padding: '16px', backgroundColor: '#1a1a2e', borderRadius: '12px',
    }}>
      <h3 style={{ marginBottom: '12px', color: '#eee' }}>▶️ 谱面预览</h3>

      {error && (
        <div style={{ padding: '8px 12px', backgroundColor: '#500', color: '#f88', borderRadius: '6px', marginBottom: '8px', fontSize: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{
        position: 'relative', borderRadius: '8px', overflow: 'hidden',
        backgroundColor: '#000',
      }}>
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          style={{ width: '100%', display: 'block' }}
        />
      </div>

      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={togglePlay}
          style={{
            padding: '8px 20px', fontSize: '18px', cursor: 'pointer',
            backgroundColor: isPlaying ? '#ff6b6b' : '#4caf50',
            color: 'white', border: 'none', borderRadius: '8px',
          }}
        >
          {isPlaying ? '⏸ 暂停' : '▶ 播放'}
        </button>

        <span style={{ color: '#999', fontSize: '0.9em', minWidth: '40px' }}>
          {formatTime(currentTime)}
        </span>

        <input
          type="range"
          min={0}
          max={duration || 1}
          value={currentTime}
          onChange={handleSeek}
          style={{ flex: 1, accentColor: '#5c6bc0' }}
        />

        <span style={{ color: '#999', fontSize: '0.9em', minWidth: '40px' }}>
          {formatTime(duration)}
        </span>
      </div>
    </div>
  )
}
