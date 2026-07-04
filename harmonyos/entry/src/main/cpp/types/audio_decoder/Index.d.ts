export interface DecodeResult {
  sampleRate: number
  channels: number
  pcmData: ArrayBuffer
  duration: number
}

export const decodeAudio: (fd: number, offset: number, length: number) => Promise<DecodeResult>
