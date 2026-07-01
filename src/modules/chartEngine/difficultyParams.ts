// 难度参数系统：将 Lv1-16 映射为 AI 制谱引擎的具体参数

export type DifficultyTier = 'beginner' | 'easy' | 'normal' | 'hard'

export interface DifficultyParams {
  level: number
  tier: DifficultyTier
  noteDensity: number        // 0-1，选取 onset 的比例
  holdThreshold: number      // 秒，超过此时长判定为 Hold
  flickProbability: number   // 0-1，Flick 出现概率
  judgeLineCount: number     // 判定线数量
  lineTemplate: string       // 判定线模板名
  clickInterval: number      // 秒，判定"间隔太近"的 Tap 阈值
  holdInterval: number       // 秒，判定"间隔太近"的 Hold 阈值
  dragInterval: number       // 秒，Drag 链音符间隔
  fallSpeed: number          // 音符下落速度
}

export function getDifficultyTier(level: number): DifficultyTier {
  if (level <= 4) return 'beginner'
  if (level <= 8) return 'easy'
  if (level <= 12) return 'normal'
  return 'hard'
}

export function levelToParams(level: number): DifficultyParams {
  const clamped = Math.max(1, Math.min(16, level))
  const tier = getDifficultyTier(clamped)

  const tierConfigs: Record<DifficultyTier, Omit<DifficultyParams, 'level' | 'tier'>> = {
    beginner: {
      noteDensity: 0.3,
      holdThreshold: 1.0,
      flickProbability: 0.0,
      judgeLineCount: 1,
      lineTemplate: 'static-single',
      clickInterval: 0.3,
      holdInterval: 0.4,
      dragInterval: 0.1,
      fallSpeed: 0.2,
    },
    easy: {
      noteDensity: 0.55,
      holdThreshold: 0.5,
      flickProbability: 0.1,
      judgeLineCount: 2,
      lineTemplate: 'static-single',
      clickInterval: 0.2,
      holdInterval: 0.3,
      dragInterval: 0.1,
      fallSpeed: 0.25,
    },
    normal: {
      noteDensity: 0.8,
      holdThreshold: 0.3,
      flickProbability: 0.3,
      judgeLineCount: 4,
      lineTemplate: 'static-four',
      clickInterval: 0.15,
      holdInterval: 0.2,
      dragInterval: 0.08,
      fallSpeed: 0.3,
    },
    hard: {
      noteDensity: 1.0,
      holdThreshold: 0.15,
      flickProbability: 0.5,
      judgeLineCount: 4,
      lineTemplate: 'static-four',
      clickInterval: 0.1,
      holdInterval: 0.15,
      dragInterval: 0.06,
      fallSpeed: 0.35,
    },
  }

  return { level: clamped, tier, ...tierConfigs[tier] }
}

export function levelToRPEString(level: number): string {
  const tier = getDifficultyTier(level)
  const tierNames: Record<DifficultyTier, string> = {
    beginner: 'EZ',
    easy: 'HD',
    normal: 'IN',
    hard: 'AT',
  }
  return `${tierNames[tier]} Lv.${level}`
}
