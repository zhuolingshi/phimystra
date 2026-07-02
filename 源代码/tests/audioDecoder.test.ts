import { describe, it, expect, vi } from 'vitest'
import { decodeAudioFile, isSupportedAudioFormat } from '../src/modules/audioImport/audioDecoder'

describe('isSupportedAudioFormat', () => {
  it('接受 mp3/wav/ogg/flac', () => {
    expect(isSupportedAudioFormat('song.mp3')).toBe(true)
    expect(isSupportedAudioFormat('song.wav')).toBe(true)
    expect(isSupportedAudioFormat('song.ogg')).toBe(true)
    expect(isSupportedAudioFormat('song.flac')).toBe(true)
  })
  it('拒绝不支持的格式', () => {
    expect(isSupportedAudioFormat('song.txt')).toBe(false)
    expect(isSupportedAudioFormat('song.mp4')).toBe(false)
  })
})

describe('decodeAudioFile', () => {
  it('使用 AudioContext 解码', async () => {
    const mockBuffer = new ArrayBuffer(8)
    const mockAudioBuffer = {
      duration: 10, sampleRate: 44100, numberOfChannels: 2,
      getChannelData: () => new Float32Array(441000), length: 441000,
    }
    const mockCtx = {
      decodeAudioData: vi.fn().mockResolvedValue(mockAudioBuffer),
      close: vi.fn(),
    }
    vi.stubGlobal('AudioContext', vi.fn(() => mockCtx))

    const mockFile = {
      name: 'test.mp3',
      arrayBuffer: vi.fn().mockResolvedValue(mockBuffer),
    } as unknown as File

    const result = await decodeAudioFile(mockFile, 'test.mp3')
    expect(result.duration).toBe(10)
    expect(result.sampleRate).toBe(44100)
    expect(result.name).toBe('test.mp3')
    vi.restoreAllMocks()
  })
})
