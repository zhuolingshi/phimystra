import { fileIo } from '@kit.CoreFileKit'

class ZipEntry {
  name: string = ''
  data: ArrayBuffer = new ArrayBuffer(0)
  crc: number = 0
  offset: number = 0
  nameLen: number = 0
}

let crcTable: number[] | null = null

function getCrcTable(): number[] {
  if (crcTable !== null) return crcTable
  const table: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      if ((c & 1) === 1) {
        c = 0xEDB88320 ^ (c >>> 1)
      } else {
        c = c >>> 1
      }
    }
    table.push(c & 0xFFFFFFFF)
  }
  crcTable = table
  return table
}

function computeCrc32(buf: ArrayBuffer): number {
  const table = getCrcTable()
  const view = new Uint8Array(buf)
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.byteLength; i++) {
    crc = table[(crc ^ view[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function writeU16(arr: Uint8Array, pos: number, val: number): void {
  arr[pos] = val & 0xFF
  arr[pos + 1] = (val >>> 8) & 0xFF
}

function writeU32(arr: Uint8Array, pos: number, val: number): void {
  arr[pos] = val & 0xFF
  arr[pos + 1] = (val >>> 8) & 0xFF
  arr[pos + 2] = (val >>> 16) & 0xFF
  arr[pos + 3] = (val >>> 24) & 0xFF
}

function strToAscii(s: string): number[] {
  const arr: number[] = []
  for (let i = 0; i < s.length; i++) {
    arr.push(s.charCodeAt(i) & 0xFF)
  }
  return arr
}

export function buildZipFile(zipPath: string, files: Map<string, ArrayBuffer>): void {
  const table = getCrcTable()
  const entries: ZipEntry[] = []
  let totalSize = 0

  const keyList: string[] = []
  files.forEach((data: ArrayBuffer, name: string) => {
    keyList.push(name)
  })

  for (const name of keyList) {
    const data = files.get(name) as ArrayBuffer
    const crc = computeCrc32(data)
    const nameArr = strToAscii(name)
    const entry = new ZipEntry()
    entry.name = name
    entry.data = data
    entry.crc = crc
    entry.offset = 0
    entry.nameLen = nameArr.length
    totalSize += 30 + nameArr.length + data.byteLength
    entries.push(entry)
  }

  let cdSize = 0
  for (const entry of entries) {
    cdSize += 46 + entry.nameLen
  }
  totalSize += cdSize + 22

  const resultBuf = new ArrayBuffer(totalSize)
  const result = new Uint8Array(resultBuf)
  let pos = 0
  let cdOffset = 0
  let headerPos = 0

  for (const entry of entries) {
    const nameArr = strToAscii(entry.name)
    const nameLen = nameArr.length
    const dataLen = entry.data.byteLength

    writeU32(result, pos, 0x04034b50)
    writeU16(result, pos + 4, 20)
    writeU16(result, pos + 6, 0)
    writeU16(result, pos + 8, 0)
    writeU16(result, pos + 10, 0)
    writeU16(result, pos + 12, 0)
    writeU32(result, pos + 14, entry.crc)
    writeU32(result, pos + 18, dataLen)
    writeU32(result, pos + 22, dataLen)
    writeU16(result, pos + 26, nameLen)
    writeU16(result, pos + 28, 0)

    for (let i = 0; i < nameLen; i++) {
      result[pos + 30 + i] = nameArr[i]
    }

    const dataView = new Uint8Array(entry.data)
    for (let i = 0; i < dataLen; i++) {
      result[pos + 30 + nameLen + i] = dataView[i]
    }

    entry.offset = headerPos
    pos += 30 + nameLen + dataLen
    headerPos = pos
  }

  cdOffset = pos

  for (const entry of entries) {
    const nameArr = strToAscii(entry.name)
    const nameLen = nameArr.length
    const dataLen = entry.data.byteLength

    writeU32(result, pos, 0x02014b50)
    writeU16(result, pos + 4, 20)
    writeU16(result, pos + 6, 20)
    writeU16(result, pos + 8, 0)
    writeU16(result, pos + 10, 0)
    writeU16(result, pos + 12, 0)
    writeU16(result, pos + 14, 0)
    writeU32(result, pos + 16, entry.crc)
    writeU32(result, pos + 20, dataLen)
    writeU32(result, pos + 24, dataLen)
    writeU16(result, pos + 28, nameLen)
    writeU16(result, pos + 30, 0)
    writeU16(result, pos + 32, 0)
    writeU16(result, pos + 34, 0)
    writeU16(result, pos + 36, 0)
    writeU32(result, pos + 38, 0)
    writeU32(result, pos + 42, entry.offset)

    for (let i = 0; i < nameLen; i++) {
      result[pos + 46 + i] = nameArr[i]
    }

    pos += 46 + nameLen
  }

  writeU32(result, pos, 0x06054b50)
  writeU16(result, pos + 4, 0)
  writeU16(result, pos + 6, 0)
  writeU16(result, pos + 8, entries.length)
  writeU16(result, pos + 10, entries.length)
  writeU32(result, pos + 12, cdSize)
  writeU32(result, pos + 16, cdOffset)
  writeU16(result, pos + 20, 0)

  const f = fileIo.openSync(zipPath, fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC)
  fileIo.writeSync(f.fd, resultBuf)
  fileIo.closeSync(f)
}
