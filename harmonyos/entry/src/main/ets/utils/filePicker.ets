import { preferences } from '@kit.ArkData'
import { picker, fileIo } from '@kit.CoreFileKit'
import { common } from '@kit.AbilityKit'

export interface PickedFile {
  name: string
  data: Uint8Array
  uri: string
}

export async function pickAudioFile(): Promise<PickedFile | null> {
  try {
    const option = new picker.AudioSelectOptions()
    option.maxSelectNumber = 1
    const audioPicker = new picker.AudioViewPicker()
    const uris = await audioPicker.select(option)
    if (!uris || uris.length === 0) return null
    return await readFileFromUri(uris[0])
  } catch {
    try {
      const opt = new picker.DocumentSelectOptions()
      opt.maxSelectNumber = 1
      opt.fileSuffixFilters = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']
      const docPicker = new picker.DocumentViewPicker()
      const uris = await docPicker.select(opt)
      if (!uris || uris.length === 0) return null
      return await readFileFromUri(uris[0])
    } catch {
      return null
    }
  }
}

export async function pickImageFile(): Promise<PickedFile | null> {
  try {
    const option = new picker.PhotoSelectOptions()
    option.MIMEType = picker.PhotoViewMIMETypes.IMAGE_TYPE
    option.maxSelectNumber = 1
    const photoPicker = new picker.PhotoViewPicker()
    const result = await photoPicker.select(option)
    if (!result || result.photoUris.length === 0) return null
    return await readFileFromUri(result.photoUris[0])
  } catch {
    return null
  }
}

async function readFileFromUri(uri: string): Promise<PickedFile | null> {
  try {
    const file = fileIo.openSync(uri, fileIo.OpenMode.READ_ONLY)
    const stat = fileIo.statSync(uri)
    const size = stat.size
    const buffer = new ArrayBuffer(size)
    fileIo.readSync(file.fd, buffer)
    fileIo.closeSync(file)
    const name = uri.split('/').pop() ?? 'unknown'
    return { name, data: new Uint8Array(buffer), uri }
  } catch (e) {
    console.error('[FilePick] read error: ' + JSON.stringify(e))
    return null
  }
}

export async function saveFileToDownloads(filename: string, data: Uint8Array): Promise<string> {
  try {
    const ctx = globalThis.ctx as common.UIAbilityContext
    const downloadsDir = ctx.filesDir
    const filePath = `${downloadsDir}/${filename}`
    const file = fileIo.openSync(filePath, fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC)
    fileIo.writeSync(file.fd, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
    fileIo.closeSync(file)
    return filePath
  } catch (e) {
    console.error('[FileSave] error: ' + JSON.stringify(e))
    throw new Error(JSON.stringify(e))
  }
}
