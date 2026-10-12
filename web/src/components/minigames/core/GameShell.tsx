import type { ReactNode, RefObject } from 'react'
import { CANVAS_W, CANVAS_H } from './constants'
import type { Phase } from './types'
import { palette, alpha } from '@/theme/palette'
import { t } from '@/i18n'

export interface OverlayConfig {
  idleSubtitle: string
  idleDescription: ReactNode
  controlsHint: string
  idleExtra?: ReactNode
  deadTitle: string
  deadDescription: ReactNode
  wonTitle: string
  wonDescription: ReactNode
}

interface GameShellProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  phase: Phase
  failBarDrained: boolean
  overlay: OverlayConfig
  hudTitle?: string
  hudContent: ReactNode
  logTitle: string
  logRef: RefObject<HTMLDivElement | null>
  logStatusContent?: ReactNode
  logContent: ReactNode
}

export default function GameShell({
  canvasRef, phase, failBarDrained, overlay,
  hudTitle = t('minigames.shell.hud_title'),
  hudContent, logTitle, logRef, logStatusContent, logContent,
}: GameShellProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      height: '100%', paddingTop: 24, paddingBottom: 12, gap: 8,
      background: palette.panelBg,
      fontFamily: "'JetBrains Mono Variable','JetBrains Mono','Fira Code','Courier New',monospace",
      boxSizing: 'border-box', overflowY: 'hidden',
    }}>

      {}
      <div style={{
        width: CANVAS_W, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: alpha('fog', 0.4), letterSpacing: '0.12em' }}>
          {hudTitle}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hudContent}
        </div>
      </div>

      {}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W} height={CANVAS_H}
          style={{ display: 'block', borderRadius: 4, border: `1px solid ${alpha('green', 0.12)}` }}
        />
        {phase !== 'playing' && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 4,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(8,11,16,0.85)', gap: 10,
          }}>

            {}
            {phase === 'idle' && (<>
              <div style={{ fontSize: 10, color: alpha('fog', 0.35), letterSpacing: '0.1em' }}>
                {overlay.idleSubtitle}
              </div>
              <div style={{ fontSize: 18, color: palette.fog, fontWeight: 700, letterSpacing: '0.06em' }}>
                {t('minigames.shell.ready')}
              </div>
              <div style={{ fontSize: 11, color: alpha('fog', 0.4), textAlign: 'center', maxWidth: 500 }}>
                {overlay.idleDescription}
              </div>
              {overlay.idleExtra}
              <div style={{ marginTop: 10, fontSize: 11, color: palette.green, letterSpacing: '0.08em' }}>
                {t('minigames.shell.press_enter')}
              </div>
              <div style={{ fontSize: 10, color: alpha('fog', 0.28) }}>
                {overlay.controlsHint}
              </div>
            </>)}

            {}
            {phase === 'dead' && (<>
              <div style={{ fontSize: 20, color: palette.danger, fontWeight: 700, letterSpacing: '0.15em' }}>
                ⚠ {overlay.deadTitle}
              </div>
              <div style={{ fontSize: 11, color: alpha('danger', 0.65), letterSpacing: '0.06em' }}>
                {overlay.deadDescription}
              </div>
              <div style={{ fontSize: 10, color: alpha('fog', 0.35), letterSpacing: '0.08em', marginTop: 4 }}>
                {t('minigames.shell.returning')}
              </div>
              <div style={{
                width: 180, height: 2, marginTop: 8,
                background: alpha('danger', 0.15), borderRadius: 1, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: failBarDrained ? '0%' : '100%',
                  background: alpha('danger', 0.7),
                  boxShadow: `0 0 6px ${alpha('danger', 0.5)}`,
                  transition: failBarDrained ? 'width 2.1s linear' : 'none',
                }} />
              </div>
            </>)}

            {}
            {phase === 'won' && (<>
              <div style={{
                fontSize: 16, color: palette.green, fontWeight: 700, letterSpacing: '0.1em',
                textShadow: `0 0 18px ${alpha('green', 0.8)}`,
              }}>
                {overlay.wonTitle}
              </div>
              <div style={{ fontSize: 11, color: alpha('fog', 0.4) }}>
                {overlay.wonDescription}
              </div>
            </>)}
          </div>
        )}
      </div>

      {}
      <div style={{ width: CANVAS_W, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 9, color: alpha('fog', 0.3), letterSpacing: '0.12em' }}>
            {logTitle}
          </span>
          <div style={{ flex: 1, height: 1, background: alpha('white', 0.06) }} />
          {logStatusContent && (
            <span style={{ fontSize: 9, color: alpha('dim', 0.5), letterSpacing: '0.08em' }}>
              {logStatusContent}
            </span>
          )}
        </div>

        <div ref={logRef} className="dd-scroll" style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          {logContent}
        </div>
      </div>
    </div>
  )
}
