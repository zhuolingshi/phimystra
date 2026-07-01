export function hammingWindow(length: number): Float32Array {
  const win = new Float32Array(length)
  for (let i = 0; i < length; i++)
    win[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (length - 1))
  return win
}

// Cooley-Tukey radix-2 FFT
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length
  if (n <= 1) return
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]; ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1
    const angle = (-2 * Math.PI) / len
    const wRe = Math.cos(angle), wIm = Math.sin(angle)
    for (let i = 0; i < n; i += len) {
      let curWRe = 1, curWIm = 0
      for (let j = 0; j < halfLen; j++) {
        const tRe = curWRe * re[i + j + halfLen] - curWIm * im[i + j + halfLen]
        const tIm = curWRe * im[i + j + halfLen] + curWIm * re[i + j + halfLen]
        re[i + j + halfLen] = re[i + j] - tRe
        im[i + j + halfLen] = im[i + j] - tIm
        re[i + j] += tRe; im[i + j] += tIm
        const nw = curWRe * wRe - curWIm * wIm
        curWIm = curWRe * wIm + curWIm * wRe; curWRe = nw
      }
    }
  }
}

export function magnitudeSpectrum(fftInput: Float32Array): Float32Array {
  const n = fftInput.length
  const re = new Float32Array(n), im = new Float32Array(n)
  re.set(fftInput)
  fft(re, im)
  const halfN = Math.floor(n / 2) + 1
  const mag = new Float32Array(halfN)
  for (let i = 0; i < halfN; i++)
    mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i])
  return mag
}

export interface STFTOptions { fftSize?: number; hopSize?: number; window?: Float32Array }

export function stft(signal: Float32Array, options: STFTOptions = {}): Float32Array[] {
  const { fftSize = 2048, hopSize = 512 } = options
  const window = options.window ?? hammingWindow(fftSize)
  const frames: Float32Array[] = []
  for (let start = 0; start + fftSize <= signal.length; start += hopSize) {
    const frame = new Float32Array(fftSize)
    for (let i = 0; i < fftSize; i++)
      frame[i] = signal[start + i] * window[i]
    frames.push(magnitudeSpectrum(frame))
  }
  return frames
}
