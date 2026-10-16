import { useState, useEffect, useRef, useCallback } from 'react'
import { gated } from '../core/inputGate'
import { PLAY_COLS, PLAY_ROWS, PW, PH, OX, OY } from '../core/constants'
import type { BaseGameProps } from '../core/types'
import { useGameLifecycle } from '../core/useGameLifecycle'
import { useEventLog } from '../core/useEventLog'
import { EventLog } from '../core/EventLog'
import { drawVoid, drawPlayArea, drawPlayGrid, drawBorder, drawScanlines } from '../core/canvasUtils'
import GameShell from '../core/GameShell'
import { LivesDots, TimerDisplay } from '../core/HudElements'
import { t } from '@/i18n'
import { palette, alpha } from '@/theme/palette'

const PADDLE_H = 10
const PADDLE_Y = PH - 28
const BALL_R = 5
const BRICK_H = 14
const BRICK_GAP = 3
const BRICK_TOP = 40
const BASE_BALL_SPD = 280

const ROW_COLORS = [
  palette.alert, '#ff0066', '#bf00ff', '#8855ff',
  palette.accent, '#00ff88', '#aaff00', palette.warn,
]

interface Brick {
  x: number
  y: number
  w: number
  alive: boolean
  row: number
  col: number
}

interface BreakoutGameProps extends BaseGameProps {
  rows?: number
  cols?: number
  ballSpeed?: number
  paddleWidth?: number
  timeLimit?: number
  playerLives?: number
}

export default function BreakoutGame({
  onWin, onFail, onProgress,
  rows: propRows = 4,
  cols: propCols = 10,
  ballSpeed: propSpeed = 1.0,
  paddleWidth: propPaddleW = 100,
  timeLimit: propTime = 0,
  playerLives: propLives = 3,
}: BreakoutGameProps) {

  const numRows = Math.max(2, Math.min(8, propRows))
  const numCols = Math.max(4, Math.min(16, propCols))
  const paddleW = Math.max(60, Math.min(200, propPaddleW))
  const timeLimit = propTime > 0 ? propTime : 0

  const brickW = Math.floor((PW - BRICK_GAP * (numCols + 1)) / numCols)
  const totalBricks = numRows * numCols

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { phase, changePhase, phaseRef, failBarDrained, reportProgress } = useGameLifecycle(onWin, onFail, onProgress)

  const [lives, setLives] = useState(propLives)
  const [destroyed, setDestroyed] = useState(0)
  const [timeLeft, setTimeLeft] = useState(timeLimit)
  const { entries: eventLog, addEvent, reset: resetLog, logRef } = useEventLog<'hit' | 'lose' | 'clear' | 'sys'>(40)

  const rafRef = useRef<number>(0)
  const tickRef = useRef(0)
  const lastFrameRef = useRef(0)
  const paddleXRef = useRef(PW / 2)
  const ballRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 })
  const bricksRef = useRef<Brick[]>([])
  const livesRef = useRef(propLives)
  const destroyedRef = useRef(0)
  const keysRef = useRef({ left: false, right: false })
  const elapsedRef = useRef(0)
  const ballLaunchedRef = useRef(false)

  const initBricks = useCallback(() => {
    const bricks: Brick[] = []
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        bricks.push({
          x: BRICK_GAP + c * (brickW + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          w: brickW,
          alive: true,
          row: r,
          col: c,
        })
      }
    }
    return bricks
  }, [numRows, numCols, brickW])

  const resetBall = useCallback(() => {
    ballRef.current = {
      x: paddleXRef.current,
      y: PADDLE_Y - BALL_R - 1,
      vx: 0,
      vy: 0,
    }
    ballLaunchedRef.current = false
  }, [])

  const launchBall = useCallback(() => {
    if (ballLaunchedRef.current) return
    ballLaunchedRef.current = true
    const speed = BASE_BALL_SPD * propSpeed
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6
    ballRef.current.vx = Math.cos(angle) * speed
    ballRef.current.vy = Math.sin(angle) * speed
  }, [propSpeed])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const tick = tickRef.current

    drawVoid(ctx)
    drawPlayArea(ctx, OX, OY, PW, PH)
    drawPlayGrid(ctx, OX, OY, PLAY_COLS, PLAY_ROWS)

    ctx.save()
    ctx.beginPath(); ctx.rect(OX, OY, PW, PH); ctx.clip()

    for (const b of bricksRef.current) {
      if (!b.alive) continue
      const bx = OX + b.x
      const by = OY + b.y
      const col = ROW_COLORS[b.row % ROW_COLORS.length]
      const rad = 3

      ctx.shadowBlur = 4
      ctx.shadowColor = col
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.moveTo(bx + rad, by)
      ctx.lineTo(bx + b.w - rad, by); ctx.quadraticCurveTo(bx + b.w, by, bx + b.w, by + rad)
      ctx.lineTo(bx + b.w, by + BRICK_H - rad); ctx.quadraticCurveTo(bx + b.w, by + BRICK_H, bx + b.w - rad, by + BRICK_H)
      ctx.lineTo(bx + rad, by + BRICK_H); ctx.quadraticCurveTo(bx, by + BRICK_H, bx, by + BRICK_H - rad)
      ctx.lineTo(bx, by + rad); ctx.quadraticCurveTo(bx, by, bx + rad, by)
      ctx.closePath(); ctx.fill()
      ctx.shadowBlur = 0

      ctx.fillStyle = alpha('white', 0.15)
      ctx.fillRect(bx + 3, by + 2, b.w - 6, 3)
    }

    const px = OX + paddleXRef.current - paddleW / 2
    const py = OY + PADDLE_Y
    const pulse = 0.5 + 0.5 * Math.sin(tick * 0.1)

    ctx.shadowBlur = 8 + 4 * pulse
    ctx.shadowColor = `${alpha('green', 0.4 + 0.2 * pulse)}`
    ctx.fillStyle = palette.green

    const pRad = 4
    ctx.beginPath()
    ctx.moveTo(px + pRad, py)
    ctx.lineTo(px + paddleW - pRad, py); ctx.quadraticCurveTo(px + paddleW, py, px + paddleW, py + pRad)
    ctx.lineTo(px + paddleW, py + PADDLE_H - pRad); ctx.quadraticCurveTo(px + paddleW, py + PADDLE_H, px + paddleW - pRad, py + PADDLE_H)
    ctx.lineTo(px + pRad, py + PADDLE_H); ctx.quadraticCurveTo(px, py + PADDLE_H, px, py + PADDLE_H - pRad)
    ctx.lineTo(px, py + pRad); ctx.quadraticCurveTo(px, py, px + pRad, py)
    ctx.closePath(); ctx.fill()
    ctx.shadowBlur = 0

    ctx.fillStyle = 'rgba(7,10,14,0.6)'
    ctx.fillRect(px + paddleW / 2 - 1, py + 2, 2, PADDLE_H - 4)

    const ball = ballRef.current
    const bxp = OX + ball.x
    const byp = OY + ball.y

    ctx.shadowBlur = 10
    ctx.shadowColor = palette.green
    ctx.fillStyle = '#d4ff9e'
    ctx.beginPath(); ctx.arc(bxp, byp, BALL_R, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0

    if (ballLaunchedRef.current) {
      const trailLen = 12
      const nx = ball.vx === 0 && ball.vy === 0 ? 0 : ball.vx / Math.hypot(ball.vx, ball.vy)
      const ny = ball.vx === 0 && ball.vy === 0 ? 0 : ball.vy / Math.hypot(ball.vx, ball.vy)
      const grad = ctx.createLinearGradient(bxp + nx * trailLen, byp + ny * trailLen, bxp, byp)
      grad.addColorStop(0, alpha('green', 0))
      grad.addColorStop(1, alpha('green', 0.3))
      ctx.strokeStyle = grad
      ctx.lineWidth = BALL_R * 1.2
      ctx.beginPath()
      ctx.moveTo(bxp + nx * trailLen, byp + ny * trailLen)
      ctx.lineTo(bxp, byp)
      ctx.stroke()
    }

    if (!ballLaunchedRef.current && phaseRef.current === 'playing') {
      const hPulse = 0.3 + 0.2 * Math.sin(tick * 0.08)
      ctx.fillStyle = `${alpha('green', hPulse)}`
      ctx.font = '700 9px "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Noto Sans SC Variable", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(t('minigames.breakout.canvas_launch_hint'), OX + PW / 2, OY + PADDLE_Y - 24)
      ctx.textAlign = 'start'
    }

    ctx.restore()

    drawBorder(ctx, OX, OY, PW, PH)
    drawScanlines(ctx)
  }, [paddleW, phaseRef])

  const gameLoop = useCallback((timestamp: number) => {
    if (phaseRef.current !== 'playing') return

    const dt = lastFrameRef.current
      ? Math.min((timestamp - lastFrameRef.current) / 16.667, 3)
      : 1
    lastFrameRef.current = timestamp
    const dtSec = dt / 60
    tickRef.current++
    elapsedRef.current += dt

    const PADDLE_SPD = 450
    const keys = keysRef.current
    if (keys.left) paddleXRef.current -= PADDLE_SPD * dtSec
    if (keys.right) paddleXRef.current += PADDLE_SPD * dtSec
    paddleXRef.current = Math.max(paddleW / 2, Math.min(PW - paddleW / 2, paddleXRef.current))

    if (!ballLaunchedRef.current) {
      ballRef.current.x = paddleXRef.current
      ballRef.current.y = PADDLE_Y - BALL_R - 1
    }

    const ball = ballRef.current
    if (ballLaunchedRef.current) {
      const ramp = 1 + Math.min(elapsedRef.current / (60 * 60), 1) * 0.15
      const spdMul = ramp

      ball.x += ball.vx * spdMul * dtSec
      ball.y += ball.vy * spdMul * dtSec

      if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx) }
      if (ball.x + BALL_R > PW) { ball.x = PW - BALL_R; ball.vx = -Math.abs(ball.vx) }
      if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy) }

      if (ball.y > PH + BALL_R) {
        livesRef.current--
        setLives(livesRef.current)
        addEvent(t('minigames.breakout.event_probe_lost', livesRef.current), 'lose')
        if (livesRef.current <= 0) {
          changePhase('dead'); cancelAnimationFrame(rafRef.current); draw(); return
        }
        resetBall()
      }

      const padLeft = paddleXRef.current - paddleW / 2
      const padRight = paddleXRef.current + paddleW / 2
      if (ball.vy > 0 &&
          ball.y + BALL_R >= PADDLE_Y &&
          ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 4 &&
          ball.x >= padLeft && ball.x <= padRight
      ) {
        ball.y = PADDLE_Y - BALL_R
        const hitPos = (ball.x - paddleXRef.current) / (paddleW / 2)
        const angle = hitPos * (Math.PI / 3)
        const speed = Math.hypot(ball.vx, ball.vy)
        ball.vx = Math.sin(angle) * speed
        ball.vy = -Math.cos(angle) * speed
      }

      for (const b of bricksRef.current) {
        if (!b.alive) continue
        const closestX = Math.max(b.x, Math.min(ball.x, b.x + b.w))
        const closestY = Math.max(b.y, Math.min(ball.y, b.y + BRICK_H))
        const dx = ball.x - closestX
        const dy = ball.y - closestY
        if (dx * dx + dy * dy < BALL_R * BALL_R) {
          b.alive = false
          destroyedRef.current++
          setDestroyed(destroyedRef.current)
          reportProgress(destroyedRef.current)

          addEvent(t('minigames.breakout.event_layer_breached', b.row, b.col, destroyedRef.current, totalBricks), 'hit')

          if (Math.abs(dx) > Math.abs(dy)) {
            ball.vx = -ball.vx
          } else {
            ball.vy = -ball.vy
          }

          if (destroyedRef.current >= totalBricks) {
            addEvent(t('minigames.breakout.event_all_shattered'), 'clear')
            changePhase('won'); cancelAnimationFrame(rafRef.current); draw(); return
          }
          break
        }
      }
    }

    draw()
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [draw, paddleW, totalBricks, resetBall, addEvent, changePhase, phaseRef])

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    tickRef.current = 0
    lastFrameRef.current = 0
    elapsedRef.current = 0
    livesRef.current = propLives
    destroyedRef.current = 0
    paddleXRef.current = PW / 2
    bricksRef.current = initBricks()
    keysRef.current = { left: false, right: false }

    resetBall()
    setDestroyed(0)
    setLives(propLives)
    setTimeLeft(timeLimit)
    resetLog()
    addEvent(t('minigames.breakout.event_ice_detected', totalBricks, numRows, numCols, propLives), 'sys')
    changePhase('playing')
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [gameLoop, propLives, totalBricks, numRows, numCols, timeLimit, initBricks, resetBall, addEvent, resetLog, changePhase])

  useEffect(() => {
    const isDir = (key: string) => {
      switch (key) {
        case 'ArrowLeft': case 'a': case 'A': return 'left'
        case 'ArrowRight': case 'd': case 'D': return 'right'
        default: return null
      }
    }

    const onDown = (e: KeyboardEvent) => {
      if (phaseRef.current === 'idle' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); startGame(); return
      }
      if (phaseRef.current !== 'playing') return

      const dir = isDir(e.key)
      if (dir) {
        e.preventDefault(); e.stopPropagation()
        keysRef.current[dir] = true
        return
      }
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault(); e.stopPropagation()
        launchBall()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      const dir = isDir(e.key)
      if (dir) keysRef.current[dir] = false
    }
    const onBlur = () => {
      keysRef.current = { left: false, right: false }
    }

    window.addEventListener('keydown', gated(onDown), { capture: true })
    window.addEventListener('keyup', gated(onUp), { capture: true })
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', gated(onDown), { capture: true })
      window.removeEventListener('keyup', gated(onUp), { capture: true })
      window.removeEventListener('blur', onBlur)
    }
  }, [startGame, launchBall, phaseRef])

  useEffect(() => {
    if (phase !== 'playing' || timeLimit <= 0) return
    const iv = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(iv)
          if (phaseRef.current === 'playing') {
            changePhase('dead'); cancelAnimationFrame(rafRef.current)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [phase, timeLimit, changePhase, phaseRef])

  useEffect(() => {
    draw()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  return (
    <GameShell
      canvasRef={canvasRef}
      phase={phase}
      failBarDrained={failBarDrained}
      overlay={{
        idleSubtitle: t('minigames.breakout.idle_subtitle', numRows, numCols),
        idleDescription: <>
          {t('minigames.breakout.idle_description', totalBricks, propLives)}
          {timeLimit > 0 ? t('minigames.breakout.idle_description_time_limit', timeLimit) : ''}
        </>,
        controlsHint: t('minigames.breakout.controls_hint'),
        deadTitle: t('minigames.breakout.dead_title'),
        deadDescription: timeLeft === 0 && timeLimit > 0
          ? t('minigames.breakout.dead_description_time_expired')
          : t('minigames.breakout.dead_description_lost'),
        wonTitle: t('minigames.breakout.won_title'),
        wonDescription: <>{t('minigames.breakout.won_description', totalBricks)}</>,
      }}
      hudContent={<>
        {timeLimit > 0 && <TimerDisplay timeLeft={timeLeft} />}
        <LivesDots total={propLives} current={lives} />
        <span style={{ fontSize: 10, color: alpha('fog', 0.35) }}>
          {destroyed}/{totalBricks}
        </span>
        <div style={{ width: 120, height: 8, borderRadius: 2, background: alpha('white', 0.07), overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${Math.max(0, (destroyed / totalBricks) * 100)}%`,
            background: destroyed >= totalBricks - 2 ? palette.green : palette.dim,
            transition: 'width 0.3s ease, background 0.3s',
          }} />
        </div>
      </>}
      logTitle={t('minigames.breakout.log_title')}
      logRef={logRef}
      logStatusContent={phase === 'playing'
        ? t('minigames.breakout.log_status', destroyed, totalBricks, lives)
        : undefined}
      logContent={<>
        {phase === 'idle' && [
          t('minigames.breakout.log_idle_module_loaded'),
          t('minigames.breakout.log_idle_scanning'),
          t('minigames.breakout.log_idle_calibrated'),
          t('minigames.breakout.log_idle_awaiting'),
        ].map((line, i) => (
          <div key={`idle-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '5px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
          }}>
            <span style={{ fontSize: 10, color: alpha('fog', 0.35), letterSpacing: '0.04em' }}>{line}</span>
          </div>
        ))}

        <EventLog entries={eventLog} badgeMinWidth={36} styles={{
          hit: { label: t('minigames.breakout.badge_hit'), color: palette.green },
          lose: { label: t('minigames.breakout.badge_lost'), color: palette.danger, msg: alpha('danger', 0.65) },
          clear: { label: t('minigames.breakout.badge_done'), color: palette.warn },
          sys: { label: t('minigames.breakout.badge_sys'), color: palette.dim },
        }} />

        {phase === 'won' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
          }}>
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: palette.green, minWidth: 36, flexShrink: 0 }}>{t('minigames.breakout.badge_done')}</span>
            <span style={{ fontSize: 9, color: alpha('fog', 0.6), letterSpacing: '0.04em' }}>
              {t('minigames.breakout.log_complete', totalBricks)}
            </span>
          </div>
        )}
      </>}
    />
  )
}
