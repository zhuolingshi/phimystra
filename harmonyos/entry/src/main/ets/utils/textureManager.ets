import { image } from '@kit.ImageKit'
import { common } from '@kit.AbilityKit'

const TEXTURE_FILES: string[] = [
  'Tap', 'TapHL', 'Drag', 'DragHL', 'Flick', 'FlickHL',
  'Hold', 'HoldHL', 'HoldHead', 'HoldHeadHL', 'HoldEnd', 'JudgeLine'
]

export class TextureManager {
  private textures: Map<string, ImageBitmap> = new Map()
  private loaded: boolean = false
  private loading: boolean = false

  isLoaded(): boolean {
    return this.loaded
  }

  async load(ctx: common.UIAbilityContext): Promise<void> {
    if (this.loaded || this.loading) return
    this.loading = true

    try {
      const promises: Promise<void>[] = []

      for (const name of TEXTURE_FILES) {
        promises.push(this.loadOne(ctx, name))
      }

      await Promise.all(promises)
      this.loaded = true
      console.info('[TextureManager] All textures loaded')
    } catch (e) {
      console.error('[TextureManager] Load failed: ' + JSON.stringify(e))
    } finally {
      this.loading = false
    }
  }

  private async loadOne(ctx: common.UIAbilityContext, name: string): Promise<void> {
    try {
      const rm = ctx.resourceManager
      const rawData = await rm.getRawFileContent(`textures/${name}.png`)
      const arrayBuffer = rawData.buffer.slice(rawData.byteOffset, rawData.byteOffset + rawData.byteLength)
      const imageSource = image.createImageSource(arrayBuffer)
      const pixelMap = await imageSource.createPixelMap({
        desiredPixelFormat: image.PixelMapFormat.RGBA_8888
      })
      const bitmap = new ImageBitmap(pixelMap)
      this.textures.set(name, bitmap)
      imageSource.release()
    } catch (e) {
      console.warn(`[TextureManager] Failed to load ${name}.png: ` + JSON.stringify(e))
    }
  }

  get(name: string): ImageBitmap | null {
    return this.textures.get(name) ?? null
  }

  has(name: string): boolean {
    return this.textures.has(name)
  }

  clear(): void {
    this.textures.clear()
    this.loaded = false
  }
}

export const textureManager = new TextureManager()
