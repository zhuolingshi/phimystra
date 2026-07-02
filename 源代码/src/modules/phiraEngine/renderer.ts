// Canvas 渲染器 v3：直接使用 phi-chart-render 贴图
//
// 贴图来源：https://github.com/MisaLiu/phi-chart-render
// 渲染参数参照 phi-chart-render 的 calcResizer

import { NOTE_HEIGHT } from '../../types/rpe'
import type { ProcessedChart, ProcessedNote } from './eventParser'
import { getLineState } from './eventParser'

const PHIGROS_W = 1350
const PHIGROS_H = 900

// 贴图缓存
let textures: Record<string, HTMLImageElement> = {}
let texturesLoaded = false
let texturesLoading = false

const TEXTURE_FILES: Record<string, string> = {
  tap: 'Tap.png',
  tapHL: 'TapHL.png',
  drag: 'Drag.png',
  dragHL: 'DragHL.png',
  flick: 'Flick.png',
  flickHL: 'FlickHL.png',
  holdBody: 'Hold.png',
  holdBodyHL: 'HoldHL.png',
  holdHead: 'HoldHead.png',
  holdHeadHL: 'HoldHeadHL.png',
  holdEnd: 'HoldEnd.png',
  judgeLine: 'JudgeLine.png',
}

export function loadTextures(): Promise<void> {
  if (texturesLoaded) return Promise.resolve()
  if (texturesLoading) return new Promise(resolve => {
    const check = () => texturesLoaded ? resolve() : setTimeout(check, 100)
    check()
  })
  texturesLoading = true

  return new Promise(resolve => {
    let loaded = 0
    const total = Object.keys(TEXTURE_FILES).length
    for (const [key, file] of Object.entries(TEXTURE_FILES)) {
      const img = new Image()
      img.onload = () => {
        loaded++
        if (loaded === total) {
          texturesLoaded = true
          texturesLoading = false
          resolve()
        }
      }
      img.onerror = () => {
        loaded++
        if (loaded === total) {
          texturesLoaded = true
          texturesLoading = false
          resolve()
        }
      }
      img.src = file
      textures[key] = img
    }
  })
}

export function areTexturesLoaded(): boolean {
  return texturesLoaded
}

export interface RenderOptions {
  showGuide?: boolean
  speedMultiplier?: number
  debug?: boolean
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

  // 深色背景
  ctx.fillStyle = '#0a0a18'
  ctx.fillRect(0, 0, width, height)

  // phi-chart-render 尺寸计算
  const noteWidth = width * 0.117775 * (scale / (width / PHIGROS_W))
  const noteHeight = noteWidth * 0.3

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

    // 渲染判定线（用贴图）
    renderJudgeLine(ctx, worldX, worldY, rotation, alpha, width, scale)

    // 音符渲染
    const maxVisibleDist = height / scale
    const visibleNotes = line.notes.filter(n => {
      const offset = n.floorPosition - state.floorPos
      const screenDist = Math.abs(offset * NOTE_HEIGHT * n.speed * speedMul)
      return screenDist < maxVisibleDist
    })

    const sortedNotes = line.isCover
      ? visibleNotes.sort((a, b) => a.floorPosition - b.floorPosition)
      : visibleNotes.sort((a, b) => b.floorPosition - a.floorPosition)

    // 检测同时音符（用于 HL 贴图）
    const simultaneousKeys = new Set<string>()
    for (let ni = 0; ni < line.notes.length; ni++) {
      for (let nj = ni + 1; nj < line.notes.length; nj++) {
        if (Math.abs(line.notes[ni].startTime - line.notes[nj].startTime) < 0.05) {
          simultaneousKeys.add(`${ni}`)
          simultaneousKeys.add(`${nj}`)
        }
      }
    }

    for (let ni = 0; ni < sortedNotes.length; ni++) {
      const note = sortedNotes[ni]
      const noteOffset = note.floorPosition - state.floorPos
      const screenDistPx = noteOffset * NOTE_HEIGHT * note.speed * speedMul
      const localY = screenDistPx * (note.above ? -1 : 1) * scale
      const localX = note.positionX * scale

      const sx = worldX + localX * cos - localY * sin
      const sy = worldY + localY * cos + localX * sin

      const noteAlpha = (note.alpha / 255) * alpha
      if (noteAlpha < 0.01) continue

      const origIdx = line.notes.indexOf(note)
      const isSimul = simultaneousKeys.has(`${origIdx}`)

      // Hold 尾巴先画
      if (note.type === 2 && note.endTime > note.startTime + 0.05) {
        renderHoldBody(ctx, note, state, worldX, worldY, cos, sin, scale, speedMul, alpha, noteWidth, isSimul)
      }

      renderNote(ctx, note, sx, sy, rotation, scale, noteAlpha, noteWidth, noteHeight, isSimul)
    }
  }

  // 调试
  if (options.debug) {
    const totalNotes = chart.lines.reduce((s, l) => s + l.notes.length, 0)
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, 0, width, 60)
    ctx.fillStyle = '#0f0'
    ctx.font = '12px monospace'
    ctx.textBaseline = 'top'
    ctx.fillText(`time=${currentTime.toFixed(2)}s  notes=${totalNotes}  tex=${texturesLoaded ? 'OK' : 'loading'}`, 8, 4)
    ctx.restore()
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

  if (textures.judgeLine && textures.judgeLine.complete && textures.judgeLine.naturalWidth > 0) {
    // JudgeLine.png 是一个很小的白色贴图，拉伸到屏幕宽度
    const lineWidth = canvasWidth * 0.72
    const tex = textures.judgeLine
    // phi-chart-render: baseScaleX=3, 但我们直接拉伸
    const lineHeight = 6 * scale
    ctx.drawImage(tex, -lineWidth / 2, -lineHeight / 2, lineWidth, lineHeight)
  } else {
    // 后备：渐变白线
    const lineWidth = canvasWidth * 0.72
    const lineHeight = 6 * scale
    const grad = ctx.createLinearGradient(-lineWidth / 2, 0, lineWidth / 2, 0)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.15, 'rgba(255,255,255,0.9)')
    grad.addColorStop(0.5, 'rgba(255,255,255,1)')
    grad.addColorStop(0.85, 'rgba(255,255,255,0.9)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(-lineWidth / 2, -lineHeight / 2, lineWidth, lineHeight)
  }

  ctx.restore()
}

function renderNote(
  ctx: CanvasRenderingContext2D,
  note: ProcessedNote,
  x: number, y: number, rotation: number,
  _scale: number, alpha: number,
  noteWidth: number, noteHeight: number, isSimul: boolean
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha = alpha

  let tex: HTMLImageElement | undefined
  let drawW = noteWidth * note.size
  let drawH = noteHeight

  switch (note.type) {
    case 1: // Tap
      tex = isSimul ? textures.tapHL : textures.tap
      break
    case 2: // Hold - 画头部
      tex = isSimul ? textures.holdHeadHL : textures.holdHead
      drawH = noteHeight * 1.0
      break
    case 3: // Flick
      tex = isSimul ? textures.flickHL : textures.flick
      break
    case 4: // Drag
      tex = isSimul ? textures.dragHL : textures.drag
      break
  }

  if (tex && tex.complete && tex.naturalWidth > 0) {
    // 按贴图比例绘制
    const aspect = tex.naturalWidth / tex.naturalHeight
    drawH = drawW / aspect
    ctx.drawImage(tex, -drawW / 2, -drawH / 2, drawW, drawH)
  } else {
    // 后备：色块
    const colors: Record<number, string> = { 1: '#3a9fff', 2: '#b34fff', 3: '#ff4f6f', 4: '#4fff8f' }
    ctx.fillStyle = colors[note.type] ?? '#888'
    ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH)
  }

  ctx.restore()
}

function renderHoldBody(
  ctx: CanvasRenderingContext2D,
  note: ProcessedNote,
  state: { floorPos: number; speed: number },
  worldX: number, worldY: number,
  cos: number, sin: number,
  scale: number, speedMul: number, alpha: number,
  noteWidth: number, isSimul: boolean
): void {
  // body 长度 = hold 持续时间对应的 floor 距离
  const bodyFloorLen = note.endFloorPosition - note.floorPosition
  const bodyLenPx = bodyFloorLen * NOTE_HEIGHT * note.speed * speedMul

  if (bodyLenPx < 5) return

  const tex = isSimul ? textures.holdBodyHL : textures.holdBody
  if (!tex || !tex.complete || tex.naturalWidth === 0) return

  const bodyW = noteWidth * note.size * 0.9
  const localX = note.positionX * scale

  // Hold body 从 note 头部位置开始，向远处（远离判定线方向）延伸
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
  ctx.drawImage(tex, -bodyW / 2, 0, bodyW, bodyH)
  ctx.restore()
}
