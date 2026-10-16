import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { gated } from '../core/inputGate'
import { CELL, PLAY_COLS, PLAY_ROWS, OX, OY, PW, PH, SURVIVAL_SLICE_SEC } from '../core/constants'
import type { BaseGameProps } from '../core/types'
import { useGameLifecycle } from '../core/useGameLifecycle'
import { drawVoid, drawPlayArea, drawPlayGrid, drawBorder, drawScanlines } from '../core/canvasUtils'
import GameShell from '../core/GameShell'
import { LivesDots, TimerDisplay } from '../core/HudElements'
import { t } from '@/i18n'
import { palette, alpha } from '@/theme/palette'

const SQUARE_HALF = 3
const SIDE_PX = 12
const PROJ_R = 0.65
const MIN_ARRIVAL_GAP = 28

const CX = PLAY_COLS / 2
const CY = PLAY_ROWS / 2

const SIDE_COLORS = [palette.accent, '#ff0066', '#aaff00', palette.warn]

const PATHS = [
  { sx: CX, sy: 0.5, ex: CX, ey: CY - SQUARE_HALF },
  { sx: PLAY_COLS - 0.5, sy: CY, ex: CX + SQUARE_HALF, ey: CY },
  { sx: CX, sy: PLAY_ROWS - 0.5, ex: CX, ey: CY + SQUARE_HALF },
  { sx: 0.5, sy: CY, ex: CX - SQUARE_HALF, ey: CY },
]

const BLOCK_MESSAGES = [
  'minigames.cipher.block_key_matched', 'minigames.cipher.block_packet_encrypted',
  'minigames.cipher.block_stream_aligned', 'minigames.cipher.block_layer_applied',
  'minigames.cipher.block_handshake_verified', 'minigames.cipher.block_block_absorbed',
  'minigames.cipher.block_rotation_confirmed', 'minigames.cipher.block_channel_locked',
]

const IDLE_LOG_LINES = [
  'minigames.cipher.idle_log_module_loaded',
  'minigames.cipher.idle_log_cipher_array',
  'minigames.cipher.idle_log_packet_density',
  'minigames.cipher.idle_log_awaiting',
]

interface Projectile {
  id: number
  dir: number
  colorIdx: number
  progress: number
  speed: number
}

interface Impact {
  dir: number
  correct: boolean
  tick: number
}

function sideAtDir(dir: number, rotation: number): number {
  return (((dir - rotation) % 4) + 4) % 4
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

interface CipherGameProps extends BaseGameProps {
  timeLimit?: number
  speed?: number
  spawnRate?: number
  playerLives?: number
}

export default function CipherGame({
  onWin, onFail, onProgress,
  timeLimit: propTimeLimit = 20,
  speed: propSpeed = 1.0,
  spawnRate: propSpawnRate = 1.0,
  playerLives: propLives = 1,
}: CipherGameProps) {

  const timeLimit = Math.max(5, propTimeLimit)

  const { phase, changePhase, phaseRef, failBarDrained, reportProgress } = useGameLifecycle(onWin, onFail, onProgress)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logRef = useRef<HTMLDivElement>(null)

  const [timeLeft, setTimeLeft] = useState(timeLimit)
  const [lives, setLives] = useState(propLives)
  const [blockedCount, setBlockedCount] = useState(0)

  const rafRef = useRef<number>(0)
  const tickRef = useRef(0)
  const lastFrameRef = useRef(0)
  const rotationRef = useRef(0)
  const visualAngle = useRef(0)
  const projsRef = useRef<Projectile[]>([])
  const impactsRef = useRef<Impact[]>([])
  const livesRef = useRef(propLives)
  const blockedRef = useRef(0)
  const survivedRef = useRef(0)
  const spawnAccum = useRef(0)
  const projIdRef = useRef(0)
  const lastArrivalRef = useRef(Number.NEGATIVE_INFINITY)
  const lastRotRef = useRef(0)
  const elapsedRef = useRef(0)
  const ROT_CD = 120

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const tick = tickRef.current
    const alive = phaseRef.current === 'playing'
    const rot = rotationRef.current
    const angle = visualAngle.current

    const pcx = OX + CX * CELL
    const pcy = OY + CY * CELL

    drawVoid(ctx)

    drawPlayArea(ctx, OX, OY, PW, PH, palette.fieldBg)

    drawPlayGrid(ctx, OX, OY, PLAY_COLS, PLAY_ROWS, CELL, 0.03)

    ctx.save()
    ctx.beginPath(); ctx.rect(OX, OY, PW, PH); ctx.clip()

    for (let dir = 0; dir < 4; dir++) {
      const colIdx = sideAtDir(dir, rot)
      const col = SIDE_COLORS[colIdx]
      const p = PATHS[dir]
      const ex = OX + p.ex * CELL, ey = OY + p.ey * CELL
      const sx = OX + p.sx * CELL, sy = OY + p.sy * CELL

      const grad = ctx.createLinearGradient(ex, ey, sx, sy)
      grad.addColorStop(0, col + '18')
      grad.addColorStop(1, col + '04')
      ctx.strokeStyle = grad
      ctx.lineWidth = 2
      ctx.setLineDash([8, 12])
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke()
    }
    ctx.setLineDash([])

    for (const proj of projsRef.current) {
      const p = PATHS[proj.dir]
      const px = OX + lerp(p.sx, p.ex, proj.progress) * CELL
      const py = OY + lerp(p.sy, p.ey, proj.progress) * CELL
      const col = SIDE_COLORS[proj.colorIdx]
      const r = PROJ_R * CELL

      const tp = Math.max(0, proj.progress - 0.18)
      const tx = OX + lerp(p.sx, p.ex, tp) * CELL
      const ty = OY + lerp(p.sy, p.ey, tp) * CELL
      const grad = ctx.createLinearGradient(tx, ty, px, py)
      grad.addColorStop(0, col + '00')
      grad.addColorStop(1, col + '55')
      ctx.strokeStyle = grad
      ctx.lineWidth = r * 1.2
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke()

      const pulse = 0.7 + 0.3 * Math.sin(tick * 0.15 + proj.id)
      ctx.shadowBlur = 12 * pulse
      ctx.shadowColor = col
      ctx.fillStyle = col
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0

      ctx.fillStyle = alpha('white', 0.35)
      ctx.beginPath(); ctx.arc(px - r * 0.25, py - r * 0.25, r * 0.35, 0, Math.PI * 2); ctx.fill()
    }

    if (alive || phaseRef.current === 'won' || phaseRef.current === 'idle') {
      const half = SQUARE_HALF * CELL
      const th = SIDE_PX

      ctx.save()
      ctx.translate(pcx, pcy)
      ctx.rotate(angle)

      ctx.fillStyle = '#0c0c12'
      ctx.fillRect(-half, -half, half * 2, half * 2)

      ctx.strokeStyle = alpha('white', 0.04)
      ctx.lineWidth = 0.5
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(i * CELL, -half); ctx.lineTo(i * CELL, half); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(-half, i * CELL); ctx.lineTo(half, i * CELL); ctx.stroke()
      }

      for (let s = 0; s < 4; s++) {
        const col = SIDE_COLORS[s]
        ctx.shadowBlur = 8
        ctx.shadowColor = col
        ctx.fillStyle = col

        switch (s) {
          case 0: ctx.fillRect(-half, -half, half * 2, th); break
          case 1: ctx.fillRect(half - th, -half, th, half * 2); break
          case 2: ctx.fillRect(-half, half - th, half * 2, th); break
          case 3: ctx.fillRect(-half, -half, th, half * 2); break
        }
        ctx.shadowBlur = 0
      }

      ctx.fillStyle = alpha('white', 0.12)
      const cs = 4
      ctx.fillRect(-half, -half, cs, cs)
      ctx.fillRect(half - cs, -half, cs, cs)
      ctx.fillRect(-half, half - cs, cs, cs)
      ctx.fillRect(half - cs, half - cs, cs, cs)

      const dp = 0.3 + 0.15 * Math.sin(tick * 0.06)
      ctx.fillStyle = alpha('white', dp)
      ctx.beginPath()
      ctx.moveTo(0, -8); ctx.lineTo(8, 0); ctx.lineTo(0, 8); ctx.lineTo(-8, 0)
      ctx.closePath(); ctx.fill()

      ctx.restore()
    }

    for (const imp of impactsRef.current) {
      const age = tick - imp.tick
      if (age > 25) continue
      const fade = 1 - age / 25
      const p = PATHS[imp.dir]
      const ix = OX + p.ex * CELL
      const iy = OY + p.ey * CELL

      if (imp.correct) {
        ctx.shadowBlur = 20 * fade
        ctx.shadowColor = alpha('green', fade)
        ctx.fillStyle = alpha('green', fade * 0.6)
      } else {
        ctx.shadowBlur = 20 * fade
        ctx.shadowColor = alpha('danger', fade)
        ctx.fillStyle = alpha('danger', fade * 0.6)
      }
      ctx.beginPath(); ctx.arc(ix, iy, CELL * 1.5 * fade + CELL, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
    }

    ctx.restore()

    drawBorder(ctx, OX, OY, PW, PH)

    if (alive) {
      ctx.font = 'bold 7px "Noto Sans SC Variable", monospace'
      ctx.textAlign = 'center'
      for (let dir = 0; dir < 4; dir++) {
        const colIdx = sideAtDir(dir, rot)
        const col = SIDE_COLORS[colIdx]
        const p = PATHS[dir]
        ctx.fillStyle = col + '55'
        ctx.fillText('◆', OX + p.sx * CELL, OY + p.sy * CELL + 3)
      }
    }

    drawScanlines(ctx)
  }, [])

  const processArrivals = useCallback(() => {
    const arrived: Projectile[] = []
    const remaining: Projectile[] = []
    for (const p of projsRef.current) {
      if (p.progress >= 1) arrived.push(p); else remaining.push(p)
    }
    projsRef.current = remaining

    for (const p of arrived) {
      const facing = sideAtDir(p.dir, rotationRef.current)
      const correct = facing === p.colorIdx

      impactsRef.current.push({ dir: p.dir, correct, tick: tickRef.current })

      if (correct) {
        blockedRef.current++
        setBlockedCount(blockedRef.current)
      } else {
        livesRef.current--
        setLives(livesRef.current)
        if (livesRef.current <= 0) {
          changePhase('dead'); cancelAnimationFrame(rafRef.current); draw(); return
        }
      }
    }
  }, [draw, changePhase])

  const spawnProjectile = useCallback(() => {
    const baseSpeed = 0.006 * propSpeed
    const progress = Math.min(elapsedRef.current / (timeLimit * 60), 1)
    const ramp = 1 + progress * 0.35
    const speed = baseSpeed * (0.85 + Math.random() * 0.3) * ramp

    const arrival = elapsedRef.current + 1 / Math.max(speed, 0.0001)
    if (arrival < lastArrivalRef.current + MIN_ARRIVAL_GAP) return
    lastArrivalRef.current = arrival

    projsRef.current.push({
      id: ++projIdRef.current,
      dir: Math.floor(Math.random() * 4),
      colorIdx: Math.floor(Math.random() * 4),
      progress: 0,
      speed,
    })
  }, [propSpeed, timeLimit])

  const gameLoop = useCallback((timestamp: number) => {
    if (phaseRef.current !== 'playing') return

    const dt = lastFrameRef.current
      ? Math.min((timestamp - lastFrameRef.current) / 16.667, 3)
      : 1
    lastFrameRef.current = timestamp

    tickRef.current++
    elapsedRef.current += dt

    const targetAngle = rotationRef.current * Math.PI / 2
    const diff = targetAngle - visualAngle.current
    visualAngle.current += diff * Math.min(dt * 0.3, 1)

    for (const p of projsRef.current) p.progress += p.speed * dt

    processArrivals()
    if (phaseRef.current !== 'playing') return

    impactsRef.current = impactsRef.current.filter(i => tickRef.current - i.tick < 30)

    const progress = Math.min(elapsedRef.current / (timeLimit * 60), 1)
    const spawnRamp = 1 + progress * 0.45
    const spawnInterval = Math.max(30, 90 / (propSpawnRate * spawnRamp))
    spawnAccum.current += dt
    if (spawnAccum.current >= spawnInterval) {
      spawnAccum.current -= spawnInterval
      spawnProjectile()
    }

    draw()
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [draw, processArrivals, spawnProjectile, propSpawnRate, timeLimit])

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    tickRef.current = 0
    lastFrameRef.current = 0
    elapsedRef.current = 0
    spawnAccum.current = 0
    projIdRef.current = 0
    lastArrivalRef.current = Number.NEGATIVE_INFINITY
    blockedRef.current = 0
    livesRef.current = propLives
    rotationRef.current = 0
    visualAngle.current = 0
    projsRef.current = []
    impactsRef.current = []
    setBlockedCount(0)
    setLives(propLives)
    setTimeLeft(timeLimit)
    changePhase('playing')
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [gameLoop, propLives, timeLimit, changePhase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current === 'idle' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); startGame(); return
      }
      if (phaseRef.current !== 'playing') return

      const now = Date.now()
      if (now - lastRotRef.current < ROT_CD) return

      const dr = e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'e' || e.key === 'E' ? 1
               : e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'q' || e.key === 'Q' ? -1 : 0
      if (dr === 0) return

      e.preventDefault(); e.stopPropagation()
      lastRotRef.current = now
      rotationRef.current += dr
    }
    window.addEventListener('keydown', gated(onKey), { capture: true })
    return () => window.removeEventListener('keydown', gated(onKey), { capture: true })
  }, [startGame])

  useEffect(() => {
    if (phase !== 'playing') return
    const iv = setInterval(() => {
      survivedRef.current++
      if (survivedRef.current % SURVIVAL_SLICE_SEC === 0) reportProgress(survivedRef.current / SURVIVAL_SLICE_SEC)
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(iv)
          if (phaseRef.current === 'playing') {
            changePhase('won'); cancelAnimationFrame(rafRef.current)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [phase, changePhase])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [blockedCount])

  useEffect(() => {
    draw()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  const logMilestones = useMemo(() => {
    const m: number[] = []
    for (let i = 3; i <= blockedCount; i += 3) m.push(i)
    return m
  }, [blockedCount])

  return (
    <GameShell
      canvasRef={canvasRef}
      phase={phase}
      failBarDrained={failBarDrained}
      overlay={{
        idleSubtitle: t('minigames.cipher.idle_subtitle'),
        idleDescription: t('minigames.cipher.idle_description', timeLimit),
        controlsHint: t('minigames.cipher.controls_hint'),
        idleExtra: (
          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            {SIDE_COLORS.map((c, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c, boxShadow: `0 0 6px ${c}66` }} />
            ))}
          </div>
        ),
        deadTitle: t('minigames.cipher.dead_title'),
        deadDescription: t('minigames.cipher.dead_description'),
        wonTitle: t('minigames.cipher.won_title'),
        wonDescription: t('minigames.cipher.won_description', blockedCount),
      }}
      hudContent={<>
        <TimerDisplay timeLeft={timeLeft} />
        {propLives > 1 && (
          <LivesDots total={propLives} current={lives} />
        )}
        <span style={{ fontSize: 10, color: alpha('fog', 0.35) }}>
          {t('minigames.cipher.hud_blocked', blockedCount)}
        </span>
        <div style={{ width: 120, height: 8, borderRadius: 2, background: alpha('white', 0.07), overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${Math.max(0, ((timeLimit - timeLeft) / timeLimit) * 100)}%`,
            background: timeLeft <= 3 ? palette.green : palette.dim,
            boxShadow: timeLeft <= 3 ? `0 0 6px ${alpha('green', 0.6)}` : 'none',
            transition: 'width 1s linear, background 0.3s',
          }} />
        </div>
      </>}
      logTitle={t('minigames.cipher.log_title')}
      logRef={logRef}
      logStatusContent={phase === 'playing'
        ? t('minigames.cipher.log_status', Math.round(((timeLimit - timeLeft) / timeLimit) * 100))
        : undefined}
      logContent={<>
        {phase === 'idle' && IDLE_LOG_LINES.map((line, i) => (
          <div key={`idle-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '5px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
          }}>
            <span style={{ fontSize: 10, color: alpha('fog', 0.35), letterSpacing: '0.04em' }}>{t(line)}</span>
          </div>
        ))}

        {phase !== 'idle' && (<>
          {logMilestones.map((milestone, i) => (
            <div key={`m-${milestone}`} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '5px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                color: palette.green, minWidth: 54, flexShrink: 0 }}>
                ×{String(milestone).padStart(3, '0')}
              </span>
              <span style={{ flex: 1, fontSize: 10, letterSpacing: '0.04em',
                color: alpha('fog', 0.65),
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t(BLOCK_MESSAGES[i % BLOCK_MESSAGES.length])}
              </span>
              <div style={{ width: 100, height: 4, background: alpha('white', 0.07), borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: '100%', height: '100%', borderRadius: 3, background: palette.green, boxShadow: `0 0 4px ${alpha('green', 0.5)}` }} />
              </div>
              <span style={{ fontSize: 9, letterSpacing: '0.06em', flexShrink: 0, minWidth: 38, textAlign: 'right', color: palette.green }}>
                {t('minigames.cipher.log_done')} ✓
              </span>
            </div>
          ))}

          {phase === 'playing' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '5px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
              opacity: 0.85,
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                color: palette.dim, minWidth: 54, flexShrink: 0 }}>
                {t('minigames.cipher.log_live')}
              </span>
              <span style={{ flex: 1, fontSize: 10, letterSpacing: '0.04em', color: alpha('fog', 0.45) }}>
                {t('minigames.cipher.log_playing', blockedCount)}
              </span>
              <div style={{ width: 100, height: 4, background: alpha('white', 0.07), borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{
                  width: `${Math.min(100, (blockedCount % 3) * 33)}%`, height: '100%', borderRadius: 3,
                  background: palette.dim, transition: 'width 0.3s ease',
                }} />
              </div>
              <span style={{ fontSize: 9, letterSpacing: '0.06em', flexShrink: 0, minWidth: 38, textAlign: 'right', color: alpha('dim', 0.6) }}>
                {t('minigames.cipher.log_pending')}
              </span>
            </div>
          )}

          {phase === 'won' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '5px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: palette.green, minWidth: 54, flexShrink: 0 }}>{t('minigames.cipher.log_cipher_badge')}</span>
              <span style={{ flex: 1, fontSize: 10, color: alpha('fog', 0.65), letterSpacing: '0.04em' }}>
                {t('minigames.cipher.log_complete')}
              </span>
              <div style={{ width: 100, height: 4, background: alpha('white', 0.07), borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: '100%', height: '100%', background: palette.green, borderRadius: 3, boxShadow: `0 0 4px ${alpha('green', 0.5)}` }} />
              </div>
              <span style={{ fontSize: 9, letterSpacing: '0.06em', flexShrink: 0, minWidth: 38, textAlign: 'right', color: palette.green }}>{t('minigames.cipher.log_done')} ✓</span>
            </div>
          )}
        </>)}
      </>}
    />
  )
}
