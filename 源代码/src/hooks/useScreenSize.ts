import { useState, useEffect } from 'react'

export type ScreenSize = 'phone' | 'tablet' | 'desktop'
export type Orientation = 'portrait' | 'landscape'

export interface ScreenInfo {
  size: ScreenSize
  orientation: Orientation
  width: number
  isTouch: boolean
}

export const isMobilePlatform = typeof navigator !== 'undefined' &&
  (/android|iphone|ipad/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0)

function getScreenInfo(): ScreenInfo {
  if (typeof window === 'undefined') {
    return { size: 'desktop', orientation: 'landscape', width: 1024, isTouch: false }
  }
  const w = window.innerWidth
  const h = window.innerHeight
  const isTouch = navigator.maxTouchPoints > 0 || /android|iphone|ipad/i.test(navigator.userAgent)
  const minDim = Math.min(w, h)
  const size: ScreenSize = !isTouch ? 'desktop' : minDim >= 600 ? 'tablet' : 'phone'
  const orientation: Orientation = w >= h ? 'landscape' : 'portrait'
  return { size, orientation, width: w, isTouch }
}

export function useScreenSize(): ScreenInfo {
  const [screen, setScreen] = useState<ScreenInfo>(getScreenInfo)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const handler = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setScreen(getScreenInfo()), 100)
    }
    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('orientationchange', handler)
      clearTimeout(timer)
    }
  }, [])

  return screen
}
