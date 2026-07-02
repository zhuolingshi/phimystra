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

export function isSupportedAudioFormat(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return SUPPORTED_FORMATS.includes(ext)
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
