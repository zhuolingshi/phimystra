import { http } from '@kit.NetworkKit'
import { APP_VERSION } from './appState'

export interface UpdateInfo {
  hasUpdate: boolean
  latestVersion: string
  currentVersion: string
  downloadUrl: string
  note: string
  networkError: boolean
}

const REPO = 'zhuolingshi/phimystra'
const API_URL = `https://api.github.com/repos/${REPO}/contents/update.json`

interface GitHubFileResponse {
  content: string
}

interface UpdateJsonData {
  version?: string
  versionHarmony?: string
  url?: string
  urlHarmony?: string
  note?: string
  noteHarmony?: string
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const currentVersion = APP_VERSION
  try {
    const req = http.createHttp()
    const resp = await req.request(API_URL, {
      method: http.RequestMethod.GET,
      header: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PhiMystra-HarmonyOS'
      },
      expectDataType: http.HttpDataType.STRING,
      connectTimeout: 10000,
      readTimeout: 10000
    })
    req.destroy()

    if (resp.responseCode !== 200) {
      return networkError(currentVersion)
    }

    const respStr = resp.result as string
    const ghResp = JSON.parse(respStr) as GitHubFileResponse
    const contentBase64 = ghResp.content
    const cleaned = contentBase64.replace(/\n/g, '')
    const decoded = base64Decode(cleaned)
    const updateJson = JSON.parse(decoded) as UpdateJsonData

    const latestVersion = updateJson.versionHarmony ?? updateJson.version ?? currentVersion
    const url = updateJson.urlHarmony ?? updateJson.url ?? ''

    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0

    return {
      hasUpdate,
      latestVersion,
      currentVersion,
      downloadUrl: url,
      note: updateJson.noteHarmony ?? updateJson.note ?? '',
      networkError: false
    }
  } catch {
    return { hasUpdate: false, currentVersion, latestVersion: currentVersion, downloadUrl: '', note: '', networkError: true }
  }
}

function noUpdate(version: string): UpdateInfo {
  return {
    hasUpdate: false,
    latestVersion: version,
    currentVersion: version,
    downloadUrl: '',
    note: '',
    networkError: true
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(s => parseInt(s) || 0)
  const pb = b.split('.').map(s => parseInt(s) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va > vb) return 1
    if (va < vb) return -1
  }
  return 0
}

function base64Decode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
  let result = ''
  let i = 0
  const cleanStr = str.replace(/[^A-Za-z0-9+/=]/g, '')
  while (i < cleanStr.length) {
    const a = chars.indexOf(cleanStr[i++])
    const b = chars.indexOf(cleanStr[i++])
    const c = chars.indexOf(cleanStr[i++])
    const d = chars.indexOf(cleanStr[i++])
    const n1 = (a << 2) | (b >> 4)
    const n2 = ((b & 15) << 4) | (c >> 2)
    const n3 = ((c & 3) << 6) | d
    result += String.fromCharCode(n1)
    if (c !== 64) result += String.fromCharCode(n2)
    if (d !== 64) result += String.fromCharCode(n3)
  }
  return result
}
