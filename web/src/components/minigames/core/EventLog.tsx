import { alpha } from '@/theme/palette'
import type { LogEntry } from './useEventLog'

export interface LogTypeStyle {
  label: string
  color: string
  msg?: string
}

interface EventLogProps<T extends string> {
  entries: LogEntry<T>[]
  styles: Record<T, LogTypeStyle>
  badgeMinWidth?: number
}

export function EventLog<T extends string>({ entries, styles, badgeMinWidth = 32 }: EventLogProps<T>) {
  return (
    <>
      {entries.map(ev => {
        const s = styles[ev.type]
        return (
          <div key={ev.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '3px 2px', borderBottom: `1px solid ${alpha('white', 0.03)}`,
          }}>
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', flexShrink: 0,
              minWidth: badgeMinWidth, color: s.color,
            }}>
              {s.label}
            </span>
            <span style={{ fontSize: 9, letterSpacing: '0.03em', color: s.msg ?? alpha('fog', 0.4) }}>
              {ev.text}
            </span>
          </div>
        )
      })}
    </>
  )
}
