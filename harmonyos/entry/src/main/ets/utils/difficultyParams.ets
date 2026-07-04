export enum DifficultyTier {
  Beginner = 'beginner',
  Easy = 'easy',
  Normal = 'normal',
  Hard = 'hard'
}

export enum Playstyle {
  TwoFinger = 'two-finger',
  MultiFinger = 'multi-finger'
}

export class DifficultyParams {
  level: number = 10
  tier: DifficultyTier = DifficultyTier.Normal
  noteDensity: number = 0.75
  holdThreshold: number = 0.7
  flickProbability: number = 0.15
  dragProbability: number = 0.15
  judgeLineCount: number = 2
  lineTemplate: string = 'static-dual'
  clickInterval: number = 0.15
  fallSpeed: number = 10.0
  targetNPS: number = 3.5
  maxSimultaneous: number = 3
  maxLaneJump: number = 4
  beatSubdivision: number = 4
  holdRatio: number = 0.04
}

export function getDifficultyTier(level: number): DifficultyTier {
  if (level <= 4) return DifficultyTier.Beginner
  if (level <= 8) return DifficultyTier.Easy
  if (level <= 12) return DifficultyTier.Normal
  return DifficultyTier.Hard
}

export function levelToParams(level: number): DifficultyParams {
  const clamped = Math.max(1, Math.min(16, level))
  const tier = getDifficultyTier(clamped)
  const p = new DifficultyParams()
  p.level = clamped
  p.tier = tier

  switch (tier) {
    case DifficultyTier.Beginner:
      p.noteDensity = 0.3; p.holdThreshold = 1.0
      p.flickProbability = 0.08; p.dragProbability = 0.05
      p.judgeLineCount = 1; p.lineTemplate = 'static-single'
      p.clickInterval = 0.35; p.fallSpeed = 10.0
      p.targetNPS = 1.2; p.maxSimultaneous = 2
      p.maxLaneJump = 2; p.beatSubdivision = 2
      p.holdRatio = 0.02
      break
    case DifficultyTier.Easy:
      p.noteDensity = 0.5; p.holdThreshold = 0.8
      p.flickProbability = 0.12; p.dragProbability = 0.1
      p.judgeLineCount = 1; p.lineTemplate = 'static-single'
      p.clickInterval = 0.22; p.fallSpeed = 10.0
      p.targetNPS = 2.0; p.maxSimultaneous = 2
      p.maxLaneJump = 3; p.beatSubdivision = 2
      p.holdRatio = 0.03
      break
    case DifficultyTier.Normal:
      p.noteDensity = 0.75; p.holdThreshold = 0.7
      p.flickProbability = 0.15; p.dragProbability = 0.15
      p.judgeLineCount = 2; p.lineTemplate = 'static-dual'
      p.clickInterval = 0.15; p.fallSpeed = 10.0
      p.targetNPS = 3.5; p.maxSimultaneous = 3
      p.maxLaneJump = 4; p.beatSubdivision = 4
      p.holdRatio = 0.04
      break
    case DifficultyTier.Hard:
      p.noteDensity = 0.95; p.holdThreshold = 0.6
      p.flickProbability = 0.20; p.dragProbability = 0.20
      p.judgeLineCount = 2; p.lineTemplate = 'static-dual'
      p.clickInterval = 0.12; p.fallSpeed = 10.0
      p.targetNPS = 5.0; p.maxSimultaneous = 4
      p.maxLaneJump = 5; p.beatSubdivision = 4
      p.holdRatio = 0.05
      break
  }
  return p
}

export function levelToRPEString(level: number): string {
  const tier = getDifficultyTier(level)
  const tierNames: Map<DifficultyTier, string> = new Map([
    [DifficultyTier.Beginner, 'EZ'],
    [DifficultyTier.Easy, 'HD'],
    [DifficultyTier.Normal, 'IN'],
    [DifficultyTier.Hard, 'AT']
  ])
  const name = tierNames.get(tier) ?? 'IN'
  return `${name} Lv.${level}`
}

export function applyPlaystyle(params: DifficultyParams, playstyle: Playstyle): DifficultyParams {
  const result = new DifficultyParams()
  result.level = params.level
  result.tier = params.tier
  result.noteDensity = params.noteDensity
  result.holdThreshold = params.holdThreshold
  result.flickProbability = params.flickProbability
  result.dragProbability = params.dragProbability
  result.judgeLineCount = params.judgeLineCount
  result.lineTemplate = params.lineTemplate
  result.clickInterval = params.clickInterval
  result.fallSpeed = params.fallSpeed
  result.targetNPS = params.targetNPS
  result.maxSimultaneous = params.maxSimultaneous
  result.maxLaneJump = params.maxLaneJump
  result.beatSubdivision = params.beatSubdivision
  result.holdRatio = params.holdRatio

  if (playstyle === Playstyle.TwoFinger) {
    result.maxSimultaneous = 2
    result.maxLaneJump = Math.min(result.maxLaneJump, 3)
  } else {
    result.maxSimultaneous = Math.max(result.maxSimultaneous, 4)
    result.maxLaneJump = Math.max(result.maxLaneJump, 5)
  }
  return result
}
