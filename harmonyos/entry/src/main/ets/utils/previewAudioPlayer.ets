import media from '@ohos.multimedia.media'
import audio from '@ohos.multimedia.audio'
import { common } from '@kit.AbilityKit'
import { fileIo } from '@kit.CoreFileKit'
import { ProcessedChart, ProcessedNote } from './eventParser'

export class PreviewAudioPlayer {
  private avPlayer: media.AVPlayer | null = null
  private soundPool: media.SoundPool | null = null
  private soundIds: Map<number, number> = new Map()
  private lastHitTimes: Map<number, number> = new Map()
  private tempAudioPath: string = ''
  private isReady: boolean = false

  async prepare(audioData: Uint8Array, audioFormat: string): Promise<void> {
    const ctx = globalThis.ctx as common.UIAbilityContext
    this.tempAudioPath = `${ctx.cacheDir}/preview_audio.${audioFormat}`
    const file = fileIo.openSync(this.tempAudioPath,
      fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC)
    fileIo.writeSync(file.fd,
      audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength))
    fileIo.closeSync(file)

    try {
      const rendererInfo: audio.AudioRendererInfo = {
        content: audio.ContentType.CONTENT_TYPE_MUSIC,
        usage: audio.StreamUsage.STREAM_USAGE_MEDIA,
        rendererFlags: 0
      }
      this.soundPool = await media.createSoundPool(8, rendererInfo)
      await this.loadHitSounds(ctx)
    } catch {
      this.soundPool = null
    }

    return new Promise<void>((resolve) => {
      media.createAVPlayer().then((player) => {
        this.avPlayer = player
        player.url = this.tempAudioPath
        player.on('stateChange', (state: string) => {
          if (state === 'prepared') {
            this.isReady = true
            resolve()
          }
        })
        player.on('error', () => {
          if (!this.isReady) resolve()
        })
        player.prepare().catch(() => resolve())
      }).catch(() => resolve())
    })
  }

  private async loadHitSounds(ctx: common.UIAbilityContext): Promise<void> {
    if (!this.soundPool) return
    const types: number[] = [1, 2, 3, 4]
    const filenames: string[] = ['tap.ogg', 'tap.ogg', 'flick.ogg', 'drag.ogg']
    for (let i = 0; i < types.length; i++) {
      const type = types[i]
      const filename = filenames[i]
      try {
        const fd = ctx.resourceManager.getRawFdSync(`sounds/${filename}`)
        const id = await this.soundPool.load(fd.fd, fd.offset, fd.length)
        this.soundIds.set(type, id)
        ctx.resourceManager.closeRawFdSync(`sounds/${filename}`)
      } catch {
        // skip if sound file missing
      }
    }
  }

  play(): void {
    if (this.avPlayer && this.isReady) {
      this.avPlayer.play().catch(() => {})
    }
  }

  pause(): void {
    if (this.avPlayer) {
      this.avPlayer.pause().catch(() => {})
    }
  }

  seek(timeSec: number): void {
    if (this.avPlayer && this.isReady) {
      this.avPlayer.seek(timeSec * 1000)
    }
  }

  getCurrentTime(): number {
    if (this.avPlayer && this.isReady) {
      return this.avPlayer.currentTime / 1000
    }
    return -1
  }

  checkHitSounds(chart: ProcessedChart, currentTime: number, prevTime: number): void {
    if (!this.soundPool) return
    for (const line of chart.lines) {
      for (let i = 0; i < line.notes.length; i++) {
        const note = line.notes[i]
        const key = line.index * 100000 + i
        const lastHit = this.lastHitTimes.get(key) ?? -1
        if (lastHit >= 0) continue
        if (note.startTime > prevTime && note.startTime <= currentTime) {
          this.lastHitTimes.set(key, note.startTime)
          const soundId = this.soundIds.get(note.type) ?? this.soundIds.get(1) ?? -1
          if (soundId >= 0) {
            this.soundPool.play(soundId).catch(() => {})
          }
        }
      }
    }
  }

  resetHitTracking(): void {
    this.lastHitTimes.clear()
  }

  release(): void {
    if (this.avPlayer) {
      this.avPlayer.release().catch(() => {})
      this.avPlayer = null
    }
    if (this.soundPool) {
      this.soundPool.release().catch(() => {})
      this.soundPool = null
    }
    this.isReady = false
    this.soundIds.clear()
    this.lastHitTimes.clear()
  }
}
