import { useState, useEffect, useRef, useCallback } from 'react'
import { gated } from '../core/inputGate'
import { OX, OY, PW, PH } from '../core/constants'
import type { BaseGameProps } from '../core/types'
import { useGameLifecycle } from '../core/useGameLifecycle'
import { useEventLog } from '../core/useEventLog'
import { EventLog } from '../core/EventLog'
import { drawVoid, drawPlayArea, drawBorder, drawScanlines } from '../core/canvasUtils'
import GameShell from '../core/GameShell'
import { t } from '@/i18n'
import { palette, alpha } from '@/theme/palette'

const NODE_COLORS = [
  palette.accent, '#ff0066', '#aaff00', palette.warn,
  '#bf00ff', '#00ff88', palette.alert, '#8855ff',
]

interface ActiveNode {
  gx: number
  gy: number
  spawnAt: number
  colorIdx: number
}

const IDLE_LOG_LINES = [
  'minigames.nodecap.idle_log_module_loaded',
  'minigames.nodecap.idle_log_scanning',
  'minigames.nodecap.idle_log_volatility',
  'minigames.nodecap.idle_log_awaiting',
]

interface NodeCaptureGameProps extends BaseGameProps {
  gridSize?: number
  nodeDuration?: number
  capturesRequired?: number
  maxMisses?: number
}

export default function NodeCaptureGame({
  onWin, onFail, onProgress,
  gridSize: propGridSize = 10,
  nodeDuration: propDuration = 2200,
  capturesRequired: propCaptures = 15,
  maxMisses: propMaxMiss = 5,
}: NodeCaptureGameProps) {

  const gridN = Math.max(6, Math.min(16, propGridSize))
  const duration = Math.max(800, propDuration)
  const target = Math.max(3, propCaptures)
  const maxMiss = Math.max(1, propMaxMiss)

  const cellPx = Math.floor(Math.min((PW - 40) / gridN, (PH - 40) / gridN))
  const gridPxW = cellPx * gridN
  const gridPxH = cellPx * gridN
  const gridOX = OX + Math.floor((PW - gridPxW) / 2)
  const gridOY = OY + Math.floor((PH - gridPxH) / 2)

  const { phase, changePhase, phaseRef, failBarDrained, reportProgress } = useGameLifecycle(onWin, onFail, onProgress)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [captures, setCaptures] = useState(0)
  const [misses, setMisses] = useState(0)
  const { entries: eventLog, addEvent, reset: resetLog, logRef } = useEventLog<'cap' | 'miss' | 'spawn' | 'sys'>(40)

  const rafRef = useRef<number>(0)
  const tickRef = useRef(0)
  const lastFrameRef = useRef(0)
  const cursorRef = useRef({ x: Math.floor(gridN / 2), y: Math.floor(gridN / 2) })
  const activeNodeRef = useRef<ActiveNode | null>(null)
  const capturesRef = useRef(0)
  const missesRef = useRef(0)
  const nodeCountRef = useRef(0)
  const spawnDelayRef = useRef(0)
  const lastMoveRef = useRef(0)
  const captureFlashRef = useRef({ gx: -1, gy: -1, until: 0 })
  const missFlashRef = useRef({ gx: -1, gy: -1, until: 0 })
  const keysRef = useRef({ left: false, right: false, up: false, down: false })
  const MOVE_CD = 90

  const spawnNode = useCallback((timestamp: number) => {
    let gx: number, gy: number
    let attempts = 0
    do {
      gx = Math.floor(Math.random() * gridN)
      gy = Math.floor(Math.random() * gridN)
      attempts++
    } while (gx === cursorRef.current.x && gy === cursorRef.current.y && attempts < 20)

    const colorIdx = (++nodeCountRef.current) % NODE_COLORS.length
    activeNodeRef.current = { gx, gy, spawnAt: timestamp, colorIdx }

    if (nodeCountRef.current % 3 === 1) {
      addEvent(t('minigames.nodecap.event_access_point', gx, gy), 'spawn')
    }
  }, [gridN, addEvent])

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const tick = tickRef.current
    const alive = phaseRef.current === 'playing'

    drawVoid(ctx)

    drawPlayArea(ctx, OX, OY, PW, PH, palette.fieldBg)

    ctx.strokeStyle = alpha('green', 0.12)
    ctx.lineWidth = 0.5
    for (let x = 0; x <= gridN; x++) {
      ctx.beginPath()
      ctx.moveTo(gridOX + x * cellPx, gridOY)
      ctx.lineTo(gridOX + x * cellPx, gridOY + gridPxH)
      ctx.stroke()
    }
    for (let y = 0; y <= gridN; y++) {
      ctx.beginPath()
      ctx.moveTo(gridOX, gridOY + y * cellPx)
      ctx.lineTo(gridOX + gridPxW, gridOY + y * cellPx)
      ctx.stroke()
    }

    if (timestamp < captureFlashRef.current.until) {
      const cf = captureFlashRef.current
      const fade = (captureFlashRef.current.until - timestamp) / 300
      ctx.fillStyle = alpha('green', 0.35 * fade)
      ctx.fillRect(gridOX + cf.gx * cellPx, gridOY + cf.gy * cellPx, cellPx, cellPx)
    }

    if (timestamp < missFlashRef.current.until) {
      const mf = missFlashRef.current
      const fade = (missFlashRef.current.until - timestamp) / 400
      ctx.fillStyle = alpha('danger', 0.3 * fade)
      ctx.fillRect(gridOX + mf.gx * cellPx, gridOY + mf.gy * cellPx, cellPx, cellPx)
    }

    const node = activeNodeRef.current
    if (node && alive) {
      const elapsed = timestamp - node.spawnAt
      const lifeLeft = Math.max(0, 1 - elapsed / duration)
      const col = NODE_COLORS[node.colorIdx]
      const nx = gridOX + node.gx * cellPx
      const ny = gridOY + node.gy * cellPx
      const pad = Math.max(2, cellPx * 0.1)
      const pulse = 0.6 + 0.4 * Math.sin(tick * 0.15)

      ctx.fillStyle = col + (lifeLeft < 0.3 ? '22' : '15')
      ctx.fillRect(nx, ny, cellPx, cellPx)

      const cx = nx + cellPx / 2
      const cy = ny + cellPx / 2
      const r = (cellPx / 2 - pad) * (0.5 + 0.3 * pulse)

      ctx.shadowBlur = 12 * pulse
      ctx.shadowColor = col
      ctx.fillStyle = col
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0

      ctx.fillStyle = alpha('white', 0.3)
      ctx.beginPath(); ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.3, 0, Math.PI * 2); ctx.fill()

      ctx.strokeStyle = lifeLeft < 0.3
        ? alpha('danger', 0.5 + 0.3 * pulse)
        : alpha('white', 0.15 + 0.1 * pulse)
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(cx, cy, cellPx / 2 - 2, -Math.PI / 2, -Math.PI / 2 + lifeLeft * Math.PI * 2)
      ctx.stroke()
    }

    if (alive || phaseRef.current === 'idle') {
      const cur = cursorRef.current
      const cx = gridOX + cur.x * cellPx + cellPx / 2
      const cy = gridOY + cur.y * cellPx + cellPx / 2
      const half = cellPx / 2 - 2
      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.1)

      ctx.shadowBlur = 10 + 6 * pulse
      ctx.shadowColor = alpha('accent', 0.5 + 0.3 * pulse)
      ctx.strokeStyle = alpha('accent', 0.6 + 0.3 * pulse)
      ctx.lineWidth = 2
      ctx.strokeRect(cx - half, cy - half, half * 2, half * 2)
      ctx.shadowBlur = 0

      const bLen = Math.max(4, cellPx * 0.2)
      ctx.strokeStyle = palette.accent
      ctx.lineWidth = 2.5
      ctx.lineCap = 'square'
      ctx.beginPath(); ctx.moveTo(cx - half, cy - half + bLen); ctx.lineTo(cx - half, cy - half); ctx.lineTo(cx - half + bLen, cy - half); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx + half - bLen, cy - half); ctx.lineTo(cx + half, cy - half); ctx.lineTo(cx + half, cy - half + bLen); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx + half, cy + half - bLen); ctx.lineTo(cx + half, cy + half); ctx.lineTo(cx + half - bLen, cy + half); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx - half + bLen, cy + half); ctx.lineTo(cx - half, cy + half); ctx.lineTo(cx - half, cy + half - bLen); ctx.stroke()

      ctx.fillStyle = palette.accent
      ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill()
    }

    drawBorder(ctx, OX, OY, PW, PH)

    drawScanlines(ctx)
  }, [gridN, cellPx, gridOX, gridOY, gridPxW, gridPxH, duration])

  const gameLoop = useCallback((timestamp: number) => {
    if (phaseRef.current !== 'playing') return

    lastFrameRef.current = timestamp
    tickRef.current++

    const now = Date.now()
    if (now - lastMoveRef.current >= MOVE_CD) {
      const keys = keysRef.current
      let dx = 0, dy = 0
      if (keys.left) dx--
      if (keys.right) dx++
      if (keys.up) dy--
      if (keys.down) dy++
      if (dx !== 0 || dy !== 0) {
        lastMoveRef.current = now
        const c = cursorRef.current
        cursorRef.current = {
          x: Math.max(0, Math.min(gridN - 1, c.x + dx)),
          y: Math.max(0, Math.min(gridN - 1, c.y + dy)),
        }
      }
    }

    const node = activeNodeRef.current
    if (node && timestamp - node.spawnAt >= duration) {
      missFlashRef.current = { gx: node.gx, gy: node.gy, until: timestamp + 400 }
      missesRef.current++
      setMisses(missesRef.current)
      addEvent(t('minigames.nodecap.event_node_expired', node.gx, node.gy, missesRef.current, maxMiss), 'miss')
      activeNodeRef.current = null

      if (missesRef.current >= maxMiss) {
        changePhase('dead'); cancelAnimationFrame(rafRef.current); draw(timestamp); return
      }

      spawnDelayRef.current = timestamp + 400 + Math.random() * 300
    }

    if (!activeNodeRef.current && timestamp >= spawnDelayRef.current) {
      spawnNode(timestamp)
    }

    draw(timestamp)
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [draw, gridN, duration, maxMiss, spawnNode, addEvent, changePhase])

  const attemptCapture = useCallback((timestamp: number) => {
    const node = activeNodeRef.current
    if (!node) return

    const cur = cursorRef.current
    if (cur.x === node.gx && cur.y === node.gy) {
      captureFlashRef.current = { gx: node.gx, gy: node.gy, until: timestamp + 300 }
      capturesRef.current++
      setCaptures(capturesRef.current)
      reportProgress(capturesRef.current)
      activeNodeRef.current = null
      addEvent(t('minigames.nodecap.event_node_captured', node.gx, node.gy, capturesRef.current, target), 'cap')

      if (capturesRef.current >= target) {
        changePhase('won'); cancelAnimationFrame(rafRef.current); draw(timestamp); return
      }

      spawnDelayRef.current = timestamp + 300 + Math.random() * 200
    }
  }, [target, draw, addEvent, changePhase])

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    tickRef.current = 0
    lastFrameRef.current = 0
    cursorRef.current = { x: Math.floor(gridN / 2), y: Math.floor(gridN / 2) }
    activeNodeRef.current = null
    capturesRef.current = 0
    missesRef.current = 0
    nodeCountRef.current = 0
    lastMoveRef.current = 0
    captureFlashRef.current = { gx: -1, gy: -1, until: 0 }
    missFlashRef.current = { gx: -1, gy: -1, until: 0 }
    keysRef.current = { left: false, right: false, up: false, down: false }
    spawnDelayRef.current = performance.now() + 500

    setCaptures(0)
    setMisses(0)
    resetLog()
    addEvent(t('minigames.nodecap.event_grid_init', gridN, gridN, target, maxMiss), 'sys')
    changePhase('playing')
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [gameLoop, gridN, target, maxMiss, addEvent, resetLog, changePhase])

  useEffect(() => {
    const isDir = (key: string) => {
      switch (key) {
        case 'ArrowLeft': case 'a': case 'A': return 'left'
        case 'ArrowRight': case 'd': case 'D': return 'right'
        case 'ArrowUp': case 'w': case 'W': return 'up'
        case 'ArrowDown': case 's': case 'S': return 'down'
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

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation()
        attemptCapture(performance.now())
      }
    }
    const onUp = (e: KeyboardEvent) => {
      const dir = isDir(e.key)
      if (dir) keysRef.current[dir] = false
    }
    const onBlur = () => {
      keysRef.current = { left: false, right: false, up: false, down: false }
    }

    window.addEventListener('keydown', gated(onDown), { capture: true })
    window.addEventListener('keyup', gated(onUp), { capture: true })
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', gated(onDown), { capture: true })
      window.removeEventListener('keyup', gated(onUp), { capture: true })
      window.removeEventListener('blur', onBlur)
    }
  }, [startGame, attemptCapture])

  useEffect(() => {
    draw(performance.now())
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  return (
    <GameShell
      canvasRef={canvasRef}
      phase={phase}
      failBarDrained={failBarDrained}
      overlay={{
        idleSubtitle: t('minigames.nodecap.idle_subtitle', gridN, gridN),
        idleDescription: t('minigames.nodecap.idle_description', target, maxMiss, (duration / 1000).toFixed(1)),
        controlsHint: t('minigames.nodecap.controls_hint'),
        deadTitle: t('minigames.nodecap.dead_title'),
        deadDescription: t('minigames.nodecap.dead_description'),
        wonTitle: t('minigames.nodecap.won_title'),
        wonDescription: t('minigames.nodecap.won_description', target, misses),
      }}
      hudContent={<>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: alpha('green', 0.7) }}>
          {captures}/{target}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          color: misses >= maxMiss - 1 ? palette.alert : alpha('danger', 0.5),
        }}>
          {t('minigames.nodecap.hud_miss', misses, maxMiss)}
        </span>
        {}
        <div style={{ width: 120, height: 8, borderRadius: 2, background: alpha('white', 0.07), overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${Math.max(0, (captures / target) * 100)}%`,
            background: captures >= target - 1 ? palette.green : palette.dim,
            boxShadow: captures >= target - 1 ? `0 0 6px ${alpha('green', 0.6)}` : 'none',
            transition: 'width 0.3s ease, background 0.3s',
          }} />
        </div>
      </>}
      logTitle={t('minigames.nodecap.log_title')}
      logRef={logRef}
      logStatusContent={phase === 'playing'
        ? t('minigames.nodecap.log_status', captures, target, misses, maxMiss)
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

        <EventLog entries={eventLog} badgeMinWidth={36} styles={{
          cap: { label: t('minigames.nodecap.badge_cap'), color: palette.green },
          miss: { label: t('minigames.nodecap.badge_miss'), color: palette.danger, msg: alpha('danger', 0.65) },
          spawn: { label: t('minigames.nodecap.badge_node'), color: palette.warn },
          sys: { label: t('minigames.nodecap.badge_sys'), color: palette.dim },
        }} />

        {phase === 'won' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
          }}>
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: palette.green, minWidth: 36, flexShrink: 0 }}>{t('minigames.nodecap.badge_done')}</span>
            <span style={{ fontSize: 9, color: alpha('fog', 0.6), letterSpacing: '0.04em' }}>
              {t('minigames.nodecap.won_log', captures, misses)}
            </span>
          </div>
        )}
      </>}
    />
  )
}
