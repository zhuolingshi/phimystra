import { preferences } from '@kit.ArkData'
import { picker, fileIo } from '@kit.CoreFileKit'
import { common } from '@kit.AbilityKit'

export interface PickedFile {
  name: string
  data: Uint8Array
  uri: string
}

export async function pickAudioFile(): Promise<PickedFile | null> {
  const opt = new picker.DocumentSelectOptions()
  opt.maxSelectNumber = 1
  opt.fileSuffixFilters = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']
  const docPicker = new picker.DocumentViewPicker()
  const uris = await docPicker.select(opt)
  if (!uris || uris.length === 0) return null
  return await readFileFromUri(uris[0])
}

export async function pickVideoFile(): Promise<PickedFile | null> {
  try {
    const opt = new picker.DocumentSelectOptions()
    opt.maxSelectNumber = 1
    opt.fileSuffixFilters = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v']
    const docPicker = new picker.DocumentViewPicker()
    const uris = await docPicker.select(opt)
    if (!uris || uris.length === 0) return null
    return await readFileFromUri(uris[0])
  } catch {
    return null
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

async function readFileFromUri(uri: string): Promise<PickedFile> {
  const file = fileIo.openSync(uri, fileIo.OpenMode.READ_ONLY)
  const stat = fileIo.statSync(uri)
  const size = stat.size
  const buffer = new ArrayBuffer(size)
  fileIo.readSync(file.fd, buffer)
  fileIo.closeSync(file)
  const name = uri.split('/').pop() ?? 'unknown'
  return { name, data: new Uint8Array(buffer), uri }
}

export async function saveViaPicker(filename: string, content: string): Promise<string> {
  const saveOpt = new picker.DocumentSaveOptions()
  saveOpt.newFileNames = [filename]
  const docPicker = new picker.DocumentViewPicker()
  const uris = await docPicker.save(saveOpt)
  if (!uris || uris.length === 0) throw new Error('用户取消保存')

  const file = fileIo.openSync(uris[0], fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC)
  fileIo.writeSync(file.fd, content)
  fileIo.closeSync(file)
  return uris[0]
}

export async function saveBinaryViaPicker(filename: string, data: Uint8Array): Promise<string> {
  const saveOpt = new picker.DocumentSaveOptions()
  saveOpt.newFileNames = [filename]
  const docPicker = new picker.DocumentViewPicker()
  const uris = await docPicker.save(saveOpt)
  if (!uris || uris.length === 0) throw new Error('用户取消保存')

  const file = fileIo.openSync(uris[0], fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC)
  const buf = new ArrayBuffer(data.byteLength)
  const view = new Uint8Array(buf)
  for (let i = 0; i < data.byteLength; i++) {
    view[i] = data[i]
  }
  fileIo.writeSync(file.fd, buf)
  fileIo.closeSync(file)
  return uris[0]
}

export async function saveFileViaPicker(filename: string, srcPath: string): Promise<string> {
  const saveOpt = new picker.DocumentSaveOptions()
  saveOpt.newFileNames = [filename]
  const docPicker = new picker.DocumentViewPicker()
  const uris = await docPicker.save(saveOpt)
  if (!uris || uris.length === 0) throw new Error('用户取消保存')

  const srcFile = fileIo.openSync(srcPath, fileIo.OpenMode.READ_ONLY)
  const destFile = fileIo.openSync(uris[0], fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC)
  fileIo.copyFile(srcFile.fd, destFile.fd)
  fileIo.closeSync(srcFile)
  fileIo.closeSync(destFile)
  return uris[0]
}
