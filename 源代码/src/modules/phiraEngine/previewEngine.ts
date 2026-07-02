// 预览引擎 v3：直接使用 phi-chart-render 标准打击音
//
// 打击音来源：https://github.com/MisaLiu/phi-chart-render
// - tap.ogg  → Tap 和 Hold 的打击音
// - drag.ogg → Drag 的打击音
// - flick.ogg → Flick 的打击音
//
// 触发逻辑参考 phichain (hit_sound.rs):
// - 每帧检查 note.startTime 是否在当前时间的 50ms 窗口内
// - 用 Set 标记已播放的 note，防止重复
// - seek 回退时清除标记，允许重新触发

import type { RPEChart } from '../../types/rpe'
import { parseChart, type ProcessedChart } from './eventParser'
import { render, loadTextures, type RenderOptions } from './renderer'

export interface PreviewEngineCallbacks {
  onTimeUpdate?: (time: number, duration: number) => void
  onEnd?: () => void
  onError?: (err: Error) => void
}

export class PreviewEngine {
  private processedChart: ProcessedChart | null = null
  private audioBuffer: AudioBuffer | null = null
  private audioContext: AudioContext | null = null
  private sourceNode: AudioBufferSourceNode | null = null
  private gainNode: GainNode | null = null
  private hitSoundGain: GainNode | null = null

  // 真实打击音 buffer
  private tapBuffer: AudioBuffer | null = null
  private dragBuffer: AudioBuffer | null = null
  private flickBuffer: AudioBuffer | null = null
  private soundsLoaded = false

  private contextStartTime: number = 0
  private startOffset: number = 0
  private _isPlaying = false
  private rafId: number | null = null
  private canvas: HTMLCanvasElement | null = null
  private ctx2d: CanvasRenderingContext2D | null = null
  private renderOptions: RenderOptions = {}
  private callbacks: PreviewEngineCallbacks = {}
  private lastFrameTime: number = 0

  // 已播放打击音的音符索引集合（防重复）
  private playedNotes: Set<string> = new Set()

  get isPlaying(): boolean { return this._isPlaying }

  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法获取 Canvas 2D 上下文')
    this.ctx2d = ctx
  }

  setRenderOptions(options: RenderOptions): void {
    this.renderOptions = { ...this.renderOptions, ...options }
  }

  setCallbacks(callbacks: PreviewEngineCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  loadChart(chart: RPEChart, audioBuffer: AudioBuffer): void {
    this.processedChart = parseChart(chart)
    this.audioBuffer = audioBuffer
    this.playedNotes.clear()
  }

  async ensureAudioContext(): Promise<void> {
    if (!this.audioContext) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext
      this.audioContext = new Ctor()
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
    if (!this.hitSoundGain && this.audioContext) {
      this.hitSoundGain = this.audioContext.createGain()
      this.hitSoundGain.gain.value = 1.0  // phi-chart-render 默认满音量
      this.hitSoundGain.connect(this.audioContext.destination)
    }
    // 加载打击音文件（只加载一次）
    if (!this.soundsLoaded && this.audioContext) {
      await this.loadHitSounds()
      this.soundsLoaded = true
    }
    // 加载贴图（只加载一次）
    await loadTextures()
  }

  // 加载 phi-chart-render 标准打击音
  private async loadHitSounds(): Promise<void> {
    if (!this.audioContext) return
    const loadOgg = async (url: string): Promise<AudioBuffer> => {
      const resp = await fetch(url)
      const arr = await resp.arrayBuffer()
      return await this.audioContext!.decodeAudioData(arr)
    }
    try {
      const [tap, drag, flick] = await Promise.all([
        loadOgg('tap.ogg'),
        loadOgg('drag.ogg'),
        loadOgg('flick.ogg'),
      ])
      this.tapBuffer = tap
      this.dragBuffer = drag
      this.flickBuffer = flick
    } catch (err) {
      console.warn('打击音加载失败，将使用静音', err)
    }
  }

  async play(): Promise<void> {
    if (!this.processedChart || !this.audioBuffer || !this.ctx2d) return
    try {
      await this.ensureAudioContext()
      if (!this.audioContext) return

      this.stopSource()

      this.sourceNode = this.audioContext.createBufferSource()
      this.sourceNode.buffer = this.audioBuffer

      this.gainNode = this.audioContext.createGain()
      this.gainNode.gain.value = 0.7

      this.sourceNode.connect(this.gainNode)
      this.gainNode.connect(this.audioContext.destination)

      this.sourceNode.onended = () => {
        if (this._isPlaying) {
          this._isPlaying = false
          this.callbacks.onEnd?.()
        }
      }

      this.contextStartTime = this.audioContext.currentTime
      this.lastFrameTime = this.startOffset
      this.sourceNode.start(0, this.startOffset)
      this._isPlaying = true
      this.loop()
    } catch (err) {
      this.callbacks.onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  pause(): void {
    if (!this._isPlaying) return
    this.startOffset = this.getCurrentTime()
    this.stopSource()
    this._isPlaying = false
    this.cancelRaf()
  }

  seek(time: number): void {
    const wasPlaying = this._isPlaying
    if (wasPlaying) this.pause()
    this.startOffset = Math.max(0, time)
    this.lastFrameTime = this.startOffset
    // seek 时清除已播放标记，允许重新触发打击音
    this.playedNotes.clear()
    if (wasPlaying) {
      this.play()
    } else {
      this.renderOnce()
    }
  }

  getCurrentTime(): number {
    if (!this.audioContext) return this.startOffset
    return this.startOffset + (this.audioContext.currentTime - this.contextStartTime)
  }

  getDuration(): number {
    return this.processedChart?.duration ?? this.audioBuffer?.duration ?? 0
  }

  // 播放打击音（用真实 ogg 文件）
  private playHitSound(noteType: number): void {
    if (!this.audioContext || !this.hitSoundGain) return

    let buffer: AudioBuffer | null = null
    switch (noteType) {
      case 1: buffer = this.tapBuffer; break   // Tap
      case 2: buffer = this.tapBuffer; break   // Hold 复用 tap 音
      case 3: buffer = this.flickBuffer; break // Flick
      case 4: buffer = this.dragBuffer; break  // Drag
    }

    if (!buffer) return

    const src = this.audioContext.createBufferSource()
    src.buffer = buffer
    src.connect(this.hitSoundGain)
    src.start()
  }

  // 检查并播放跨越判定线的音符打击音（phichain 风格）
  private checkHitSounds(currentTime: number): void {
    if (!this.processedChart) return
    const prevTime = this.lastFrameTime

    for (let li = 0; li < this.processedChart.lines.length; li++) {
      const line = this.processedChart.lines[li]
      for (let ni = 0; ni < line.notes.length; ni++) {
        const note = line.notes[ni]
        const key = `${li}-${ni}`
        const noteTime = note.startTime

        // 触发条件：note 时间在 [prevTime, currentTime] 窗口内，且未播放过
        if (noteTime > prevTime && noteTime <= currentTime && !this.playedNotes.has(key)) {
          this.playHitSound(note.type)
          this.playedNotes.add(key)
        }

        // 回退时清除标记
        if (noteTime > currentTime && this.playedNotes.has(key)) {
          this.playedNotes.delete(key)
        }
      }
    }
  }

  private loop = (): void => {
    if (!this._isPlaying) return
    const time = this.getCurrentTime()
    this.callbacks.onTimeUpdate?.(time, this.getDuration())
    this.checkHitSounds(time)
    this.renderAt(time)
    this.lastFrameTime = time
    this.rafId = requestAnimationFrame(this.loop)
  }

  renderOnce(): void {
    this.renderAt(this.getCurrentTime())
  }

  private renderAt(time: number): void {
    if (!this.processedChart || !this.ctx2d || !this.canvas) return
    render(this.ctx2d, this.processedChart, time, this.canvas.width, this.canvas.height, this.renderOptions)
  }

  private stopSource(): void {
    if (this.sourceNode) {
      try { this.sourceNode.stop() } catch {}
      try { this.sourceNode.disconnect() } catch {}
      this.sourceNode = null
    }
  }

  private cancelRaf(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  destroy(): void {
    this.pause()
    this.stopSource()
    this.cancelRaf()
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.hitSoundGain = null
    this.tapBuffer = null
    this.dragBuffer = null
    this.flickBuffer = null
    this.processedChart = null
    this.audioBuffer = null
    this.canvas = null
    this.ctx2d = null
    this.playedNotes.clear()
  }
}

export function createPreviewEngine(): PreviewEngine {
  return new PreviewEngine()
}
