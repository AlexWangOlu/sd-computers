import { useState, useEffect, useRef, useCallback } from 'react'
import { gated } from '../core/inputGate'
import { t } from '@/i18n'
import { palette, alpha } from '@/theme/palette'
import { CELL, CANVAS_COLS, CANVAS_ROWS } from '../core/constants'
import type { BaseGameProps } from '../core/types'
import { useGameLifecycle } from '../core/useGameLifecycle'
import { drawVoid, drawPlayArea, drawPlayGrid, drawBorder } from '../core/canvasUtils'
import GameShell from '../core/GameShell'
import { ProgressPips } from '../core/HudElements'

const MIN_SPEED = 55
const SPEED_STEP = 8

const NODE_MESSAGE_KEYS = [
  'node_message_1',
  'node_message_2',
  'node_message_3',
  'node_message_4',
  'node_message_5',
  'node_message_6',
  'node_message_7',
  'node_message_8',
  'node_message_9',
  'node_message_10',
  'node_message_11',
  'node_message_12',
  'node_message_13',
  'node_message_14',
  'node_message_15',
]

function getNodeMessage(i: number): string {
  return t(`minigames.snake.${NODE_MESSAGE_KEYS[i % NODE_MESSAGE_KEYS.length]}`)
}

type Point = { x: number; y: number }
type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

const OPP: Record<Dir, Dir> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }

function randFood(snake: Point[], cols: number, rows: number): Point {
  let p: Point
  do {
    p = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) }
  } while (snake.some(s => s.x === p.x && s.y === p.y))
  return p
}

function initSnake(cols: number, rows: number): Point[] {
  const cx = Math.floor(cols / 2)
  const cy = Math.floor(rows / 2)
  return [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }]
}

interface SnakeGameProps extends BaseGameProps {
  nodesRequired?: number
  initialSpeed?: number
  gridCols?: number
  gridRows?: number
}

export default function SnakeGame({
  onWin, onFail, onProgress,
  nodesRequired = 14,
  initialSpeed = 88,
  gridCols = 28,
  gridRows = 13,
}: SnakeGameProps) {
  const FOOD_NEEDED = nodesRequired
  const BASE_SPEED = initialSpeed
  const COLS = Math.min(gridCols, CANVAS_COLS)
  const ROWS = Math.min(gridRows, CANVAS_ROWS)

  const offsetX = Math.floor((CANVAS_COLS - COLS) / 2) * CELL
  const offsetY = Math.floor((CANVAS_ROWS - ROWS) / 2) * CELL
  const PW = COLS * CELL
  const PH = ROWS * CELL

  const { phase, changePhase, phaseRef, failBarDrained, reportProgress } = useGameLifecycle(onWin, onFail, onProgress)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  const g = useRef({
    snake: initSnake(COLS, ROWS),
    dir: 'RIGHT' as Dir,
    nextDir: 'RIGHT' as Dir,
    food: { x: Math.floor(COLS * 0.74), y: Math.floor(ROWS / 2) } as Point,
    score: 0,
    alive: false,
    speed: BASE_SPEED,
  })

  const [displayScore, setDisplayScore] = useState(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const { snake, food, dir } = g.current

    drawVoid(ctx)
    drawPlayArea(ctx, offsetX, offsetY, PW, PH)
    drawPlayGrid(ctx, offsetX, offsetY, COLS, ROWS)

    drawBorder(ctx, offsetX, offsetY, PW, PH)

    const fx = offsetX + food.x * CELL + CELL / 2
    const fy = offsetY + food.y * CELL + CELL / 2
    ctx.strokeStyle = palette.danger
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(fx, fy, 6, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = palette.danger
    ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath()
    ctx.moveTo(fx - 12, fy); ctx.lineTo(fx - 8, fy)
    ctx.moveTo(fx + 8, fy); ctx.lineTo(fx + 12, fy)
    ctx.moveTo(fx, fy - 12); ctx.lineTo(fx, fy - 8)
    ctx.moveTo(fx, fy + 8); ctx.lineTo(fx, fy + 12)
    ctx.stroke()

    snake.forEach((seg, i) => {
      const isHead = i === 0
      const t = Math.max(0, 1 - i / Math.max(snake.length - 1, 1))

      if (isHead) {
        ctx.fillStyle = palette.dim
      } else {
        const r = Math.round(15 + t * 50)
        const g2 = Math.round(50 + t * 90)
        const b = Math.round(90 + t * 100)
        ctx.fillStyle = `rgb(${r},${g2},${b})`
      }

      const pad = isHead ? 1 : 2
      const size = CELL - pad * 2 - 1
      const sx = offsetX + seg.x * CELL + pad
      const sy = offsetY + seg.y * CELL + pad
      const rad = isHead ? 5 : 2

      ctx.beginPath()
      ctx.moveTo(sx + rad, sy)
      ctx.lineTo(sx + size - rad, sy)
      ctx.quadraticCurveTo(sx + size, sy, sx + size, sy + rad)
      ctx.lineTo(sx + size, sy + size - rad)
      ctx.quadraticCurveTo(sx + size, sy + size, sx + size - rad, sy + size)
      ctx.lineTo(sx + rad, sy + size)
      ctx.quadraticCurveTo(sx, sy + size, sx, sy + size - rad)
      ctx.lineTo(sx, sy + rad)
      ctx.quadraticCurveTo(sx, sy, sx + rad, sy)
      ctx.closePath()
      ctx.fill()

      if (isHead) {
        ctx.fillStyle = alpha('white', 0.9)
        const hx = offsetX + seg.x * CELL + CELL / 2
        const hy = offsetY + seg.y * CELL + CELL / 2
        const offsets: Record<Dir, [number, number, number, number]> = {
          RIGHT: [ 4, -3, 4, 3],
          LEFT: [-4, -3, -4, 3],
          UP: [-3, -4, 3, -4],
          DOWN: [-3, 4, 3, 4],
        }
        const [x1, y1, x2, y2] = offsets[dir]
        ctx.beginPath(); ctx.arc(hx + x1, hy + y1, 1.8, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(hx + x2, hy + y2, 1.8, 0, Math.PI * 2); ctx.fill()
      }
    })
  }, [])

  const runTick = useCallback(() => {
    const state = g.current
    if (!state.alive) return

    state.dir = state.nextDir
    const head = state.snake[0]
    const newHead: Point = {
      x: head.x + (state.dir === 'RIGHT' ? 1 : state.dir === 'LEFT' ? -1 : 0),
      y: head.y + (state.dir === 'DOWN' ? 1 : state.dir === 'UP' ? -1 : 0),
    }

    if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
      state.alive = false; changePhase('dead'); draw(); return
    }
    if (state.snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
      state.alive = false; changePhase('dead'); draw(); return
    }

    const ateFood = newHead.x === state.food.x && newHead.y === state.food.y
    state.snake = [newHead, ...state.snake]
    if (!ateFood) state.snake.pop()

    if (ateFood) {
      state.score++
      setDisplayScore(state.score)
      reportProgress(state.score)
      state.food = randFood(state.snake, COLS, ROWS)
      if (state.score % 2 === 0 && state.speed > MIN_SPEED) {
        state.speed = Math.max(MIN_SPEED, state.speed - SPEED_STEP)
      }
      if (state.score >= FOOD_NEEDED) {
        state.alive = false; changePhase('won'); draw(); return
      }
    }

    draw()
    timerRef.current = setTimeout(runTick, state.speed)
  }, [draw, changePhase])

  const startGame = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const snake = initSnake(COLS, ROWS)
    g.current = {
      snake, dir: 'RIGHT', nextDir: 'RIGHT',
      food: randFood(snake, COLS, ROWS), score: 0, alive: true, speed: BASE_SPEED,
    }
    setDisplayScore(0)
    changePhase('playing')
    draw()
    timerRef.current = setTimeout(runTick, BASE_SPEED)
  }, [draw, runTick, changePhase])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: 'UP', w: 'UP', W: 'UP',
        ArrowDown: 'DOWN', s: 'DOWN', S: 'DOWN',
        ArrowLeft: 'LEFT', a: 'LEFT', A: 'LEFT',
        ArrowRight: 'RIGHT', d: 'RIGHT', D: 'RIGHT',
      }
      const newDir = map[e.key]
      if (newDir) {
        e.preventDefault(); e.stopPropagation()
        if (g.current.alive && g.current.dir !== OPP[newDir]) {
          g.current.nextDir = newDir
        }
      }
      if ((e.key === 'Enter' || e.key === ' ') && phaseRef.current === 'idle') {
        e.preventDefault(); startGame()
      }
    }
    window.addEventListener('keydown', gated(handleKey), { capture: true })
    return () => window.removeEventListener('keydown', gated(handleKey), { capture: true })
  }, [startGame, phaseRef])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [displayScore])

  useEffect(() => {
    draw()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [draw])

  return (
    <GameShell
      canvasRef={canvasRef}
      phase={phase}
      failBarDrained={failBarDrained}
      overlay={{
        idleSubtitle: t('minigames.snake.idle_subtitle', COLS, ROWS),
        idleDescription: t('minigames.snake.idle_description', FOOD_NEEDED),
        controlsHint: t('minigames.snake.controls_hint'),
        deadTitle: t('minigames.snake.dead_title'),
        deadDescription: t('minigames.snake.dead_description', displayScore, FOOD_NEEDED),
        wonTitle: t('minigames.snake.won_title'),
        wonDescription: t('minigames.snake.won_description'),
      }}
      hudContent={<>
        <span style={{ fontSize: 10, color: alpha('fog', 0.35) }}>
          {displayScore} / {FOOD_NEEDED}
        </span>
        <ProgressPips total={FOOD_NEEDED} current={displayScore} phase={phase} />
      </>}
      logTitle={t('minigames.snake.log_title')}
      logRef={logRef}
      logStatusContent={phase === 'playing'
        ? t('minigames.snake.log_status', String(displayScore + 1).padStart(2, '0'))
        : undefined}
      logContent={
        Array.from({ length: FOOD_NEEDED }, (_, i) => {
          const done = i < displayScore
          const current = i === displayScore && phase === 'playing'
          if (!done && !current) return null
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '5px 2px',
              borderBottom: `1px solid ${alpha('white', 0.04)}`,
              opacity: done ? 1 : 0.85,
              transition: 'opacity 0.3s ease',
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                color: done ? palette.green : palette.dim,
                minWidth: 54, flexShrink: 0,
              }}>
                {t('minigames.snake.node_label')} {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{
                flex: 1, fontSize: 10,
                color: done ? alpha('fog', 0.65) : alpha('fog', 0.45),
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {getNodeMessage(i)}
              </span>
              <div style={{ width: 100, height: 4, background: alpha('white', 0.07), borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{
                  width: done ? '100%' : '18%', height: '100%',
                  background: done ? palette.green : palette.dim, borderRadius: 3,
                  boxShadow: done ? `0 0 4px ${alpha('green', 0.5)}` : 'none',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <span style={{
                fontSize: 9, letterSpacing: '0.06em', flexShrink: 0, minWidth: 38, textAlign: 'right',
                color: done ? palette.green : alpha('dim', 0.6),
              }}>
                {done ? `${t('minigames.snake.log_done')} ✓` : '...'}
              </span>
            </div>
          )
        })
      }
    />
  )
}
