import { useEffect, useRef } from 'react'
import { useProjectStore } from '../stores/projectStore'
import { useScreenSize } from '../hooks/useScreenSize'

export function OnsetViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { analysis } = useProjectStore()
  const { size } = useScreenSize()

  const canvasW = size === 'phone' ? 800 : 1200
  const canvasH = size === 'phone' ? 200 : 280

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !analysis) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, W, H)

    const duration = analysis.duration

    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    ctx.beginPath()
    analysis.energyCurve.forEach((v, i) => {
      const x = (i / analysis.energyCurve.length) * W
      const y = H - v * H * 0.6
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    analysis.onsets.forEach((o) => {
      const x = (o.time / duration) * W
      const alpha = 0.3 + o.intensity * 0.7
      ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
    })
  }, [analysis, size])

  if (!analysis) return null

  return (
    <div>
      <div style={{ marginBottom: '8px', color: '#ccc', fontSize: size === 'tablet' ? '16px' : undefined }}>
        <span>BPM: <strong>{analysis.bpm}</strong> (置信度: {(analysis.bpmConfidence * 100).toFixed(0)}%)</span>
        {' | '}
        <span>检测到 <strong>{analysis.onsets.length}</strong> 个节奏点</span>
        {' | '}
        <span>时长: {analysis.duration.toFixed(1)}s</span>
      </div>
      <canvas ref={canvasRef} width={canvasW} height={canvasH}
        style={{ width: '100%', border: '1px solid #333', borderRadius: '8px' }} />
    </div>
  )
}
