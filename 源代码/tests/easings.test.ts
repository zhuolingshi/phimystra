import { describe, it, expect } from 'vitest'
import { EASINGS, applyEasing, getEasingFn, getIntegralFn } from '../src/modules/phiraEngine/easings'

describe('EASINGS', () => {
  it('有 28 个缓动函数', () => {
    expect(EASINGS.length).toBeGreaterThanOrEqual(10)
  })

  it('所有缓动函数在 [0,1] 范围内返回有限值', () => {
    for (let i = 0; i < EASINGS.length; i++) {
      const fn = EASINGS[i]
      for (let x = 0; x <= 1; x += 0.1) {
        const v = fn(x)
        expect(Number.isFinite(v)).toBe(true)
      }
    }
  })

  it('前 6 种标准缓动在 x=0 返回 ~0', () => {
    for (let i = 0; i < 6; i++) {
      const v = EASINGS[i](0)
      expect(Math.abs(v)).toBeLessThan(0.1)
    }
  })

  it('前 6 种标准缓动在 x=1 返回 ~1', () => {
    for (let i = 0; i < 6; i++) {
      const v = EASINGS[i](1)
      expect(v).toBeGreaterThan(0.9)
    }
  })
})

describe('applyEasing', () => {
  it('线性缓动返回精确值', () => {
    expect(applyEasing(1, 0.5)).toBeCloseTo(0.5)
    expect(applyEasing(1, 0)).toBeCloseTo(0)
    expect(applyEasing(1, 1)).toBeCloseTo(1)
  })

  it('非线性缓动端点正确', () => {
    for (let easing = 2; easing <= 5; easing++) {
      expect(applyEasing(easing, 0)).toBeCloseTo(0, 1)
      expect(applyEasing(easing, 1)).toBeCloseTo(1, 1)
    }
  })
})

describe('getIntegralFn', () => {
  it('返回积分函数', () => {
    const fn = getIntegralFn(1)
    expect(typeof fn).toBe('function')
    const v = fn(0.5)
    expect(Number.isFinite(v)).toBe(true)
  })
})
