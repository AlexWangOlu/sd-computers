import { useState, useEffect, useRef, useCallback } from 'react'
import { gated } from '../core/inputGate'
import { OX, OY, PW, PH } from '../core/constants'
import type { BaseGameProps } from '../core/types'
import { useGameLifecycle } from '../core/useGameLifecycle'
import { useEventLog } from '../core/useEventLog'
import { EventLog } from '../core/EventLog'
import { drawVoid, drawPlayArea, drawBorder, drawScanlines } from '../core/canvasUtils'
import GameShell from '../core/GameShell'
import { LivesDots, TimerDisplay, ProgressPips } from '../core/HudElements'
import { t } from '@/i18n'
import { palette, alpha } from '@/theme/palette'
import { generatePuzzle, floodFill, rotateCW, hasConn, TOP, RIGHT, BOTTOM, LEFT, type PipeCell } from '../helpers/pipeLogic'

interface PipeGameProps extends BaseGameProps {
  gridWidth?: number
  gridHeight?: number
  timeLimit?: number
  rounds?: number
  playerLives?: number
  challenge?: unknown
}

export default function PipeGame({
  onWin, onFail, onProgress,
  gridWidth: propW = 7,
  gridHeight: propH = 5,
  timeLimit: propTime = 30,
  rounds: propRounds = 1,
  playerLives: propLives = 2,
  challenge,
}: PipeGameProps) {

  const gw = Math.max(5, Math.min(10, propW))
  const gh = Math.max(4, Math.min(8, propH))
  const roundTime = Math.max(10, propTime)
  const totalRounds = Math.max(1, Math.min(5, propRounds))
  const chal = challenge as { boards?: Array<{ grid: PipeCell[][]; sourceY: number; sinkY: number }> } | null | undefined

  const cellPx = Math.floor(Math.min((PW - 80) / gw, (PH - 60) / gh))
  const gridPxW = cellPx * gw
  const gridPxH = cellPx * gh
  const gridOX = OX + Math.floor((PW - gridPxW) / 2)
  const gridOY = OY + Math.floor((PH - gridPxH) / 2) + 8

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { phase, changePhase, phaseRef, failBarDrained, reportProgress } = useGameLifecycle(onWin, onFail, onProgress)

  const [lives, setLives] = useState(propLives)
  const [roundNum, setRoundNum] = useState(0)
  const [timeLeft, setTimeLeft] = useState(roundTime)
  const { entries: eventLog, addEvent, reset: resetLog, logRef } = useEventLog<'rotate' | 'solve' | 'fail' | 'sys'>(40)

  const rafRef = useRef<number>(0)
  const tickRef = useRef(0)
  const gridRef = useRef<PipeCell[][]>([])
  const sourceYRef = useRef(0)
  const sinkYRef = useRef(0)
  const cursorRef = useRef({ x: 0, y: 0 })
  const connectedRef = useRef(new Set<string>())
  const livesRef = useRef(propLives)
  const roundRef = useRef(0)
  const roundStartRef = useRef(0)
  const rotCountRef = useRef(0)

  const startRound = useCallback((timestamp: number) => {
    const puzzle = chal?.boards?.[roundRef.current] ?? generatePuzzle(gw, gh)
    gridRef.current = puzzle.grid
    sourceYRef.current = puzzle.sourceY
    sinkYRef.current = puzzle.sinkY
    cursorRef.current = { x: 0, y: puzzle.sourceY }
    connectedRef.current = floodFill(puzzle.grid, puzzle.sourceY)
    rotCountRef.current = 0
    roundStartRef.current = timestamp
    setTimeLeft(roundTime)
  }, [gw, gh, roundTime])

  const checkSolved = useCallback(() => {
    const grid = gridRef.current
    const connected = floodFill(grid, sourceYRef.current)
    connectedRef.current = connected
    const sinkKey = `${gw - 1},${sinkYRef.current}`
    return connected.has(sinkKey) && hasConn(grid[sinkYRef.current][gw - 1].connections, RIGHT)
  }, [gw])

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const tick = tickRef.current
    const grid = gridRef.current
    const connected = connectedRef.current
    const cur = cursorRef.current

    drawVoid(ctx)
    drawPlayArea(ctx, OX, OY, PW, PH)

    ctx.save(); ctx.beginPath(); ctx.rect(OX, OY, PW, PH); ctx.clip()

    if (grid.length > 0 && phaseRef.current === 'playing') {
      const elapsed = timestamp - roundStartRef.current
      const remaining = Math.max(0, 1 - elapsed / (roundTime * 1000))
      const barX = gridOX, barY = gridOY - 14, barW = gridPxW, barH = 4
      ctx.fillStyle = alpha('white', 0.06); ctx.fillRect(barX, barY, barW, barH)
      ctx.fillStyle = remaining < 0.25 ? palette.danger : remaining < 0.5 ? palette.warnBright : palette.green
      ctx.fillRect(barX, barY, barW * remaining, barH)

      const srcPy = gridOY + sourceYRef.current * cellPx + cellPx / 2
      const snkPy = gridOY + sinkYRef.current * cellPx + cellPx / 2

      ctx.shadowBlur = 8; ctx.shadowColor = palette.green
      ctx.fillStyle = palette.green; ctx.font = '700 10px "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Noto Sans SC Variable", monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText(t('minigames.pipe.canvas_in'), gridOX - 6, srcPy); ctx.shadowBlur = 0

      ctx.shadowBlur = 8; ctx.shadowColor = palette.warn
      ctx.fillStyle = palette.warn; ctx.font = '700 10px "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Noto Sans SC Variable", monospace'; ctx.textAlign = 'left'
      ctx.fillText(t('minigames.pipe.canvas_out'), gridOX + gridPxW + 6, snkPy); ctx.shadowBlur = 0

      for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) {
          const cell = grid[gy][gx]
          const px = gridOX + gx * cellPx
          const py = gridOY + gy * cellPx
          const cx = px + cellPx / 2
          const cy = py + cellPx / 2
          const isConn = connected.has(`${gx},${gy}`)
          const isCur = gx === cur.x && gy === cur.y

          ctx.fillStyle = isConn ? alpha('green', 0.06) : alpha('white', 0.015)
          ctx.fillRect(px, py, cellPx, cellPx)

          ctx.strokeStyle = isCur ? alpha('green', 0.5) : alpha('white', 0.06)
          ctx.lineWidth = isCur ? 2 : 0.5
          ctx.strokeRect(px + 0.5, py + 0.5, cellPx - 1, cellPx - 1)

          const pipeCol = isConn ? palette.green : alpha('white', 0.18)
          ctx.strokeStyle = pipeCol
          ctx.lineWidth = isConn ? 3 : 2
          ctx.lineCap = 'round'

          if (cell.connections !== 0) {
            ctx.fillStyle = pipeCol
            ctx.beginPath(); ctx.arc(cx, cy, isConn ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill()
          }

          if (hasConn(cell.connections, TOP)) {
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, py); ctx.stroke()
          }
          if (hasConn(cell.connections, RIGHT)) {
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px + cellPx, cy); ctx.stroke()
          }
          if (hasConn(cell.connections, BOTTOM)) {
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, py + cellPx); ctx.stroke()
          }
          if (hasConn(cell.connections, LEFT)) {
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, cy); ctx.stroke()
          }

          if (cell.isSource && isConn) {
            ctx.shadowBlur = 6; ctx.shadowColor = palette.green
            ctx.fillStyle = palette.green
            ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill()
            ctx.shadowBlur = 0
          }
          if (cell.isSink && isConn) {
            ctx.shadowBlur = 6; ctx.shadowColor = palette.warn
            ctx.fillStyle = palette.warn
            ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill()
            ctx.shadowBlur = 0
          }
        }
      }

      const curPx = gridOX + cur.x * cellPx + cellPx / 2
      const curPy = gridOY + cur.y * cellPx + cellPx / 2
      const pulse = 0.3 + 0.3 * Math.sin(tick * 0.1)
      ctx.strokeStyle = `${alpha('green', 0.4 + pulse)}`; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(curPx, curPy, cellPx / 2 - 2, 0, Math.PI * 2); ctx.stroke()

      ctx.fillStyle = alpha('fog', 0.2); ctx.font = '7px "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Noto Sans SC Variable", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
      ctx.fillText(t('minigames.pipe.canvas_controls'), OX + PW / 2, gridOY + gridPxH + 14)
    }

    ctx.restore()

    drawBorder(ctx, OX, OY, PW, PH)
    drawScanlines(ctx)
  }, [gw, gh, cellPx, gridOX, gridOY, gridPxW, gridPxH, roundTime, phaseRef])

  const rotateCell = useCallback(() => {
    const { x, y } = cursorRef.current
    const grid = gridRef.current
    grid[y][x].connections = rotateCW(grid[y][x].connections)
    connectedRef.current = floodFill(grid, sourceYRef.current)
    rotCountRef.current++

    if (rotCountRef.current % 3 === 0) {
      addEvent(t('minigames.pipe.event_rotate', x, y, connectedRef.current.size, gw * gh), 'rotate')
    }

    if (checkSolved()) {
      roundRef.current++
      setRoundNum(roundRef.current)
      reportProgress(roundRef.current, gridRef.current.flatMap(row => row.map(c => c.connections)))
      addEvent(t('minigames.pipe.event_round_solved', roundRef.current, totalRounds, rotCountRef.current), 'solve')

      if (roundRef.current >= totalRounds) {
        addEvent(t('minigames.pipe.event_all_connected'), 'solve')
        changePhase('won'); cancelAnimationFrame(rafRef.current)
      } else {
        startRound(performance.now())
        addEvent(t('minigames.pipe.event_new_pipeline', roundRef.current + 1), 'sys')
      }
    }
  }, [gw, gh, totalRounds, checkSolved, startRound, addEvent, changePhase])

  const gameLoop = useCallback((timestamp: number) => {
    if (phaseRef.current !== 'playing') return
    tickRef.current++

    const elapsed = timestamp - roundStartRef.current
    const secsLeft = Math.max(0, roundTime - elapsed / 1000)
    setTimeLeft(Math.ceil(secsLeft))

    if (secsLeft <= 0) {
      livesRef.current--; setLives(livesRef.current)
      addEvent(t('minigames.pipe.event_timeout', livesRef.current), 'fail')
      if (livesRef.current <= 0) { changePhase('dead'); cancelAnimationFrame(rafRef.current); draw(timestamp); return }
      startRound(timestamp)
    }

    draw(timestamp)
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [draw, roundTime, startRound, addEvent, changePhase, phaseRef])

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    tickRef.current = 0; livesRef.current = propLives; roundRef.current = 0
    setLives(propLives); setRoundNum(0); resetLog()
    addEvent(totalRounds > 1
      ? t('minigames.pipe.event_init_plural', gw, gh, totalRounds, roundTime)
      : t('minigames.pipe.event_init', gw, gh, roundTime), 'sys')
    changePhase('playing')
    startRound(performance.now())
    addEvent(t('minigames.pipe.event_round_one'), 'sys')
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [gameLoop, propLives, gw, gh, totalRounds, roundTime, startRound, addEvent, changePhase, resetLog])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (phaseRef.current === 'idle' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startGame(); return }
      if (phaseRef.current !== 'playing') return
      e.preventDefault(); e.stopPropagation()

      const c = cursorRef.current
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') c.x = Math.max(0, c.x - 1)
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') c.x = Math.min(gw - 1, c.x + 1)
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') c.y = Math.max(0, c.y - 1)
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') c.y = Math.min(gh - 1, c.y + 1)
      else if (e.key === ' ' || e.key === 'Enter') rotateCell()
    }
    window.addEventListener('keydown', gated(onKey), { capture: true })
    return () => window.removeEventListener('keydown', gated(onKey), { capture: true })
  }, [startGame, gw, gh, rotateCell, phaseRef])

  useEffect(() => { draw(performance.now()); return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) } }, [draw])

  return (
    <GameShell
      canvasRef={canvasRef}
      phase={phase}
      failBarDrained={failBarDrained}
      overlay={{
        idleSubtitle: t('minigames.pipe.idle_subtitle', gw, gh),
        idleDescription: <>
          {t('minigames.pipe.idle_description', roundTime)}
          {totalRounds > 1 ? t('minigames.pipe.idle_description_rounds', totalRounds) : ''}
        </>,
        controlsHint: t('minigames.pipe.controls_hint'),
        deadTitle: t('minigames.pipe.dead_title'),
        deadDescription: t('minigames.pipe.dead_description'),
        wonTitle: t('minigames.pipe.won_title'),
        wonDescription: <>{totalRounds > 1 ? t('minigames.pipe.won_description_plural', totalRounds) : t('minigames.pipe.won_description')}</>,
      }}
      hudContent={<>
        <TimerDisplay timeLeft={timeLeft} />
        {totalRounds > 1 && <span style={{ fontSize: 10, fontWeight: 700, color: alpha('green', 0.7) }}>{t('minigames.pipe.hud_round', roundNum + 1, totalRounds)}</span>}
        <LivesDots total={propLives} current={lives} />
        {totalRounds > 1 && <ProgressPips total={totalRounds} current={roundNum} phase={phase} />}
      </>}
      logTitle={t('minigames.pipe.log_title')}
      logRef={logRef}
      logContent={<>
        {phase === 'idle' && [
          t('minigames.pipe.log_idle_module_loaded'),
          t('minigames.pipe.log_idle_scanning'),
          t('minigames.pipe.log_idle_flow'),
          t('minigames.pipe.log_idle_awaiting'),
        ].map((line, i) => (
          <div key={`idle-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}` }}>
            <span style={{ fontSize: 10, color: alpha('fog', 0.35) }}>{line}</span>
          </div>
        ))}
        <EventLog entries={eventLog} badgeMinWidth={36} styles={{
          solve: { label: t('minigames.pipe.badge_done'), color: palette.green },
          fail: { label: t('minigames.pipe.badge_fail'), color: palette.danger, msg: alpha('danger', 0.65) },
          rotate: { label: t('minigames.pipe.badge_rot'), color: palette.dim },
          sys: { label: t('minigames.pipe.badge_sys'), color: palette.warn },
        }} />
        {phase === 'won' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}` }}>
            <span style={{ fontSize: 8, fontWeight: 700, color: palette.green, minWidth: 36, flexShrink: 0 }}>{t('minigames.pipe.badge_done')}</span>
            <span style={{ fontSize: 9, color: alpha('fog', 0.6) }}>{t('minigames.pipe.log_complete')}</span>
          </div>
        )}
      </>}
    />
  )
}
