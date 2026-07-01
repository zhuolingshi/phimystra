// 预览引擎：管理音频同步播放 + requestAnimationFrame 渲染循环
// 借鉴 phi-chart-render 的预览模式

import type { RPEChart } from '../../types/rpe'
import { parseChart, type ProcessedChart } from './eventParser'
import { render, type RenderOptions } from './renderer'

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
  private contextStartTime: number = 0
  private startOffset: number = 0
  private _isPlaying = false
  private rafId: number | null = null
  private canvas: HTMLCanvasElement | null = null
  private ctx2d: CanvasRenderingContext2D | null = null
  private renderOptions: RenderOptions = {}
  private callbacks: PreviewEngineCallbacks = {}

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
  }

  async ensureAudioContext(): Promise<void> {
    if (!this.audioContext) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext
      this.audioContext = new Ctor()
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
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

  private loop = (): void => {
    if (!this._isPlaying) return
    const time = this.getCurrentTime()
    this.callbacks.onTimeUpdate?.(time, this.getDuration())
    this.renderAt(time)
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
    this.processedChart = null
    this.audioBuffer = null
    this.canvas = null
    this.ctx2d = null
  }
}

export function createPreviewEngine(): PreviewEngine {
  return new PreviewEngine()
}
