// 难度参数系统：基于 10 个真实 Phira 谱面数据校准
//
// 真实谱面统计：
// - Tap(type1) 占比 50-70%，Hold(type2) 10-25%，Flick(type3) 5-15%，Drag(type4) 10-30%
// - 最小音符间隔 Q1=0.126s，中位数 0.246s
// - Hold 持续 0.1-1.5s
// - note.speed 几乎全为 1.0
// - positionX 范围 -540~540
// - speedEvents 值几乎全为 10.0（真实谱面标准值）

export type DifficultyTier = 'beginner' | 'easy' | 'normal' | 'hard'

export interface DifficultyParams {
  level: number
  tier: DifficultyTier
  noteDensity: number        // 0-1，选取 onset 的比例
  holdThreshold: number      // 秒，onset 持续时间超过此值才设为 Hold（真实谱面 Hold 很少）
  flickProbability: number   // 0-1， accent 音效设为 Flick 的概率
  dragProbability: number    // 0-1，连续急促音符设为 Drag 的概率
  judgeLineCount: number     // 判定线数量
  lineTemplate: string       // 判定线模板名
  clickInterval: number      // 秒，最小音符间隔（真实 Q1=0.126s）
  fallSpeed: number          // 判定线滚动速度（真实谱面 6-10）
  targetNPS: number          // 目标每秒音符数
  maxSimultaneous: number    // 最大同时按键数（真实谱面 2-4）
  maxLaneJump: number        // 最大通道跳跃数
  beatSubdivision: number    // 节拍细分（1=四分,2=八分,4=十六分）
  holdRatio: number          // Hold 音符目标占比
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
      flickProbability: 0.08,
      dragProbability: 0.05,
      judgeLineCount: 1,
      lineTemplate: 'static-single',
      clickInterval: 0.35,    // 真实 Q1=0.126，新手更宽松
      fallSpeed: 10.0,         // 真实谱面标准值
      targetNPS: 1.2,
      maxSimultaneous: 2,
      maxLaneJump: 2,
      beatSubdivision: 2,
      holdRatio: 0.02,
    },
    easy: {
      noteDensity: 0.5,
      holdThreshold: 0.8,
      flickProbability: 0.12,
      dragProbability: 0.1,
      judgeLineCount: 1,
      lineTemplate: 'static-single',
      clickInterval: 0.22,
      fallSpeed: 10.0,
      targetNPS: 2.0,
      maxSimultaneous: 2,
      maxLaneJump: 3,
      beatSubdivision: 2,
      holdRatio: 0.03,
    },
    normal: {
      noteDensity: 0.75,
      holdThreshold: 0.7,
      flickProbability: 0.15,
      dragProbability: 0.15,
      judgeLineCount: 2,
      lineTemplate: 'static-dual',
      clickInterval: 0.15,    // 接近真实 Q1
      fallSpeed: 10.0,
      targetNPS: 3.5,
      maxSimultaneous: 3,
      maxLaneJump: 4,
      beatSubdivision: 4,
      holdRatio: 0.04,
    },
    hard: {
      noteDensity: 0.95,
      holdThreshold: 0.6,
      flickProbability: 0.20,
      dragProbability: 0.20,
      judgeLineCount: 2,
      lineTemplate: 'static-dual',
      clickInterval: 0.12,    // 真实最小值
      fallSpeed: 10.0,
      targetNPS: 5.0,
      maxSimultaneous: 4,
      maxLaneJump: 5,
      beatSubdivision: 4,
      holdRatio: 0.05,
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

// 玩法覆盖：根据两指/多指调整参数
export type Playstyle = 'two-finger' | 'multi-finger'

export function applyPlaystyle(params: DifficultyParams, playstyle: Playstyle): DifficultyParams {
  if (playstyle === 'two-finger') {
    return {
      ...params,
      maxSimultaneous: 2,
      maxLaneJump: Math.min(params.maxLaneJump, 3),
    }
  }
  return {
    ...params,
    maxSimultaneous: Math.max(params.maxSimultaneous, 4),
    maxLaneJump: Math.max(params.maxLaneJump, 5),
  }
}
