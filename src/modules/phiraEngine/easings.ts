// 缓动函数库：借鉴 PhiZone/player 的 EASINGS + EASING_INTEGRALS
// 28 种缓动函数及其解析积分公式，用于 RPE 事件插值和 speed 累积位移计算

export type EasingFn = (x: number) => number
export type IntegralFn = (x: number) => number

const PI = Math.PI
const c1 = 1.70158
const c3 = c1 + 1
const c4 = (2 * PI) / 3

function bounceOut(x: number): number {
  const n1 = 7.5625, d1 = 2.75
  if (x < 1 / d1) return n1 * x * x
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375
  return n1 * (x -= 2.625 / d1) * x + 0.984375
}

export const EASINGS: EasingFn[] = [
  (x) => x,
  (x) => 1 - Math.cos((x * PI) / 2),
  (x) => Math.sin((x * PI) / 2),
  (x) => x * x,
  (x) => 1 - (1 - x) * (1 - x),
  (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2,
  (x) => x < 0.5 ? 1 - Math.pow(-2 * x + 2, 2) / 2 : 2 * x * x,
  (x) => x * x * x,
  (x) => 1 - Math.pow(1 - x, 3),
  (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  (x) => x < 0.5 ? 1 - Math.pow(-2 * x + 2, 3) / 2 : 4 * x * x * x,
  (x) => x * x * x * x,
  (x) => 1 - Math.pow(1 - x, 4),
  (x) => x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2,
  (x) => x < 0.5 ? 1 - Math.pow(-2 * x + 2, 4) / 2 : 8 * x * x * x * x,
  (x) => x * x * x * x * x,
  (x) => 1 - Math.pow(1 - x, 5),
  (x) => x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2,
  (x) => x < 0.5 ? 1 - Math.pow(-2 * x + 2, 5) / 2 : 16 * x * x * x * x * x,
  (x) => x === 0 ? 0 : Math.pow(2, 10 * x - 10),
  (x) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x),
  (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  (x) => 1 - Math.sqrt(1 - Math.pow(x, 2)),
  (x) => Math.sqrt(1 - Math.pow(x - 1, 2)),
  (x) => 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2),
  (x) => 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2),
  (x) => x === 0 ? 0 : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4),
  (x) => x === 0 ? 0 : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4),
  bounceOut,
]

export const EASING_INTEGRALS: IntegralFn[] = [
  (x) => (x * x) / 2,
  (x) => x - (2 / PI) * Math.sin((x * PI) / 2),
  (x) => -(2 / PI) * (Math.cos((x * PI) / 2) - 1),
  (x) => (x * x * x) / 3,
  (x) => x - x * x + (x * x * x) / 3,
  (x) => x < 0.5 ? (2 * x * x * x) / 3 : x - (2 * Math.pow(-2 * x + 2, 3)) / 6 - 1 / 3,
  (x) => x < 0.5 ? x - (2 * Math.pow(-2 * x + 2, 3)) / 6 - 1 / 3 : (2 * x * x * x) / 3 + 1 / 3,
  (x) => (x * x * x * x) / 4,
  (x) => x + Math.pow(1 - x, 4) / 4 - 1 / 4,
  (x) => x * x * x * x,
  (x) => x < 0.5 ? x - 1 / 4 + Math.pow(-2 * x + 2, 4) / 64 : x - 1 / 4 + (2 * x * x * x * x) / 4 - 1 / 4,
  (x) => (x * x * x * x * x) / 5,
  (x) => x - x * x * x * x * x / 5 + (2 * x * x * x * x) / 5 - x * x * x * x / 5,
  (x) => x < 0.5 ? (8 * x * x * x * x * x) / 5 : x - 1 + Math.pow(-2 * x + 2, 5) / 10,
  (x) => x < 0.5 ? x - 1 + Math.pow(-2 * x + 2, 5) / 10 : (8 * x * x * x * x * x) / 5 + 1 - 1,
  (x) => (x * x * x * x * x * x) / 6,
  (x) => x + Math.pow(1 - x, 6) / 6 - 1 / 6,
  (x) => x < 0.5 ? (16 * x * x * x * x * x * x) / 6 : x - 1 + Math.pow(-2 * x + 2, 6) / 12,
  (x) => x < 0.5 ? x - 1 + Math.pow(-2 * x + 2, 6) / 12 : (16 * x * x * x * x * x * x) / 6 + 1 - 1,
  (x) => x === 0 ? 0 : Math.pow(2, 10 * x - 10) / (10 * Math.LN2) - 1 / (10 * Math.LN2),
  (x) => x === 0 ? 0 : x - 1 + (1 - Math.pow(2, -10 * x)) / (10 * Math.LN2),
  (x) => x < 0.5 ? (4 * x * x * x) / 3 : x - Math.pow(-2 * x + 2, 3) / 6 - 1 / 3,
  (x) => (x - Math.sqrt(1 - x * x) * x / 2 - Math.asin(x) / 2),
  (x) => (x * Math.sqrt(1 - (x - 1) * (x - 1)) / 2 + Math.asin(x - 1) / 2 + x / 2),
  (x) => c3 * Math.pow(x - 1, 4) / 4 + c1 * Math.pow(x - 1, 3) / 3 + x,
  (x) => c3 * Math.pow(x - 1, 4) / 4 + c1 * Math.pow(x - 1, 3) / 3 + x,
  (x) => x === 0 ? 0 : -(Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4)) / (10 * Math.LN2) + 
    (Math.pow(2, 10 * x - 10) * Math.cos((x * 10 - 10.75) * c4) * c4) / ((10 * Math.LN2) * (10 * Math.LN2) + c4 * c4) - 
    (Math.cos(10.75 * c4) * c4) / ((10 * Math.LN2) * (10 * Math.LN2) + c4 * c4),
  (x) => x === 0 ? 0 : -(Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4)) / (10 * Math.LN2) + 
    (Math.pow(2, 10 * x - 10) * Math.cos((x * 10 - 10.75) * c4) * c4) / ((10 * Math.LN2) * (10 * Math.LN2) + c4 * c4) - 
    (Math.cos(10.75 * c4) * c4) / ((10 * Math.LN2) * (10 * Math.LN2) + c4 * c4),
  (x) => {
    const n1 = 7.5625, d1 = 2.75
    if (x < 1 / d1) return n1 * x * x * x / 3
    if (x < 2 / d1) { x -= 1.5 / d1; return n1 * (x * x * x) / 3 + 0.75 * x - 0.75 * 1.5 / d1 }
    if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * (x * x * x) / 3 + 0.9375 * x }
    x -= 2.625 / d1
    return n1 * (x * x * x) / 3 + 0.984375 * x
  },
]

export function getEasingFn(easingType: number): EasingFn {
  const idx = Math.max(0, Math.min(EASINGS.length - 1, easingType - 1))
  return EASINGS[idx]
}

export function getIntegralFn(easingType: number): IntegralFn {
  const idx = Math.max(0, Math.min(EASING_INTEGRALS.length - 1, easingType - 1))
  return EASING_INTEGRALS[idx]
}

export function applyEasing(
  easingType: number,
  x: number,
  easingLeft: number = 0,
  easingRight: number = 1
): number {
  const fn = getEasingFn(easingType)
  const mappedX = easingLeft + (easingRight - easingLeft) * x
  const v = fn(mappedX)
  const v0 = fn(easingLeft)
  const v1 = fn(easingRight)
  const denom = v1 - v0
  return Math.abs(denom) < 1e-12 ? 0 : (v - v0) / denom
}
