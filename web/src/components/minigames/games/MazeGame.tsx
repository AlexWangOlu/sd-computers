import { useState, useEffect, useRef, useCallback } from 'react'
import { gated } from '../core/inputGate'
import { CANVAS_W, CANVAS_H, PW, PH, OX, OY } from '../core/constants'
import type { BaseGameProps } from '../core/types'
import { useGameLifecycle } from '../core/useGameLifecycle'
import { useEventLog } from '../core/useEventLog'
import { EventLog } from '../core/EventLog'
import { drawVoid, drawPlayArea, drawBorder } from '../core/canvasUtils'
import GameShell from '../core/GameShell'
import { TimerDisplay } from '../core/HudElements'
import { t } from '@/i18n'
import { palette, alpha } from '@/theme/palette'
import { generateMaze, placeNodes, type MazeCell } from '../helpers/mazeGen'

const COL_PLAYER = palette.accent
const COL_EXIT_OPEN = palette.green
const COL_EXIT_SHUT = palette.danger
const COL_NODE = palette.warn
const COL_VISITED = alpha('accent', 0.035)

interface MazeGameProps extends BaseGameProps {
  width?: number
  height?: number
  timeLimit?: number
  visibility?: number
  dataNodes?: number
  challenge?: unknown
}

export default function MazeGame({
  onWin, onFail, onProgress,
  width: propW = 21, height: propH = 15,
  timeLimit = 60, visibility = 5, dataNodes: propNodes = 3,
  challenge,
}: MazeGameProps) {
  const mazeW = Math.max(7, Math.min(41, propW))
  const mazeH = Math.max(7, Math.min(27, propH))
  const visRadius = Math.max(2, Math.min(10, visibility))
  const nodeCount = Math.max(0, Math.min(8, propNodes))
  const chal = challenge as { maze?: MazeCell[][]; nodes?: Array<{ r: number; c: number }> } | null | undefined

  const cellPx = Math.floor(Math.min(PW / mazeW, PH / mazeH))
  const mazePixW = mazeW * cellPx
  const mazePixH = mazeH * cellPx
  const mOX = Math.floor((PW - mazePixW) / 2)
  const mOY = Math.floor((PH - mazePixH) / 2)

  const exitR = mazeH - 1, exitC = mazeW - 1

  const { phase, changePhase, phaseRef, failBarDrained, reportProgress } = useGameLifecycle(onWin, onFail, onProgress)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [timeLeft, setTimeLeft] = useState<number | null>(timeLimit > 0 ? timeLimit : null)
  const [nodesCollected, setNodesCollected] = useState(0)
  const { entries: eventLog, addEvent, reset: resetLog, logRef } = useEventLog<'node' | 'sys' | 'warn'>(30)
  const rafRef = useRef<number>(0)
  const lastFrameRef = useRef(0)
  const tickRef = useRef(0)

  const mazeRef = useRef<MazeCell[][]>([])
  const exploredRef = useRef<boolean[][]>([])
  const visitedRef = useRef<boolean[][]>([])
  const playerRef = useRef({ r: 0, c: 0, vr: 0, vc: 0 })
  const nodesRef = useRef<{ r: number; c: number; collected: boolean }[]>([])
  const nodesColRef = useRef(0)
  const exitOpenRef = useRef(false)
  const keysRef = useRef(new Set<string>())
  const moveCdRef = useRef(0)

  const MOVE_CD = 0.12
  const LERP_SPEED = 14

  const draw = useCallback(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')!
    const tick = tickRef.current
    const p = playerRef.current
    const maze = mazeRef.current
    const explored = exploredRef.current
    const visited = visitedRef.current

    drawVoid(ctx)

    drawPlayArea(ctx, OX, OY, PW, PH, palette.fieldBg)

    drawBorder(ctx, OX, OY, PW, PH, 'dim')

    ctx.save()
    ctx.beginPath(); ctx.rect(OX, OY, PW, PH); ctx.clip()

    if (maze.length === 0) { ctx.restore(); return }

    for (let r = 0; r < mazeH; r++) {
      for (let c = 0; c < mazeW; c++) {
        const dist = Math.sqrt((r - p.vr) ** 2 + (c - p.vc) ** 2)
        const inView = dist <= visRadius
        const isExpl = explored[r]?.[c] ?? false

        if (!isExpl && !inView) continue

        let a: number
        if (inView) {
          a = dist < visRadius - 1 ? 1 : Math.max(0.3, 1 - (dist - (visRadius - 1)))
        } else {
          a = 0.18
        }

        const cx = OX + mOX + c * cellPx
        const cy = OY + mOY + r * cellPx

        const isVis = visited[r]?.[c] ?? false
        ctx.fillStyle = isVis ? COL_VISITED : `rgba(14,14,18,${a})`
        ctx.fillRect(cx + 1, cy + 1, cellPx - 2, cellPx - 2)

        if (a > 0.3) {
          ctx.strokeStyle = alpha('dim', 0.04 * a)
          ctx.lineWidth = 0.5
          ctx.strokeRect(cx + 0.5, cy + 0.5, cellPx - 1, cellPx - 1)
        }

        const cell = maze[r][c]
        const wAlpha = a * 0.55
        ctx.strokeStyle = alpha('dim', wAlpha)
        ctx.lineWidth = 2
        if (cell.n) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + cellPx, cy); ctx.stroke() }
        if (cell.s) { ctx.beginPath(); ctx.moveTo(cx, cy + cellPx); ctx.lineTo(cx + cellPx, cy + cellPx); ctx.stroke() }
        if (cell.w) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + cellPx); ctx.stroke() }
        if (cell.e) { ctx.beginPath(); ctx.moveTo(cx + cellPx, cy); ctx.lineTo(cx + cellPx, cy + cellPx); ctx.stroke() }

        if (inView && dist < visRadius * 0.6) {
          const glow = (1 - dist / (visRadius * 0.6)) * 0.3
          ctx.strokeStyle = alpha('dim', glow)
          ctx.lineWidth = 3
          if (cell.n) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + cellPx, cy); ctx.stroke() }
          if (cell.s) { ctx.beginPath(); ctx.moveTo(cx, cy + cellPx); ctx.lineTo(cx + cellPx, cy + cellPx); ctx.stroke() }
          if (cell.w) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + cellPx); ctx.stroke() }
          if (cell.e) { ctx.beginPath(); ctx.moveTo(cx + cellPx, cy); ctx.lineTo(cx + cellPx, cy + cellPx); ctx.stroke() }
        }
      }
    }

    nodesRef.current.forEach((node, idx) => {
      if (node.collected) return
      const dist = Math.sqrt((node.r - p.vr) ** 2 + (node.c - p.vc) ** 2)
      const isExpl = explored[node.r]?.[node.c] ?? false
      if (dist > visRadius && !isExpl) return

      const a = dist <= visRadius ? 1 : 0.22
      const nx = OX + mOX + node.c * cellPx + cellPx / 2
      const ny = OY + mOY + node.r * cellPx + cellPx / 2
      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.08 + idx * 2.1)
      const radius = cellPx * 0.22

      ctx.shadowBlur = 8 * pulse
      ctx.shadowColor = COL_NODE
      ctx.fillStyle = alpha('warn', a * (0.5 + 0.5 * pulse))
      ctx.beginPath(); ctx.arc(nx, ny, radius, 0, Math.PI * 2); ctx.fill()

      ctx.fillStyle = `rgba(255,220,120,${a * 0.7})`
      ctx.beginPath(); ctx.arc(nx, ny, radius * 0.4, 0, Math.PI * 2); ctx.fill()

      ctx.shadowBlur = 0
      ctx.strokeStyle = alpha('warn', a * 0.3)
      ctx.lineWidth = 1
      const angle = tick * 0.04 + idx
      ctx.beginPath()
      ctx.arc(nx, ny, radius + 3, angle, angle + Math.PI * 1.2)
      ctx.stroke()
    })

    {
      const dist = Math.sqrt((exitR - p.vr) ** 2 + (exitC - p.vc) ** 2)
      const isExpl = explored[exitR]?.[exitC] ?? false
      if (dist <= visRadius || isExpl) {
        const a = dist <= visRadius ? 1 : 0.22
        const ex = OX + mOX + exitC * cellPx + cellPx / 2
        const ey = OY + mOY + exitR * cellPx + cellPx / 2
        const open = exitOpenRef.current
        const pulse = open ? 0.6 + 0.4 * Math.sin(tick * 0.1) : 0.3 + 0.2 * Math.sin(tick * 0.06)
        const rad = cellPx * 0.28

        ctx.shadowBlur = open ? 14 * pulse : 6
        ctx.shadowColor = open ? COL_EXIT_OPEN : COL_EXIT_SHUT
        ctx.fillStyle = open
          ? alpha('green', a * pulse)
          : alpha('danger', a * 0.4)

        ctx.beginPath()
        ctx.moveTo(ex, ey - rad); ctx.lineTo(ex + rad, ey)
        ctx.lineTo(ex, ey + rad); ctx.lineTo(ex - rad, ey)
        ctx.closePath(); ctx.fill()
        ctx.shadowBlur = 0

        if (a > 0.25) {
          ctx.fillStyle = open
            ? alpha('green', a * 0.55)
            : alpha('danger', a * 0.35)
          ctx.font = `700 ${Math.max(7, cellPx * 0.26)}px "JetBrains Mono Variable","JetBrains Mono","Fira Code",monospace`
          ctx.textAlign = 'center'
          ctx.fillText(open ? t('minigames.maze.canvas_exit') : t('minigames.maze.canvas_locked'), ex, ey + rad + Math.max(8, cellPx * 0.35))
          ctx.textAlign = 'start'
        }
      }
    }

    {
      const px = OX + mOX + p.vc * cellPx + cellPx / 2
      const py = OY + mOY + p.vr * cellPx + cellPx / 2
      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.1)

      ctx.shadowBlur = 10 + 6 * pulse
      ctx.shadowColor = COL_PLAYER
      ctx.fillStyle = COL_PLAYER
      ctx.beginPath(); ctx.arc(px, py, cellPx * 0.28, 0, Math.PI * 2); ctx.fill()

      ctx.fillStyle = alpha('white', 0.35)
      ctx.beginPath(); ctx.arc(px, py, cellPx * 0.1, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0

      ctx.strokeStyle = alpha('accent', 0.04 + 0.015 * pulse)
      ctx.lineWidth = 1
      ctx.setLineDash([4, 6])
      ctx.beginPath(); ctx.arc(px, py, visRadius * cellPx, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([])
    }

    {
      const mmCellW = Math.max(2, Math.min(3, Math.floor(120 / mazeW)))
      const mmCellH = Math.max(2, Math.min(3, Math.floor(80 / mazeH)))
      const mmW = mazeW * mmCellW
      const mmH = mazeH * mmCellH
      const mmX = OX + PW - mmW - 10
      const mmY = OY + 10

      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4)
      ctx.strokeStyle = alpha('dim', 0.25)
      ctx.lineWidth = 1
      ctx.strokeRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4)

      for (let r = 0; r < mazeH; r++) {
        for (let c = 0; c < mazeW; c++) {
          const isExpl = explored[r]?.[c] ?? false
          if (!isExpl) continue

          const rx = mmX + c * mmCellW
          const ry = mmY + r * mmCellH
          const isVis = visited[r]?.[c] ?? false

          ctx.fillStyle = isVis ? alpha('accent', 0.12) : alpha('dim', 0.08)
          ctx.fillRect(rx, ry, mmCellW, mmCellH)

          const cell = maze[r][c]
          ctx.strokeStyle = alpha('dim', 0.3)
          ctx.lineWidth = 1
          if (cell.n) { ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + mmCellW, ry); ctx.stroke() }
          if (cell.e) { ctx.beginPath(); ctx.moveTo(rx + mmCellW, ry); ctx.lineTo(rx + mmCellW, ry + mmCellH); ctx.stroke() }
          if (cell.s) { ctx.beginPath(); ctx.moveTo(rx, ry + mmCellH); ctx.lineTo(rx + mmCellW, ry + mmCellH); ctx.stroke() }
          if (cell.w) { ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry + mmCellH); ctx.stroke() }
        }
      }

      nodesRef.current.forEach(node => {
        const isExpl = explored[node.r]?.[node.c] ?? false
        if (!isExpl) return
        const nx = mmX + node.c * mmCellW + mmCellW / 2
        const ny = mmY + node.r * mmCellH + mmCellH / 2
        ctx.fillStyle = node.collected ? alpha('green', 0.5) : alpha('warn', 0.7)
        ctx.fillRect(nx - 1, ny - 1, 2, 2)
      })

      {
        const expl = explored[exitR]?.[exitC] ?? false
        if (expl) {
          const ex = mmX + exitC * mmCellW + mmCellW / 2
          const ey = mmY + exitR * mmCellH + mmCellH / 2
          ctx.fillStyle = exitOpenRef.current ? COL_EXIT_OPEN : COL_EXIT_SHUT
          ctx.fillRect(ex - 1, ey - 1, 3, 3)
        }
      }

      {
        const mpx = mmX + p.c * mmCellW + mmCellW / 2
        const mpy = mmY + p.r * mmCellH + mmCellH / 2
        ctx.fillStyle = COL_PLAYER
        ctx.fillRect(mpx - 1, mpy - 1, 3, 3)
      }

      ctx.fillStyle = alpha('dim', 0.3)
      ctx.font = '600 7px "JetBrains Mono Variable","JetBrains Mono","Fira Code",monospace'
      ctx.textAlign = 'right'
      ctx.fillText(t('minigames.maze.canvas_map'), mmX + mmW, mmY - 4)
      ctx.textAlign = 'start'
    }

    ctx.restore()

    ctx.save()
    ctx.globalAlpha = 0.03
    for (let sy = 0; sy < CANVAS_H; sy += 3) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, sy, CANVAS_W, 1)
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }, [mazeW, mazeH, cellPx, mOX, mOY, visRadius, exitR, exitC])

  const gameLoop = useCallback((timestamp: number) => {
    if (phaseRef.current !== 'playing') return

    const dt = lastFrameRef.current
      ? Math.min((timestamp - lastFrameRef.current) / 1000, 0.1)
      : 1 / 60
    lastFrameRef.current = timestamp
    tickRef.current++

    const p = playerRef.current
    const maze = mazeRef.current
    const keys = keysRef.current

    moveCdRef.current = Math.max(0, moveCdRef.current - dt)
    if (moveCdRef.current <= 0) {
      let dr = 0, dc = 0
      if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) dr = -1
      else if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) dr = 1
      else if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) dc = -1
      else if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) dc = 1

      if (dr !== 0 || dc !== 0) {
        const cell = maze[p.r]?.[p.c]
        if (cell) {
          let blocked = false
          if (dr === -1 && cell.n) blocked = true
          if (dr === 1 && cell.s) blocked = true
          if (dc === -1 && cell.w) blocked = true
          if (dc === 1 && cell.e) blocked = true

          const nr = p.r + dr, nc = p.c + dc
          if (nr < 0 || nr >= mazeH || nc < 0 || nc >= mazeW) blocked = true

          if (!blocked) {
            p.r = nr; p.c = nc
            moveCdRef.current = MOVE_CD
            visitedRef.current[nr][nc] = true

            for (const node of nodesRef.current) {
              if (!node.collected && node.r === nr && node.c === nc) {
                node.collected = true
                nodesColRef.current++
                setNodesCollected(nodesColRef.current)
                reportProgress(nodesColRef.current, { r: node.r, c: node.c })
                addEvent(
                  t('minigames.maze.fragment_extracted', nodesColRef.current, nodeCount, nr, nc),
                  'node',
                )
                if (nodesColRef.current >= nodeCount) {
                  exitOpenRef.current = true
                  addEvent(t('minigames.maze.all_fragments_collected'), 'sys')
                }
              }
            }

            if (nr === exitR && nc === exitC && exitOpenRef.current) {
              changePhase('won'); cancelAnimationFrame(rafRef.current); draw(); return
            }
          }
        }
      }
    }

    const lerp = Math.min(1, LERP_SPEED * dt)
    p.vr += (p.r - p.vr) * lerp
    p.vc += (p.c - p.vc) * lerp

    const explored = exploredRef.current
    const rMin = Math.max(0, Math.floor(p.r - visRadius))
    const rMax = Math.min(mazeH - 1, Math.ceil(p.r + visRadius))
    const cMin = Math.max(0, Math.floor(p.c - visRadius))
    const cMax = Math.min(mazeW - 1, Math.ceil(p.c + visRadius))
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        if (Math.sqrt((r - p.r) ** 2 + (c - p.c) ** 2) <= visRadius) {
          explored[r][c] = true
        }
      }
    }

    draw()
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [draw, mazeH, mazeW, visRadius, nodeCount, exitR, exitC, addEvent, changePhase, phaseRef])

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    tickRef.current = 0
    lastFrameRef.current = 0
    nodesColRef.current = 0
    exitOpenRef.current = nodeCount === 0
    moveCdRef.current = 0
    setNodesCollected(0)
    resetLog()

    const maze = chal?.maze ?? generateMaze(mazeW, mazeH)
    mazeRef.current = maze

    const explored: boolean[][] = []
    const vis: boolean[][] = []
    for (let r = 0; r < mazeH; r++) {
      explored[r] = new Array(mazeW).fill(false)
      vis[r] = new Array(mazeW).fill(false)
    }
    exploredRef.current = explored
    visitedRef.current = vis
    vis[0][0] = true

    nodesRef.current = (chal?.nodes ?? placeNodes(maze, mazeW, mazeH, nodeCount)).map(n => ({ ...n, collected: false }))

    playerRef.current = { r: 0, c: 0, vr: 0, vc: 0 }
    keysRef.current.clear()

    if (timeLimit > 0) setTimeLeft(timeLimit)
    else setTimeLeft(null)

    changePhase('playing')
    addEvent(t('minigames.maze.breach_initiated'), 'sys')
    if (nodeCount > 0) addEvent(t('minigames.maze.fragments_required', nodeCount), 'sys')
    else addEvent(t('minigames.maze.no_fragments_needed'), 'sys')
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [gameLoop, mazeW, mazeH, nodeCount, timeLimit, addEvent, resetLog, changePhase])

  useEffect(() => {
    const GAME_KEYS = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','W','a','A','s','S','d','D']
    const onDown = (e: KeyboardEvent) => {
      if (phaseRef.current === 'idle' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); startGame(); return
      }
      if (phaseRef.current !== 'playing') return
      if (GAME_KEYS.includes(e.key)) { e.preventDefault(); e.stopPropagation() }
      keysRef.current.add(e.key)
    }
    const onUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key) }
    window.addEventListener('keydown', gated(onDown), { capture: true })
    window.addEventListener('keyup', gated(onUp), { capture: true })
    return () => {
      window.removeEventListener('keydown', gated(onDown), { capture: true })
      window.removeEventListener('keyup', gated(onUp), { capture: true })
    }
  }, [startGame, phaseRef])

  useEffect(() => {
    if (phase !== 'playing' || !timeLimit || timeLimit <= 0) return
    const iv = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(iv)
          if (phaseRef.current === 'playing') {
            changePhase('dead'); cancelAnimationFrame(rafRef.current)
          }
          return 0
        }
        if (prev === 11) addEvent(t('minigames.maze.warning_10s'), 'warn')
        if (prev === 6) addEvent(t('minigames.maze.critical_5s'), 'warn')
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [phase, timeLimit, addEvent, changePhase, phaseRef])

  useEffect(() => {
    draw()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  const nodesPct = nodeCount > 0 ? Math.round(nodesCollected / nodeCount * 100) : 100

  return (
    <GameShell
      canvasRef={canvasRef}
      phase={phase}
      failBarDrained={failBarDrained}
      overlay={{
        idleSubtitle: t('minigames.maze.idle_subtitle', mazeW, mazeH, visRadius),
        idleDescription: <>
          {t('minigames.maze.idle_description')}
          {nodeCount > 0 ? t('minigames.maze.idle_description_fragments', nodeCount) : ''}
          {timeLimit > 0 ? t('minigames.maze.idle_description_time', timeLimit) : ''}
        </>,
        controlsHint: t('minigames.maze.controls_hint'),
        deadTitle: t('minigames.maze.dead_title'),
        deadDescription: timeLeft === 0
          ? t('minigames.maze.dead_description_timeout')
          : t('minigames.maze.dead_description_lockout'),
        wonTitle: t('minigames.maze.won_title'),
        wonDescription: t('minigames.maze.won_description', nodeCount),
      }}
      hudTitle={t('minigames.maze.hud_title')}
      hudContent={<>
        {}
        <span style={{
          fontSize: 10, letterSpacing: '0.06em',
          color: nodesPct >= 100 ? alpha('green', 0.7) : alpha('warn', 0.6),
        }}>
          {t('minigames.maze.hud_data')} {nodesCollected}/{nodeCount}
        </span>
        <div style={{ width: 50, height: 4, background: alpha('white', 0.07), borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: `${nodesPct}%`, height: '100%', borderRadius: 2, transition: 'width 0.3s ease',
            background: nodesPct >= 100 ? palette.green : palette.warn,
          }} />
        </div>
        {timeLeft !== null && timeLeft >= 0 && (
          <TimerDisplay timeLeft={timeLeft} />
        )}
        <span style={{ fontSize: 10, color: alpha('fog', 0.3), letterSpacing: '0.06em' }}>
          {mazeW}x{mazeH}
        </span>
      </>}
      logTitle={t('minigames.maze.log_title')}
      logRef={logRef}
      logStatusContent={phase === 'playing'
        ? (exitOpenRef.current
            ? t('minigames.maze.log_status_exit_open')
            : t('minigames.maze.log_status_remaining', nodeCount - nodesCollected))
        : undefined}
      logContent={<>
        {phase === 'idle' && [
          t('minigames.maze.log_module_loaded'),
          t('minigames.maze.log_topology', mazeW, mazeH, visRadius),
          t('minigames.maze.log_fragments_detected', nodeCount),
          timeLimit > 0 ? t('minigames.maze.log_trace_active', timeLimit) : t('minigames.maze.log_no_trace'),
          t('minigames.maze.log_awaiting_input'),
        ].map((line, i) => (
          <div key={`idle-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '4px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
          }}>
            <span style={{ fontSize: 10, color: alpha('fog', 0.35), letterSpacing: '0.04em' }}>{line}</span>
          </div>
        ))}

        <EventLog entries={eventLog} badgeMinWidth={32} styles={{
          node: { label: t('minigames.maze.badge_data'), color: palette.warn, msg: alpha('warn', 0.6) },
          warn: { label: t('minigames.maze.badge_warn'), color: palette.danger, msg: alpha('danger', 0.65) },
          sys: { label: t('minigames.maze.badge_sys'), color: palette.dim },
        }} />

        {phase === 'won' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
          }}>
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: palette.green, minWidth: 32, flexShrink: 0 }}>{t('minigames.maze.badge_done')}</span>
            <span style={{ fontSize: 9, color: alpha('fog', 0.6), letterSpacing: '0.04em' }}>
              {t('minigames.maze.won_log_complete')}
            </span>
          </div>
        )}
      </>}
    />
  )
}
