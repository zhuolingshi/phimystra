import { ProcessedChart, ProcessedNote, ProcessedLine, getLineState, LineState } from './eventParser'
import { NOTE_HEIGHT } from '../model/chart'
import { textureManager } from './textureManager'

const PHIGROS_W = 1350
const PHIGROS_H = 900

export interface RenderOptions {
  showGuide: boolean
  speedMultiplier: number
  debug: boolean
}

export function render(
  ctx: CanvasRenderingContext2D,
  chart: ProcessedChart,
  currentTime: number,
  width: number,
  height: number,
  options: RenderOptions
): void {
  ctx.clearRect(0, 0, width, height)

  const scale = Math.min(width / PHIGROS_W, height / PHIGROS_H)
  const cx = width / 2
  const cy = height / 2
  const speedMul = options.speedMultiplier

  ctx.fillStyle = '#0a0a18'
  ctx.fillRect(0, 0, width, height)

  const noteWidth = width * 0.117775 * (scale / (width / PHIGROS_W))
  const noteHeight = noteWidth * 0.3
  const texLoaded = textureManager.isLoaded()

  const lineStates: LineState[] = chart.lines.map(l => getLineState(l, currentTime))

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
      const cosP = Math.cos(pRot)
      const sinP = Math.sin(pRot)
      worldX = pX + dx * cosP - dy * sinP
      worldY = pY + dy * cosP + dx * sinP
      rotation += pRot
    }

    const alpha = Math.max(0, Math.min(1, state.alpha))
    if (alpha < 0.01) continue

    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)

    renderJudgeLine(ctx, worldX, worldY, rotation, alpha, state.size, state.skew, width, scale, texLoaded)

    const maxVisibleDist = height / scale
    const visibleNotes: ProcessedNote[] = []
    for (const n of line.notes) {
      const offset = n.floorPosition - state.floorPos
      const screenDist = Math.abs(offset * NOTE_HEIGHT * n.speed * speedMul)
      if (screenDist < maxVisibleDist) visibleNotes.push(n)
    }

    if (line.isCover) {
      visibleNotes.sort((a, b) => a.floorPosition - b.floorPosition)
    } else {
      visibleNotes.sort((a, b) => b.floorPosition - a.floorPosition)
    }

    const simultaneousKeys = new Set<number>()
    for (let ni = 0; ni < line.notes.length; ni++) {
      for (let nj = ni + 1; nj < line.notes.length; nj++) {
        if (Math.abs(line.notes[ni].startTime - line.notes[nj].startTime) < 0.05) {
          simultaneousKeys.add(ni)
          simultaneousKeys.add(nj)
        }
      }
    }

    for (const note of visibleNotes) {
      const origIdx = line.notes.indexOf(note)
      const noteOffset = note.floorPosition - state.floorPos
      const screenDistPx = noteOffset * NOTE_HEIGHT * note.speed * speedMul
      const localY = screenDistPx * (note.above ? -1 : 1) * scale
      const localX = note.positionX * scale

      const sx = worldX + localX * cos - localY * sin
      const sy = worldY + localY * cos + localX * sin

      const noteAlpha = (note.alpha / 255) * alpha
      if (noteAlpha < 0.01) continue

      const isSimul = simultaneousKeys.has(origIdx)

      if (note.type === 2 && note.endTime > note.startTime + 0.05) {
        renderHoldBody(ctx, note, state, worldX, worldY, cos, sin, scale, speedMul, alpha, noteWidth, isSimul, texLoaded)
      }

      renderNote(ctx, note, sx, sy, rotation, noteAlpha, noteWidth, noteHeight, isSimul, texLoaded)
    }
  }

  if (options.debug) {
    let totalNotes = 0
    for (const l of chart.lines) totalNotes += l.notes.length
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, 0, width, 60)
    ctx.fillStyle = '#0f0'
    ctx.font = '12px monospace'
    ctx.textBaseline = 'top'
    ctx.fillText(`time=${currentTime.toFixed(2)}s  notes=${totalNotes}  tex=${texLoaded ? 'OK' : 'fallback'}`, 8, 4)
    ctx.restore()
  }
}

function renderJudgeLine(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, rotation: number,
  alpha: number, size: number, skew: number,
  canvasWidth: number, scale: number,
  useTexture: boolean
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.scale(Math.max(0.01, size), 1)
  if (Math.abs(skew) > 0.001) {
    ctx.transform(1, 0, Math.tan(skew * Math.PI / 180), 1, 0, 0)
  }
  ctx.globalAlpha = alpha

  const lineWidth = canvasWidth * 0.72
  const lineHeight = 6 * scale

  if (useTexture) {
    const tex = textureManager.get('JudgeLine')
    if (tex) {
      ctx.drawImage(tex, -lineWidth / 2, -lineHeight / 2, lineWidth, lineHeight)
      ctx.restore()
      return
    }
  }

  const grad = ctx.createLinearGradient(-lineWidth / 2, 0, lineWidth / 2, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.15, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.5, 'rgba(255,255,255,1)')
  grad.addColorStop(0.85, 'rgba(255,255,255,0.9)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(-lineWidth / 2, -lineHeight / 2, lineWidth, lineHeight)

  ctx.restore()
}

function getNoteColor(type: number): string {
  if (type === 1) return '#3a9fff'
  if (type === 2) return '#b34fff'
  if (type === 3) return '#ff4f6f'
  if (type === 4) return '#4fff8f'
  return '#888888'
}

function getNoteTexName(type: number, isSimul: boolean): string {
  switch (type) {
    case 1: return isSimul ? 'TapHL' : 'Tap'
    case 2: return isSimul ? 'HoldHeadHL' : 'HoldHead'
    case 3: return isSimul ? 'FlickHL' : 'Flick'
    case 4: return isSimul ? 'DragHL' : 'Drag'
    default: return 'Tap'
  }
}

function renderNote(
  ctx: CanvasRenderingContext2D,
  note: ProcessedNote,
  x: number, y: number, rotation: number,
  alpha: number, noteWidth: number, noteHeight: number,
  isSimul: boolean, useTexture: boolean
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha = alpha

  let drawW = noteWidth * note.size
  let drawH = noteHeight

  if (useTexture) {
    const texName = getNoteTexName(note.type, isSimul)
    const tex = textureManager.get(texName)
    if (tex) {
      const aspect = tex.width / tex.height
      drawH = drawW / aspect
      ctx.drawImage(tex, -drawW / 2, -drawH / 2, drawW, drawH)
      ctx.restore()
      return
    }
  }

  const colors: string = getNoteColor(note.type)
  ctx.fillStyle = colors
  ctx.beginPath()
  ctx.rect(-drawW / 2, -drawH / 2, drawW, drawH)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.restore()
}

function renderHoldBody(
  ctx: CanvasRenderingContext2D,
  note: ProcessedNote,
  state: LineState,
  worldX: number, worldY: number,
  cos: number, sin: number,
  scale: number, speedMul: number, alpha: number,
  noteWidth: number, isSimul: boolean, useTexture: boolean
): void {
  const bodyFloorLen = note.endFloorPosition - note.floorPosition
  const bodyLenPx = bodyFloorLen * NOTE_HEIGHT * note.speed * speedMul

  if (bodyLenPx < 5) return

  const bodyW = noteWidth * note.size * 0.9
  const localX = note.positionX * scale

  const noteOffset = note.floorPosition - state.floorPos
  const headScreenPx = noteOffset * NOTE_HEIGHT * note.speed * speedMul
  const headLocalY = headScreenPx * (note.above ? -1 : 1) * scale
  const tailLocalY = (headScreenPx + bodyLenPx) * (note.above ? -1 : 1) * scale

  ctx.save()
  ctx.globalAlpha = alpha * 0.85
  ctx.translate(worldX, worldY)

  const sx = localX * cos - headLocalY * sin
  const sy = headLocalY * cos + localX * sin
  const ex = localX * cos - tailLocalY * sin
  const ey = tailLocalY * cos + localX * sin

  const bodyAngle = Math.atan2(ey - sy, ex - sx) - Math.PI / 2
  const bodyH = Math.hypot(ex - sx, ey - sy)

  ctx.translate(sx, sy)
  ctx.rotate(bodyAngle)

  if (useTexture) {
    const texName = isSimul ? 'HoldHL' : 'Hold'
    const tex = textureManager.get(texName)
    if (tex) {
      ctx.drawImage(tex, -bodyW / 2, 0, bodyW, bodyH)
      ctx.restore()
      return
    }
  }

  ctx.fillStyle = '#b34fff'
  ctx.globalAlpha = alpha * 0.6
  ctx.fillRect(-bodyW / 2, 0, bodyW, bodyH)

  ctx.restore()
}
