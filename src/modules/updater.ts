import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

const APP_VERSION = '0.1.2'

// jsdelivr CDN 加速（国内可访问）
const UPDATE_URL = 'https://cdn.jsdelivr.net/gh/zhuolingshi/phimystra@main/update.json'

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

export async function checkForUpdate(): Promise<UpdateInfo> {
  const current = APP_VERSION

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const resp = await tauriFetch(UPDATE_URL, { signal: controller.signal })
    clearTimeout(timer)
    if (!resp.ok) {
      return { hasUpdate: false, currentVersion: current, latestVersion: current, networkError: true }
    }
    const data = await resp.json()
    const latest = data.version ?? current
    const hasUpdate = compareVersions(latest, current) > 0

    return {
      hasUpdate,
      currentVersion: current,
      latestVersion: latest,
      downloadUrl: data.url,
      note: data.note,
    }
  } catch {
    return { hasUpdate: false, currentVersion: current, latestVersion: current, networkError: true }
  }
}
