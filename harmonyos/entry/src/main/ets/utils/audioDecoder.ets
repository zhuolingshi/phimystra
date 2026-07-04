import { DecodedAudioData } from './audioAnalysis'
import { common } from '@kit.AbilityKit'
import { fileIo } from '@kit.CoreFileKit'
import audioDecoder from 'libaudio_decoder.so'

export interface DecodedAudio {
  name: string
  audioFormat: string
  originalData: Uint8Array
  originalFormat: string
  decodedAudio: DecodedAudioData
}

export function isSupportedAudioFormat(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)
}

export function isSupportedVideoFormat(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v'].includes(ext)
}

export function getAudioFormat(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'wav'
  return ext
}

export function decodeWav(data: Uint8Array): DecodedAudioData {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)

  const readString = (offset: number): string => {
    let s = ''
    for (let i = 0; i < 4; i++) s += String.fromCharCode(view.getUint8(offset + i))
    return s
  }

  if (readString(0) !== 'RIFF' || readString(8) !== 'WAVE') {
    throw new Error('not a valid WAV file')
  }

  let offset = 12
  let sampleRate = 44100
  let numChannels = 2
  let bitsPerSample = 16
  let dataOffset = 0
  let dataLength = 0
  let wavFormat = 1

  while (offset < data.byteLength - 8) {
    const chunkId = readString(offset)
    const chunkSize = view.getUint32(offset + 4, true)
    if (chunkId === 'fmt ') {
      wavFormat = view.getUint16(offset + 8, true)
      if (wavFormat !== 1 && wavFormat !== 3) {
        throw new Error(`unsupported WAV format: ${wavFormat}`)
      }
      numChannels = view.getUint16(offset + 10, true)
      sampleRate = view.getUint32(offset + 12, true)
      bitsPerSample = view.getUint16(offset + 22, true)
    } else if (chunkId === 'data') {
      dataOffset = offset + 8
      dataLength = chunkSize
      break
    }
    offset += 8 + chunkSize
    if (chunkSize % 2 !== 0) offset++
  }

  if (dataOffset === 0) throw new Error('no data chunk in WAV')

  const bytesPerSample = bitsPerSample / 8
  const numSamples = Math.floor(dataLength / (bytesPerSample * numChannels))
  const channelData: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(new Float32Array(numSamples))
  }

  const isFloat = wavFormat === 3
  let pos = dataOffset
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = 0
      if (bitsPerSample === 16) {
        sample = view.getInt16(pos, true) / 32768
      } else if (bitsPerSample === 24) {
        const b0 = view.getUint8(pos)
        const b1 = view.getUint8(pos + 1)
        const b2 = view.getInt8(pos + 2)
        sample = ((b2 << 16) | (b1 << 8) | b0) / 8388608
      } else if (bitsPerSample === 32) {
        if (isFloat) {
          sample = view.getFloat32(pos, true)
        } else {
          sample = view.getInt32(pos, true) / 2147483648
        }
      } else if (bitsPerSample === 8) {
        sample = (view.getUint8(pos) - 128) / 128
      }
      channelData[ch][i] = sample
      pos += bytesPerSample
    }
  }

  return {
    sampleRate,
    numberOfChannels: numChannels,
    length: numSamples,
    duration: numSamples / sampleRate,
    channelData
  }
}

async function decodeCompressed(data: Uint8Array, format: string): Promise<DecodedAudioData> {
  const ctx = globalThis.ctx as common.UIAbilityContext
  const tempPath = `${ctx.cacheDir}/temp_decode_${Date.now()}.${format}`

  const file = fileIo.openSync(tempPath, fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC)
  fileIo.writeSync(file.fd, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
  const stat = fileIo.statSync(tempPath)
  const fileSize = stat.size

  try {
    const result = await audioDecoder.decodeAudio(file.fd, 0, fileSize)

    const view = new DataView(result.pcmData)
    const numFrames = view.byteLength / (2 * result.channels)
    const channelData: Float32Array[] = []
    for (let ch = 0; ch < result.channels; ch++) {
      channelData.push(new Float32Array(numFrames))
    }
    for (let i = 0; i < numFrames; i++) {
      for (let ch = 0; ch < result.channels; ch++) {
        const off = (i * result.channels + ch) * 2
        channelData[ch][i] = view.getInt16(off, true) / 32768
      }
    }

    return {
      sampleRate: result.sampleRate,
      numberOfChannels: result.channels,
      length: numFrames,
      duration: result.duration,
      channelData
    }
  } finally {
    fileIo.closeSync(file)
    try {
      fileIo.unlinkSync(tempPath)
    } catch {
      // ignore cleanup error
    }
  }
}

export async function decodeAudioFile(data: Uint8Array, format: string): Promise<DecodedAudioData> {
  const fmt = format.toLowerCase()
  if (fmt === 'wav') {
    return decodeWav(data)
  }
  return decodeCompressed(data, fmt)
}
