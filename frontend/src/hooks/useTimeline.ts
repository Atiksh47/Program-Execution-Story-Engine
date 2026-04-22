import { useState, useCallback, useRef, useEffect } from 'react'
import type { TraceEvent } from '../types'

export function useTimeline(events: TraceEvent[]) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const current = events[step] ?? null
  const total = events.length

  const prev = useCallback(() => setStep(s => Math.max(0, s - 1)), [])
  const next = useCallback(() => setStep(s => Math.min(total - 1, s + 1)), [total])
  const goTo = useCallback((n: number) => setStep(Math.max(0, Math.min(total - 1, n))), [total])

  const togglePlay = useCallback(() => setPlaying(p => !p), [])

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setStep(s => {
          if (s >= total - 1) {
            setPlaying(false)
            return s
          }
          return s + 1
        })
      }, 300)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, total])

  useEffect(() => { setStep(0); setPlaying(false) }, [events])

  const getPrevLocals = (): Record<string, unknown> => events[step - 1]?.locals ?? {}

  return { step, current, total, prev, next, goTo, playing, togglePlay, getPrevLocals }
}
