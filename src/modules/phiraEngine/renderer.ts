// Canvas 渲染器：借鉴 phi-chart-render 的渲染流程
// 渲染判定线（位置/旋转/透明度）和音符（Tap/Hold/Flick/Drag）

import { PIXELS_PER_SECOND } from '../../types/rpe'
import type { ProcessedChart, ProcessedNote } from './eventParser'
import { getLineState } from './eventParser'

const PHIGROS_W = 1350
const PHIGROS_H = 900

const NOTE_COLORS: Record<number, string> = {
  1: '#64c8ff',  // Tap - 蓝
  2: '#a864ff',  // Hold - 紫
  3: '#ff6464',  // Flick - 红
  4: '#64ff96',  // Drag - 绿
}

const LINE_COLOR = '#e0e0e0'
const NOTE_W = 120
const NOTE_H = 30
const LINE_H = 8

export interface RenderOptions {
  showGuide?: boolean
  speedMultiplier?: number
}

export function render(
  ctx: CanvasRenderingContext2D,
  chart: ProcessedChart,
  currentTime: number,
  width: number,
  height: number,
  options: RenderOptions = {}
): void {
  ctx.clearRect(0, 0, width, height)

  const scale = Math.min(width / PHIGROS_W, height / PHIGROS_H)
  const cx = width / 2
  const cy = height / 2
  const speedMul = options.speedMultiplier ?? 1

  const lineStates = chart.lines.map(line => getLineState(line, currentTime))

  for (let i = 0; i < chart.lines.length; i++) {
    const line = chart.lines[i]
    const state = lineStates[i]

    let worldX = state.x * scale + cx
    let worldY = -state.y * scale + cy
    let rotation = state.rotation * Math.PI / 180

    if (line.father >= 0 && line.father < chart.lines.length) {
      const parent = lineStates[line.father]
      const pX = parent.x * scale + cx
      const pY = -parent.y * scale + cy
      const pRot = parent.rotation * Math.PI / 180
      const dx = state.x * scale
      const dy = -state.y * scale
      const cos = Math.cos(pRot)
      const sin = Math.sin(pRot)
      worldX = pX + dx * cos - dy * sin
      worldY = pY + dy * cos + dx * sin
      rotation += pRot
    }

    const alpha = Math.max(0, Math.min(1, state.alpha))

    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)

    renderJudgeLine(ctx, worldX, worldY, rotation, alpha, width, scale)

    const visibleNotes = line.notes.filter(n => {
      const offset = n.floorPosition - state.floorPos
      const screenDist = offset * PIXELS_PER_SECOND * n.speed * speedMul
      return Math.abs(screenDist) < height
    })

    const sortedNotes = line.isCover
      ? visibleNotes.sort((a, b) => a.floorPosition - b.floorPosition)
      : visibleNotes.sort((a, b) => b.floorPosition - a.floorPosition)

    for (const note of sortedNotes) {
      const noteOffset = note.floorPosition - state.floorPos
      const screenDist = noteOffset * PIXELS_PER_SECOND * note.speed * speedMul
      const localY = screenDist * (note.above ? -1 : 1) * 0.5
      const localX = note.positionX * scale

      const sx = worldX + localX * cos - localY * sin
      const sy = worldY + localY * cos + localX * sin

      const noteAlpha = (note.alpha / 255) * alpha
      if (noteAlpha < 0.01) continue

      renderNote(ctx, note, sx, sy, rotation, scale, noteAlpha)

      if (note.type === 2 && note.endTime > note.startTime + 0.05) {
        renderHoldTail(ctx, note, state, worldX, worldY, cos, sin, scale, speedMul, alpha)
      }
    }
  }
}

function renderJudgeLine(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, rotation: number,
  alpha: number, canvasWidth: number, scale: number
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha = alpha

  const lineWidth = canvasWidth * 0.7
  const lineHeight = LINE_H * scale

  const grad = ctx.createLinearGradient(-lineWidth / 2, 0, lineWidth / 2, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.2, LINE_COLOR)
  grad.addColorStop(0.8, LINE_COLOR)
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(-lineWidth / 2, -lineHeight / 2, lineWidth, lineHeight)

  ctx.restore()
}

function renderNote(
  ctx: CanvasRenderingContext2D,
  note: ProcessedNote,
  x: number, y: number, rotation: number,
  scale: number, alpha: number
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha = alpha

  const w = NOTE_W * scale * note.size
  const h = NOTE_H * scale
  const color = NOTE_COLORS[note.type] ?? '#888'

  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 2 * scale

  if (note.type === 3) {
    ctx.beginPath()
    ctx.moveTo(0, -h / 2)
    ctx.lineTo(w / 2, 0)
    ctx.lineTo(0, h / 2)
    ctx.lineTo(-w / 2, 0)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    const r = h * 0.3
    roundRect(ctx, -w / 2, -h / 2, w, h, r)
    ctx.fill()
    ctx.stroke()

    if (note.type === 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      roundRect(ctx, -w / 2 + 3 * scale, -h / 2 + 3 * scale, w * 0.4, h - 6 * scale, r * 0.5)
      ctx.fill()
    }
  }

  ctx.restore()
}

function renderHoldTail(
  ctx: CanvasRenderingContext2D,
  note: ProcessedNote,
  state: { floorPos: number; speed: number },
  worldX: number, worldY: number,
  cos: number, sin: number,
  scale: number, speedMul: number, alpha: number
): void {
  const tailOffset = note.floorPosition - state.floorPos
  const tailLen = Math.max(0, tailOffset) * PIXELS_PER_SECOND * note.speed * speedMul * 0.5

  if (tailLen < 5) return

  const localX = note.positionX * scale
  const localY1 = 0
  const localY2 = tailLen * (note.above ? -1 : 1)

  const sx = worldX + localX * cos - localY1 * sin
  const sy = worldY + localY1 * cos + localX * sin
  const ex = worldX + localX * cos - localY2 * sin
  const ey = worldY + localY2 * cos + localX * sin

  ctx.save()
  ctx.globalAlpha = alpha * 0.4
  ctx.strokeStyle = NOTE_COLORS[2]
  ctx.lineWidth = NOTE_W * scale * 0.6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.stroke()
  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
