import { describe, it, expect } from 'vitest'
import { levelToParams, getDifficultyTier, levelToRPEString } from '../src/modules/chartEngine/difficultyParams'

describe('getDifficultyTier', () => {
  it('Lv1-4 为 beginner', () => {
    expect(getDifficultyTier(1)).toBe('beginner')
    expect(getDifficultyTier(4)).toBe('beginner')
  })
  it('Lv5-8 为 easy', () => {
    expect(getDifficultyTier(5)).toBe('easy')
    expect(getDifficultyTier(8)).toBe('easy')
  })
  it('Lv9-12 为 normal', () => {
    expect(getDifficultyTier(9)).toBe('normal')
    expect(getDifficultyTier(12)).toBe('normal')
  })
  it('Lv13-16 为 hard', () => {
    expect(getDifficultyTier(13)).toBe('hard')
    expect(getDifficultyTier(16)).toBe('hard')
  })
})

describe('levelToParams', () => {
  it('Lv1 参数正确', () => {
    const p = levelToParams(1)
    expect(p.level).toBe(1)
    expect(p.tier).toBe('beginner')
    expect(p.noteDensity).toBeLessThan(0.5)
    expect(p.flickProbability).toBeLessThan(0.15)
    expect(p.judgeLineCount).toBe(1)
  })

  it('Lv14 参数正确', () => {
    const p = levelToParams(14)
    expect(p.level).toBe(14)
    expect(p.tier).toBe('hard')
    expect(p.noteDensity).toBeGreaterThan(0.9)
    expect(p.flickProbability).toBeGreaterThan(0.1)
    expect(p.holdThreshold).toBeLessThan(0.8)
    expect(p.targetNPS).toBeGreaterThan(4)
  })

  it('超出范围被限制', () => {
    expect(levelToParams(0).level).toBe(1)
    expect(levelToParams(99).level).toBe(16)
  })

  it('难度越高 holdThreshold 越低', () => {
    const easy = levelToParams(3)
    const hard = levelToParams(15)
    expect(hard.holdThreshold).toBeLessThan(easy.holdThreshold)
  })
})

describe('levelToRPEString', () => {
  it('生成正确的难度标签', () => {
    expect(levelToRPEString(3)).toBe('EZ Lv.3')
    expect(levelToRPEString(7)).toBe('HD Lv.7')
    expect(levelToRPEString(11)).toBe('IN Lv.11')
    expect(levelToRPEString(15)).toBe('AT Lv.15')
  })
})
