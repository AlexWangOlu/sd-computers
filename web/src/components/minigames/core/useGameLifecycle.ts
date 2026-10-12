import { useState, useEffect, useRef, useCallback } from 'react'
import type { Phase } from './types'

export function useGameLifecycle(onWin: () => void, onFail?: () => void, onProgress?: (step: number, payload?: unknown) => void) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [failBarDrained, setFailBarDrained] = useState(false)

  const phaseRef = useRef<Phase>('idle')
  const onWinRef = useRef(onWin)
  const onFailRef = useRef(onFail)
  const onProgressRef = useRef(onProgress)

  useEffect(() => { onWinRef.current = onWin }, [onWin])
  useEffect(() => { onFailRef.current = onFail }, [onFail])
  useEffect(() => { onProgressRef.current = onProgress }, [onProgress])

  const reportProgress = useCallback((step: number, payload?: unknown) => { onProgressRef.current?.(step, payload) }, [])

  const changePhase = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  useEffect(() => {
    if (phase !== 'won') return
    const t = setTimeout(() => onWinRef.current(), 2200)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'dead') return
    setFailBarDrained(false)
    const t1 = setTimeout(() => setFailBarDrained(true), 50)
    const t2 = setTimeout(() => onFailRef.current?.(), 2200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [phase])

  return { phase, changePhase, phaseRef, failBarDrained, reportProgress }
}
