export interface DecodedAudio {
  audioBuffer: AudioBuffer
  duration: number
  sampleRate: number
  numberOfChannels: number
  name: string
  originalData?: ArrayBuffer
  originalFormat?: string
}

const SUPPORTED_FORMATS = ['mp3', 'wav', 'ogg', 'flac', 'm4a']
const SUPPORTED_VIDEO_FORMATS = ['mp4', 'm4v', 'webm', 'mkv', 'mov', 'avi']

export function isSupportedVideoFormat(filename: string, mimeType?: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (SUPPORTED_VIDEO_FORMATS.includes(ext)) return true
  if (mimeType) {
    return mimeType.startsWith('video/')
  }
  return false
}

export async function extractAudioFromVideo(file: File | Blob, name?: string): Promise<DecodedAudio> {
  const arrayBuffer = await file.arrayBuffer()
  const ctx = new AudioContext()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
  ctx.close()
  const fileName = name ?? (file instanceof File ? file.name : 'unknown')
  const baseName = fileName.replace(/\.[^.]+$/, '')
  return {
    audioBuffer,
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    numberOfChannels: audioBuffer.numberOfChannels,
    name: baseName + ' (视频提取)',
    originalData: arrayBuffer,
    originalFormat: 'm4a',
  }
}

export function isSupportedAudioFormat(filename: string, mimeType?: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (SUPPORTED_FORMATS.includes(ext)) return true
  if (mimeType) {
    const mimeMap: Record<string, string> = {
      'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
      'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
      'audio/ogg': 'ogg',
      'audio/flac': 'flac', 'audio/x-flac': 'flac',
      'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a',
    }
    return Object.keys(mimeMap).includes(mimeType)
  }
  return false
}

export async function decodeAudioFile(file: File | Blob, name?: string): Promise<DecodedAudio> {
  const arrayBuffer = await file.arrayBuffer()
  const ctx = new AudioContext()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
  ctx.close()
  const fileName = name ?? (file instanceof File ? file.name : 'unknown')
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return {
    audioBuffer, duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    numberOfChannels: audioBuffer.numberOfChannels,
    name: fileName,
    originalData: arrayBuffer,
    originalFormat: SUPPORTED_FORMATS.includes(ext) ? ext : undefined,
  }
}
