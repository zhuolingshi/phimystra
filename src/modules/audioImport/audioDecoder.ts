export interface DecodedAudio {
  audioBuffer: AudioBuffer
  duration: number
  sampleRate: number
  numberOfChannels: number
  name: string
}

const SUPPORTED_FORMATS = ['mp3', 'wav', 'ogg', 'flac', 'm4a']

export function isSupportedAudioFormat(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return SUPPORTED_FORMATS.includes(ext)
}

export async function decodeAudioFile(file: File | Blob, name?: string): Promise<DecodedAudio> {
  const arrayBuffer = await file.arrayBuffer()
  const ctx = new AudioContext()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  ctx.close()
  return {
    audioBuffer, duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    numberOfChannels: audioBuffer.numberOfChannels,
    name: name ?? (file instanceof File ? file.name : 'unknown'),
  }
}
