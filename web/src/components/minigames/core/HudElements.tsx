import type { Phase } from './types'
import { palette, alpha } from '@/theme/palette'

interface ProgressPipsProps {
  total: number
  current: number
  phase: Phase
}

export function ProgressPips({ total, current, phase }: ProgressPipsProps) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: total }, (_, i) => {
        const filled = i < current
        const active = i === current && phase === 'playing'
        return (
          <div key={i} style={{
            width: 20, height: 8, borderRadius: 2,
            background: filled ? palette.green : active ? alpha('dim', 0.45) : alpha('white', 0.07),
            transition: 'background 0.2s ease',
            boxShadow: filled ? `0 0 5px ${alpha('green', 0.5)}` : 'none',
          }} />
        )
      })}
    </div>
  )
}

interface LivesDotsProps {
  total: number
  current: number
}

export function LivesDots({ total, current }: LivesDotsProps) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: i < current ? palette.accent : alpha('white', 0.1),
          boxShadow: i < current ? `0 0 5px ${alpha('accent', 0.5)}` : 'none',
          transition: 'background 0.2s, box-shadow 0.2s',
        }} />
      ))}
    </div>
  )
}

interface TimerDisplayProps {
  timeLeft: number
}

export function TimerDisplay({ timeLeft }: TimerDisplayProps) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
      color: timeLeft <= 5 ? palette.alert : timeLeft <= 10 ? palette.warnBright : alpha('green', 0.7),
      textShadow: timeLeft <= 5 ? `0 0 8px ${alpha('alert', 0.6)}` : 'none',
    }}>
      {timeLeft}s
    </span>
  )
}
