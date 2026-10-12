import { useState, useRef, useCallback, useEffect } from 'react'

export interface LogEntry<T extends string> {
  id: number
  text: string
  type: T
}

export function useEventLog<T extends string>(cap = 40) {
  const [entries, setEntries] = useState<LogEntry<T>[]>([])
  const idRef = useRef(0)
  const logRef = useRef<HTMLDivElement>(null)

  const addEvent = useCallback((text: string, type: T) => {
    const id = ++idRef.current
    setEntries(prev => [...prev.slice(-cap), { id, text, type }])
  }, [cap])

  const reset = useCallback(() => {
    setEntries([])
    idRef.current = 0
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [entries])

  return { entries, addEvent, reset, logRef }
}
