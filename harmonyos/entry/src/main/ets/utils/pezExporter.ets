import { RPEChart } from '../model/chart'

export interface PezExportParams {
  chart: RPEChart
  audioData: Uint8Array
  audioFormat: string
  coverData?: Uint8Array
  lineData?: Uint8Array
  filename: string
}

export interface PezExportResult {
  data: Uint8Array
  filename: string
  size: number
}

export function exportPez(params: PezExportParams): PezExportResult {
  const chart = params.chart
  const audioData = params.audioData
  const audioFormat = params.audioFormat

  const pathId = chart.META.id || '10000000'
  const chartFile = `${pathId}.json`
  const musicFile = `${pathId}.${audioFormat}`
  const imageFile = `${pathId}.png`

  const origSong = chart.META.song
  const origBg = chart.META.background
  chart.META.song = musicFile
  chart.META.background = imageFile

  const files = new Map<string, Uint8Array>()
  files.set(chartFile, strToU8(JSON.stringify(chart, null, 2)))

  chart.META.song = origSong
  chart.META.background = origBg
  files.set(musicFile, audioData)

  if (params.coverData) {
    files.set(imageFile, params.coverData)
  } else {
    files.set(imageFile, generateCoverImage())
  }

  files.set('line.png', params.lineData ?? generateDefaultLineTexture())
  files.set('info.txt', strToU8(buildInfoTxt(chart, pathId, chartFile, musicFile, imageFile)))
  files.set('info.yml', strToU8(buildInfoYml(chart, chartFile, musicFile, imageFile)))

  const zipped = zipFiles(files)
  const name = params.filename || `${chart.META.name || 'chart'}.zip`

  return { data: zipped, filename: name, size: zipped.byteLength }
}

function strToU8(str: string): Uint8Array {
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c < 0x80) {
      bytes.push(c)
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6))
      bytes.push(0x80 | (c & 0x3f))
    } else if (c < 0xd800 || c >= 0xe000) {
      bytes.push(0xe0 | (c >> 12))
      bytes.push(0x80 | ((c >> 6) & 0x3f))
      bytes.push(0x80 | (c & 0x3f))
    } else {
      i++
      const c2 = str.charCodeAt(i)
      const cp = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff))
      bytes.push(0xf0 | (cp >> 18))
      bytes.push(0x80 | ((cp >> 12) & 0x3f))
      bytes.push(0x80 | ((cp >> 6) & 0x3f))
      bytes.push(0x80 | (cp & 0x3f))
    }
  }
  return new Uint8Array(bytes)
}

function buildInfoTxt(chart: RPEChart, pathId: string, chartFile: string, musicFile: string, imageFile: string): string {
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
    `Charter: ${m.charter}`
  ].join('\n') + '\n'
}

function buildInfoYml(chart: RPEChart, chartFile: string, musicFile: string, imageFile: string): string {
  const m = chart.META
  const levelStr = m.level.replace(/[^0-9.]/g, '')
  const levelNum = parseFloat(levelStr) || 1
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
    `forceAspectRatio: false`
  ].join('\n') + '\n'
}

function generateDefaultLineTexture(): Uint8Array {
  return generatePng(4, 100, (_x: number, y: number) => {
    const alpha = Math.min(255, y * 8)
    return [255, 255, 255, alpha]
  })
}

function generateCoverImage(): Uint8Array {
  return generatePng(256, 256, (x: number, y: number) => {
    const r = Math.round(20 + x * 0.1)
    const g = Math.round(20 + y * 0.1)
    const b = Math.round(60 + (x + y) * 0.15)
    return [r, g, b, 255]
  })
}

const CRC_TABLE: number[] = (() => {
  const table = new Array<number>(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
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

function adler32(data: Uint8Array): number {
  let a = 1, b = 0
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function zlibStored(data: Uint8Array): Uint8Array {
  const chunkSize = 65535
  const numChunks = Math.ceil(data.length / chunkSize) || 1
  const totalSize = 2 + numChunks * 5 + data.length + 4
  const result = new Uint8Array(totalSize)
  let pos = 0

  result[pos++] = 0x78
  result[pos++] = 0x01

  let offset = 0
  for (let i = 0; i < numChunks; i++) {
    const isLast = i === numChunks - 1
    const len = Math.min(chunkSize, data.length - offset)
    const nlen = (~len) & 0xffff

    result[pos++] = isLast ? 0x01 : 0x00
    result[pos++] = len & 0xff
    result[pos++] = (len >> 8) & 0xff
    result[pos++] = nlen & 0xff
    result[pos++] = (nlen >> 8) & 0xff

    result.set(data.subarray(offset, offset + len), pos)
    pos += len
    offset += len
  }

  const adler = adler32(data)
  result[pos++] = (adler >>> 24) & 0xff
  result[pos++] = (adler >>> 16) & 0xff
  result[pos++] = (adler >>> 8) & 0xff
  result[pos++] = adler & 0xff

  return result
}

function generatePng(
  width: number, height: number,
  pixelFn: (x: number, y: number) => number[]
): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

  const ihdrData = new Uint8Array(13)
  const dv = new DataView(ihdrData.buffer)
  dv.setUint32(0, width, false)
  dv.setUint32(4, height, false)
  dv.setUint8(8, 8)
  dv.setUint8(9, 6)
  dv.setUint8(10, 0); dv.setUint8(11, 0); dv.setUint8(12, 0)
  const ihdr = makeChunk('IHDR', ihdrData)

  const rawData = new Uint8Array(height * (1 + width * 4))
  let pos = 0
  for (let y = 0; y < height; y++) {
    rawData[pos++] = 0
    for (let x = 0; x < width; x++) {
      const px = pixelFn(x, y)
      rawData[pos++] = px[0]; rawData[pos++] = px[1]
      rawData[pos++] = px[2]; rawData[pos++] = px[3]
    }
  }

  const compressed = zlibStored(rawData)
  const idat = makeChunk('IDAT', compressed)
  const iend = makeChunk('IEND', new Uint8Array(0))

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

  view.setUint32(0, len, false)
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i)
  chunk.set(data, 8)
  const crc = crc32(chunk, 4, 8 + len)
  view.setUint32(8 + len, crc, false)
  return chunk
}

class ZipEntry {
  name: string
  data: Uint8Array
  crc: number
  compressedSize: number
  localHeaderOffset: number

  constructor(name: string, data: Uint8Array, crc: number, offset: number) {
    this.name = name
    this.data = data
    this.crc = crc
    this.compressedSize = data.length
    this.localHeaderOffset = offset
  }
}

function zipFiles(files: Map<string, Uint8Array>): Uint8Array {
  const entries: ZipEntry[] = []
  const localParts: Uint8Array[] = []
  let currentOffset = 0

  for (const [name, raw] of files) {
    const nameBytes = strToU8(name)
    const crc = crc32(raw, 0, raw.length)
    const localHeaderSize = 30 + nameBytes.length
    const localPart = new Uint8Array(localHeaderSize + raw.length)
    const lv = new DataView(localPart.buffer)

    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0, true)
    lv.setUint16(8, 0, true)
    lv.setUint16(10, 0, true)
    lv.setUint16(12, 0, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, raw.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    localPart.set(nameBytes, 30)
    localPart.set(raw, 30 + nameBytes.length)

    localParts.push(localPart)
    entries.push(new ZipEntry(name, raw, crc, currentOffset))
    currentOffset += localPart.length
  }

  const centralParts: Uint8Array[] = []
  let centralSize = 0
  for (const e of entries) {
    const nameBytes = strToU8(e.name)
    const cdRecord = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cdRecord.buffer)

    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0, true)
    cv.setUint32(16, e.crc, true)
    cv.setUint32(20, e.compressedSize, true)
    cv.setUint32(24, e.compressedSize, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true)
    cv.setUint16(32, 0, true)
    cv.setUint16(34, 0, true)
    cv.setUint16(36, 0, true)
    cv.setUint32(38, 0, true)
    cv.setUint32(42, e.localHeaderOffset, true)
    cdRecord.set(nameBytes, 46)

    centralParts.push(cdRecord)
    centralSize += cdRecord.length
  }

  const totalLocalSize = currentOffset
  const endRecord = new Uint8Array(22)
  const ev = new DataView(endRecord.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, totalLocalSize, true)
  ev.setUint16(20, 0, true)

  const totalLen = currentOffset + centralSize + 22
  const result = new Uint8Array(totalLen)
  let pos = 0
  for (const lp of localParts) { result.set(lp, pos); pos += lp.length }
  for (const cp of centralParts) { result.set(cp, pos); pos += cp.length }
  result.set(endRecord, pos)
  return result
}

export function encodePcmToWav(channelData: Float32Array[], sampleRate: number): Uint8Array {
  const numChannels = channelData.length
  const length = channelData[0].length
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

  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Uint8Array(buffer)
}
