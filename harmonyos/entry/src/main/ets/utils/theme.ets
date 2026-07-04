import { preferences } from '@kit.ArkData'

const PREF_NAME = 'phimystra_prefs'
const KEY_THEME = 'theme_mode'

export enum ThemeMode {
  Light = 'light',
  Dark = 'dark',
  System = 'system'
}

export interface AppTheme {
  bgPrimary: ResourceColor
  bgCard: ResourceColor
  textPrimary: ResourceColor
  textSecondary: ResourceColor
  accent: ResourceColor
  accentText: ResourceColor
  border: ResourceColor
  danger: ResourceColor
  bgInput: ResourceColor
  isDark: boolean
}

export function getResourceTheme(): AppTheme {
  return {
    bgPrimary: $r('app.color.bg_primary'),
    bgCard: $r('app.color.bg_card'),
    textPrimary: $r('app.color.text_primary'),
    textSecondary: $r('app.color.text_secondary'),
    accent: $r('app.color.accent'),
    accentText: $r('app.color.accent_text'),
    border: $r('app.color.border'),
    danger: $r('app.color.danger'),
    bgInput: $r('app.color.bg_input'),
    isDark: false
  }
}

export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    const pref = await preferences.getPreferences(globalThis.ctx, PREF_NAME)
    const val = await pref.get(KEY_THEME, ThemeMode.System)
    if (typeof val === 'string') {
      return val as ThemeMode
    }
    return ThemeMode.System
  } catch {
    return ThemeMode.System
  }
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  try {
    const pref = await preferences.getPreferences(globalThis.ctx, PREF_NAME)
    await pref.put(KEY_THEME, mode)
    await pref.flush()
  } catch (e) {
    console.error('[Theme] Failed to save theme: ' + JSON.stringify(e))
  }
}
