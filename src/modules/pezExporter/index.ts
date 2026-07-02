// pez 导出器：使用 fflate 将谱面和音频打包为 .pez（ZIP）格式

import { zipSync, strToU8 } from 'fflate'
import type { RPEChart } from '../../types/rpe'

export interface PezExportParams {
  chart: RPEChart
  audioData: ArrayBuffer | Uint8Array
  audioFormat?: 'wav' | 'mp3' | 'ogg'
  coverData?: Uint8Array
  lineData?: Uint8Array
  filename?: string
}

export interface PezExportResult {
  data: Uint8Array
  filename: string
  size: number
}

export function exportPez(params: PezExportParams): PezExportResult {
  const {
    chart,
    audioData,
    audioFormat = 'wav',
    coverData,
    lineData,
    filename,
  } = params

  const pathId = chart.META.id || '10000000'
  const audioExt = audioFormat
  const chartFile = `${pathId}.json`
  const musicFile = `${pathId}.${audioExt}`
  const imageFile = coverData ? `${pathId}.png` : `${pathId}.png`

  // 更新 META 中的文件引用，使其与实际打包文件名一致
  const chartWithMeta: RPEChart = {
    ...chart,
    META: {
      ...chart.META,
      song: musicFile,
      background: imageFile,
    },
  }

  const files: Record<string, Uint8Array> = {}

  files[chartFile] = strToU8(JSON.stringify(chartWithMeta, null, 2))
  files[musicFile] = new Uint8Array(audioData)

  if (coverData) {
    files[imageFile] = coverData
  } else {
    files[imageFile] = generateCoverImage()
  }

  files['line.png'] = lineData ?? generateDefaultLineTexture()
  files['info.txt'] = strToU8(buildInfoTxt(chart, pathId, chartFile, musicFile, imageFile))
  files['info.yml'] = strToU8(buildInfoYml(chart, pathId, chartFile, musicFile, imageFile))

  const zipped = zipSync(files)
  const name = filename || `${chartWithMeta.META.name || 'chart'}.zip`

  return {
    data: zipped,
    filename: name,
    size: zipped.byteLength,
  }
}

function buildInfoTxt(
  chart: RPEChart,
  pathId: string,
  chartFile: string,
  musicFile: string,
  imageFile: string
): string {
  const m = chart.META
  return [
    '#',
    `Name: ${m.name}`,
    `Path: ${pathId}`,
    `Song: ${musicFile}`,
    `Picture: ${imageFile}`,
    `Chart: ${chartFile}`,
    `Level: ${m.level}`,
    `Composer: ${m.composer}`,
    `Charter: ${m.charter}`,
  ].join('\n') + '\n'
}

function buildInfoYml(
  chart: RPEChart,
  _pathId: string,
  chartFile: string,
  musicFile: string,
  imageFile: string
): string {
  const m = chart.META
  const levelNum = parseFloat(m.level.replace(/[^0-9.]/g, '')) || 1
  return [
    `name: ${m.name}`,
    `difficulty: ${levelNum}`,
    `level: ${m.level}`,
    `charter: ${m.charter}`,
    `composer: ${m.composer}`,
    `illustrator: AI`,
    `chart: ${chartFile}`,
    `music: ${musicFile}`,
    `illustration: ${imageFile}`,
    `previewStart: 0.0`,
    `previewEnd: null`,
    `aspectRatio: 1.7777778`,
    `backgroundDim: 0.6`,
    `lineLength: 6.0`,
    `offset: ${m.offset ?? 0}`,
    `tags: []`,
    `holdPartialCover: false`,
    `noteUniformScale: false`,
    `forceAspectRatio: false`,
  ].join('\n') + '\n'
}

function generateDefaultLineTexture(): Uint8Array {
  // 生成 4x100 白色判定线纹理（带透明渐变）
  return generatePng(4, 100, (_x, y) => {
    const alpha = Math.min(255, y * 8)
    return [255, 255, 255, alpha]
  })
}

function generateCoverImage(): Uint8Array {
  // 生成 256x256 深蓝色渐变封面
  return generatePng(256, 256, (x, y) => {
    const r = Math.round(20 + x * 0.1)
    const g = Math.round(20 + y * 0.1)
    const b = Math.round(60 + (x + y) * 0.15)
    return [r, g, b, 255]
  })
}

// 生成合法 PNG 图片（RGBA）
function generatePng(
  width: number, height: number,
  pixelFn: (x: number, y: number) => [number, number, number, number]
): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

  const ihdr = makeChunk('IHDR', new Uint8Array([
    (width >> 24) & 0xff, (width >> 16) & 0xff, (width >> 8) & 0xff, width & 0xff,
    (height >> 24) & 0xff, (height >> 16) & 0xff, (height >> 8) & 0xff, height & 0xff,
    8, // bit depth
    6, // color type: RGBA
    0, 0, 0, // compression, filter, interlace
  ]))

  // 构建原始像素数据（每行前加 filter byte 0）
  const rawData = new Uint8Array(height * (1 + width * 4))
  let pos = 0
  for (let y = 0; y < height; y++) {
    rawData[pos++] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y)
      rawData[pos++] = r
      rawData[pos++] = g
      rawData[pos++] = b
      rawData[pos++] = a
    }
  }

  const compressed = zlibStored(rawData)
  const idat = makeChunk('IDAT', compressed)
  const iend = makeChunk('IEND', new Uint8Array(0))

  // 合并所有部分
  const totalLen = signature.length + ihdr.length + idat.length + iend.length
  const result = new Uint8Array(totalLen)
  let offset = 0
  result.set(signature, offset); offset += signature.length
  result.set(ihdr, offset); offset += ihdr.length
  result.set(idat, offset); offset += idat.length
  result.set(iend, offset)
  return result
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length
  const chunk = new Uint8Array(4 + 4 + len + 4)
  const view = new DataView(chunk.buffer)

  // Length (big-endian)
  view.setUint32(0, len, false)

  // Type
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i)

  // Data
  chunk.set(data, 8)

  // CRC (over type + data)
  const crc = crc32(chunk, 4, 8 + len)
  view.setUint32(8 + len, crc, false)

  return chunk
}

// CRC32 查找表
const CRC_TABLE: number[] = (() => {
  const table = new Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(data: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff
  for (let i = start; i < end; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

// Adler-32 校验和（zlib 要求）
function adler32(data: Uint8Array): number {
  let a = 1, b = 0
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

// 手动构建 zlib 格式（stored / 无压缩模式）
// 格式：2字节头 + N个stored块 + 4字节adler32
function zlibStored(data: Uint8Array): Uint8Array {
  const chunkSize = 65535
  const numChunks = Math.ceil(data.length / chunkSize) || 1
  const totalSize = 2 + numChunks * 5 + data.length + 4
  const result = new Uint8Array(totalSize)
  let pos = 0

  // zlib 头：CMF=0x78（deflate, 32K窗口）, FLG=0x01（校验 0x7801 % 31 = 0）
  result[pos++] = 0x78
  result[pos++] = 0x01

  // stored 块（每块最多 65535 字节）
  let offset = 0
  for (let i = 0; i < numChunks; i++) {
    const isLast = i === numChunks - 1
    const len = Math.min(chunkSize, data.length - offset)
    const nlen = (~len) & 0xffff

    result[pos++] = isLast ? 0x01 : 0x00 // BFINAL + BTYPE=00(stored)
    result[pos++] = len & 0xff           // LEN (little-endian)
    result[pos++] = (len >> 8) & 0xff
    result[pos++] = nlen & 0xff          // NLEN (ones complement)
    result[pos++] = (nlen >> 8) & 0xff

    result.set(data.subarray(offset, offset + len), pos)
    pos += len
    offset += len
  }

  // adler32（big-endian）
  const adler = adler32(data)
  result[pos++] = (adler >>> 24) & 0xff
  result[pos++] = (adler >>> 16) & 0xff
  result[pos++] = (adler >>> 8) & 0xff
  result[pos++] = adler & 0xff

  return result
}

export function downloadPez(result: PezExportResult): void {
  const blob = new Blob([result.data as BlobPart], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function encodeAudioBufferToWav(audioBuffer: AudioBuffer): Uint8Array {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const length = audioBuffer.length
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = length * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  const channels: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch))
  }

  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Uint8Array(buffer)
}
