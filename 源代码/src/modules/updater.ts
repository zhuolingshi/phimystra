import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

const APP_VERSION = '0.1.7'

// 直接用 GitHub API（无 CDN 缓存延迟，即时同步）
const UPDATE_URL = 'https://api.github.com/repos/zhuolingshi/phimystra/contents/update.json'

export interface UpdateInfo {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  downloadUrl?: string
  note?: string
  networkError?: boolean
}

export function getAppVersion(): string {
  return APP_VERSION
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va > vb) return 1
    if (va < vb) return -1
  }
  return 0
}

function decodeBase64(base64: string): string {
  const cleaned = base64.replace(/\n/g, '')
  const bytes = Uint8Array.from(atob(cleaned), c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function detectPlatform(): 'android' | 'windows' | 'other' {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/android/i.test(ua)) return 'android'
  if (/windows|win32|win64/i.test(ua)) return 'windows'
  return 'other'
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const current = APP_VERSION
  const platform = detectPlatform()

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const resp = await tauriFetch(UPDATE_URL, {
      signal: controller.signal,
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    })
    clearTimeout(timer)
    if (!resp.ok) {
      return { hasUpdate: false, currentVersion: current, latestVersion: current, networkError: true }
    }
    const raw = await resp.json()
    const data = JSON.parse(decodeBase64(raw.content))

    // 分平台版本检测：优先取平台专属版本号，回退到全局 version
    const versionKey = platform === 'android' ? 'versionAndroid'
      : platform === 'windows' ? 'versionWindows'
      : null
    const latest = (versionKey && data[versionKey]) ? data[versionKey] : (data.version ?? current)
    const hasUpdate = compareVersions(latest, current) > 0

    // 分平台下载链接
    const downloadUrl = platform === 'android'
      ? (data.urlAndroid ?? data.url)
      : platform === 'windows'
        ? (data.urlWindows ?? data.url)
        : data.url

    return {
      hasUpdate,
      currentVersion: current,
      latestVersion: latest,
      downloadUrl,
      note: data.note,
    }
  } catch {
    return { hasUpdate: false, currentVersion: current, latestVersion: current, networkError: true }
  }
}
