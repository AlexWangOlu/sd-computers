import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { gated } from '../core/inputGate'
import { CELL, CANVAS_COLS, CANVAS_ROWS, PLAY_COLS, PLAY_ROWS, SURVIVAL_SLICE_SEC } from '../core/constants'
import type { BaseGameProps } from '../core/types'
import { useGameLifecycle } from '../core/useGameLifecycle'
import { drawVoid, drawPlayArea, drawPlayGrid, drawBorder, drawScanlines } from '../core/canvasUtils'
import GameShell from '../core/GameShell'
import { TimerDisplay, LivesDots } from '../core/HudElements'
import { t } from '@/i18n'
import { palette, alpha } from '@/theme/palette'

const MIN_ROAD = 14
const MAX_ROAD = 40

const PLAYER_W = 3
const PLAYER_H = 2
const THREAT_H = 2

const HIT_SHRINK = 0.35
const PLAYER_SPEED = 0.22

const THREAT_COLORS = [
  palette.alert, '#bf00ff', palette.accent, '#aaff00',
  '#ff0066', palette.warn, '#00ff88', '#8855ff',
]

const EVADE_MESSAGE_KEYS = [
  'evade_msg_firewall_packet', 'evade_msg_scanner_probe',
  'evade_msg_ids_signature', 'evade_msg_security_gate',
  'evade_msg_packet_inspector', 'evade_msg_sentinel_process',
  'evade_msg_trap_node', 'evade_msg_deep_inspection',
]

const IDLE_LOG_KEYS = [
  'idle_log_module_loaded',
  'idle_log_analyzing_traffic',
  'idle_log_threat_level',
  'idle_log_awaiting_input',
]

interface Threat {
  id: number
  x: number
  y: number
  speed: number
  colorIdx: number
  width: number
  passed: boolean
}

interface HeldKeys { left: boolean; right: boolean; up: boolean; down: boolean }

interface DodgerGameProps extends BaseGameProps {
  timeLimit?: number
  speed?: number
  spawnRate?: number
  roadWidth?: number
  playerLives?: number
}

export default function DodgerGame({
  onWin, onFail, onProgress,
  timeLimit: propTimeLimit = 20,
  speed: propSpeed = 1.0,
  spawnRate: propSpawnRate = 1.0,
  roadWidth: propRoadWidth = 34,
  playerLives: propLives = 1,
}: DodgerGameProps) {

  const timeLimit = Math.max(5, propTimeLimit)

  const layout = useMemo(() => {
    const usedCols = Math.max(MIN_ROAD, Math.min(MAX_ROAD, propRoadWidth))
    const padX = Math.floor((PLAY_COLS - usedCols) / 2)
    const visualLanes = Math.max(2, Math.floor(usedCols / 6))
    const laneW = usedCols / visualLanes
    return { usedCols, padX, visualLanes, laneW }
  }, [propRoadWidth])

  const playerMinX = layout.padX + PLAYER_W / 2
  const playerMaxX = layout.padX + layout.usedCols - PLAYER_W / 2
  const playerMinY = PLAYER_H / 2 + 1
  const playerMaxY = PLAY_ROWS - PLAYER_H / 2 - 0.5

  const OX = Math.floor((CANVAS_COLS - PLAY_COLS) / 2) * CELL
  const OY = Math.floor((CANVAS_ROWS - PLAY_ROWS) / 2) * CELL
  const PW = PLAY_COLS * CELL
  const PH = PLAY_ROWS * CELL

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const survivedRef = useRef(0)

  const { phase, changePhase, phaseRef, failBarDrained, reportProgress } = useGameLifecycle(onWin, onFail, onProgress)

  const [timeLeft, setTimeLeft] = useState(timeLimit)
  const [lives, setLives] = useState(propLives)
  const [dodgedCount, setDodgedCount] = useState(0)

  const rafRef = useRef<number>(0)
  const tickRef = useRef(0)
  const lastFrameRef = useRef(0)
  const playerXRef = useRef(0)
  const playerYRef = useRef(0)
  const keysRef = useRef<HeldKeys>({ left: false, right: false, up: false, down: false })
  const threatsRef = useRef<Threat[]>([])
  const livesRef = useRef(propLives)
  const dodgedRef = useRef(0)
  const spawnAccum = useRef(0)
  const threatIdRef = useRef(0)
  const iFramesRef = useRef(0)
  const elapsedRef = useRef(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const tick = tickRef.current
    const alive = phaseRef.current === 'playing'

    drawVoid(ctx)
    drawPlayArea(ctx, OX, OY, PW, PH, palette.fieldBg)
    drawPlayGrid(ctx, OX, OY, PLAY_COLS, PLAY_ROWS, CELL, 0.03)

    for (let i = 0; i < layout.visualLanes; i++) {
      const lx = OX + (layout.padX + i * layout.laneW) * CELL
      const lw = layout.laneW * CELL
      ctx.fillStyle = THREAT_COLORS[i % THREAT_COLORS.length] + '03'
      ctx.fillRect(lx, OY, lw, PH)
    }

    const scrollOff = alive ? (tick * propSpeed * 0.45) % (CELL * 2) : 0

    ctx.save()
    ctx.beginPath(); ctx.rect(OX, OY, PW, PH); ctx.clip()

    for (let i = 1; i < layout.visualLanes; i++) {
      const lx = OX + (layout.padX + i * layout.laneW) * CELL
      ctx.strokeStyle = alpha('green', 0.12)
      ctx.lineWidth = 1
      ctx.setLineDash([CELL * 0.7, CELL * 1.3])
      ctx.lineDashOffset = -scrollOff
      ctx.beginPath(); ctx.moveTo(lx, OY); ctx.lineTo(lx, OY + PH); ctx.stroke()
    }
    ctx.setLineDash([])

    const eL = OX + layout.padX * CELL
    const eR = OX + (layout.padX + layout.usedCols) * CELL
    ctx.strokeStyle = 'rgba(255,200,0,0.2)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(eL, OY); ctx.lineTo(eL, OY + PH); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(eR, OY); ctx.lineTo(eR, OY + PH); ctx.stroke()

    ctx.restore()

    drawBorder(ctx, OX, OY, PW, PH)

    ctx.save()
    ctx.beginPath(); ctx.rect(OX, OY, PW, PH); ctx.clip()

    for (const t of threatsRef.current) {
      const cx = OX + t.x * CELL
      const ty = OY + t.y * CELL
      const tw = t.width * CELL
      const th = THREAT_H * CELL
      const col = THREAT_COLORS[t.colorIdx % THREAT_COLORS.length]

      const trailLen = th * 1.2
      const grad = ctx.createLinearGradient(0, ty - trailLen, 0, ty)
      grad.addColorStop(0, col + '00')
      grad.addColorStop(1, col + '44')
      ctx.fillStyle = grad
      ctx.fillRect(cx - tw / 2 + 4, ty - trailLen, tw - 8, trailLen)

      const bx = cx - tw / 2 + 2, by = ty + 2, bw = tw - 4, bh = th - 4, rad = 3
      ctx.shadowBlur = 10
      ctx.shadowColor = col
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.moveTo(bx + rad, by)
      ctx.lineTo(bx + bw - rad, by); ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + rad)
      ctx.lineTo(bx + bw, by + bh - rad); ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - rad, by + bh)
      ctx.lineTo(bx + rad, by + bh); ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - rad)
      ctx.lineTo(bx, by + rad); ctx.quadraticCurveTo(bx, by, bx + rad, by)
      ctx.closePath(); ctx.fill()
      ctx.shadowBlur = 0

      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(cx - tw / 2 + 7, ty + 6, tw - 14, th - 12)

      ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(255,248,180,0.9)'; ctx.fillStyle = 'rgba(255,248,180,0.95)'
      ctx.fillRect(cx - tw / 2 + 4, ty + th - 6, 3, 3)
      ctx.fillRect(cx + tw / 2 - 7, ty + th - 6, 3, 3)
      ctx.shadowBlur = 0

      ctx.shadowBlur = 5; ctx.shadowColor = 'rgba(255,40,40,0.8)'; ctx.fillStyle = 'rgba(255,40,40,0.9)'
      ctx.fillRect(cx - tw / 2 + 4, ty + 3, 3, 3)
      ctx.fillRect(cx + tw / 2 - 7, ty + 3, 3, 3)
      ctx.shadowBlur = 0
    }

    ctx.restore()

    if (alive || phaseRef.current === 'won') {
      const pcx = OX + playerXRef.current * CELL
      const pcy = OY + playerYRef.current * CELL
      const pw = PLAYER_W * CELL
      const ph = PLAYER_H * CELL
      const iF = iFramesRef.current
      const vis = iF <= 0 || Math.floor(tick / 4) % 2 === 0

      if (vis) {
        ctx.save()
        ctx.beginPath(); ctx.rect(OX, OY, PW, PH); ctx.clip()

        const pulse = 0.5 + 0.5 * Math.sin(tick * 0.12)

        ctx.shadowBlur = 14 + 8 * pulse
        ctx.shadowColor = `${alpha('accent', 0.6 + 0.4 * pulse)}`
        ctx.strokeStyle = `${alpha('accent', 0.3 + 0.2 * pulse)}`
        ctx.lineWidth = 1.5
        ctx.strokeRect(pcx - pw / 2 - 2, pcy - ph / 2 - 2, pw + 4, ph + 4)
        ctx.shadowBlur = 0

        const bx = pcx - pw / 2 + 2, by = pcy - ph / 2 + 2, bw = pw - 4, bh = ph - 4, rad = 4
        ctx.shadowBlur = 12
        ctx.shadowColor = palette.accent
        ctx.fillStyle = palette.accent
        ctx.beginPath()
        ctx.moveTo(bx + rad, by)
        ctx.lineTo(bx + bw - rad, by); ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + rad)
        ctx.lineTo(bx + bw, by + bh - rad); ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - rad, by + bh)
        ctx.lineTo(bx + rad, by + bh); ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - rad)
        ctx.lineTo(bx, by + rad); ctx.quadraticCurveTo(bx, by, bx + rad, by)
        ctx.closePath(); ctx.fill()
        ctx.shadowBlur = 0

        ctx.fillStyle = 'rgba(0,12,24,0.65)'
        ctx.fillRect(pcx - pw / 2 + 7, pcy - ph / 2 + 6, pw - 14, ph - 12)

        ctx.fillStyle = '#001a2e'
        ctx.beginPath()
        ctx.moveTo(pcx, pcy - ph / 2 + 4)
        ctx.lineTo(pcx + 5, pcy - ph / 2 + 12)
        ctx.lineTo(pcx - 5, pcy - ph / 2 + 12)
        ctx.closePath(); ctx.fill()

        ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(255,80,80,0.8)'; ctx.fillStyle = 'rgba(255,80,80,0.9)'
        ctx.fillRect(pcx - pw / 2 + 4, pcy + ph / 2 - 5, 3, 3)
        ctx.fillRect(pcx + pw / 2 - 7, pcy + ph / 2 - 5, 3, 3)
        ctx.shadowBlur = 0

        ctx.restore()
      }
    }

    const lp = 0.35 + 0.25 * Math.sin(tick * 0.06)
    ctx.shadowBlur = 8
    ctx.shadowColor = `${alpha('danger', lp)}`
    ctx.fillStyle = `${alpha('danger', lp + 0.15)}`
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`▼  ${t('minigames.dodger.incoming_traffic')}  ▼`, OX + PW / 2, OY + 12)
    ctx.shadowBlur = 0

    drawScanlines(ctx)
  }, [layout, OX, OY, PW, PH, propSpeed, phaseRef])

  const checkCollision = useCallback((): boolean => {
    const px = playerXRef.current
    const py = playerYRef.current
    const pL = px - PLAYER_W / 2 + HIT_SHRINK
    const pR = px + PLAYER_W / 2 - HIT_SHRINK
    const pT = py - PLAYER_H / 2 + HIT_SHRINK
    const pB = py + PLAYER_H / 2 - HIT_SHRINK

    for (const t of threatsRef.current) {
      const tL = t.x - t.width / 2 + HIT_SHRINK
      const tR = t.x + t.width / 2 - HIT_SHRINK
      const tT = t.y + HIT_SHRINK
      const tB = t.y + THREAT_H - HIT_SHRINK
      if (pL < tR && pR > tL && pT < tB && pB > tT) return true
    }
    return false
  }, [])

  const spawnThreat = useCallback(() => {
    const r = Math.random()
    const w = r < 0.2 ? 2 : r < 0.55 ? 3 : r < 0.8 ? 4 : 5
    const clamped = Math.min(w, Math.floor(layout.usedCols / 3))

    const minX = layout.padX + clamped / 2 + 0.3
    const maxX = layout.padX + layout.usedCols - clamped / 2 - 0.3
    const tx = minX + Math.random() * (maxX - minX)

    const tooClose = threatsRef.current.some(
      t => t.y < 3.5 && Math.abs(t.x - tx) < 4
    )
    if (tooClose) return

    const baseSpeed = 0.12 * propSpeed
    const speedVar = 0.6 + Math.random() * 0.9

    const progress = Math.min(elapsedRef.current / (timeLimit * 60), 1)
    const ramp = 1 + progress * 0.6

    threatsRef.current.push({
      id: ++threatIdRef.current,
      x: tx,
      y: -THREAT_H,
      speed: baseSpeed * speedVar * ramp,
      colorIdx: Math.floor(Math.random() * THREAT_COLORS.length),
      width: clamped,
      passed: false,
    })
  }, [propSpeed, timeLimit, layout])

  const gameLoop = useCallback((timestamp: number) => {
    if (phaseRef.current !== 'playing') return

    const dt = lastFrameRef.current
      ? Math.min((timestamp - lastFrameRef.current) / 16.667, 3)
      : 1
    lastFrameRef.current = timestamp

    tickRef.current++
    elapsedRef.current += dt

    const keys = keysRef.current
    const spd = PLAYER_SPEED * dt
    let nx = playerXRef.current
    let ny = playerYRef.current
    if (keys.left) nx -= spd
    if (keys.right) nx += spd
    if (keys.up) ny -= spd
    if (keys.down) ny += spd
    playerXRef.current = Math.max(playerMinX, Math.min(playerMaxX, nx))
    playerYRef.current = Math.max(playerMinY, Math.min(playerMaxY, ny))

    for (const t of threatsRef.current) t.y += t.speed * dt

    for (const t of threatsRef.current) {
      if (!t.passed && t.y > PLAY_ROWS) {
        t.passed = true
        dodgedRef.current++
        setDodgedCount(dodgedRef.current)
      }
    }

    threatsRef.current = threatsRef.current.filter(t => t.y < PLAY_ROWS + 4)

    if (iFramesRef.current > 0) iFramesRef.current -= dt

    if (iFramesRef.current <= 0 && checkCollision()) {
      livesRef.current--
      setLives(livesRef.current)
      if (livesRef.current <= 0) {
        changePhase('dead'); cancelAnimationFrame(rafRef.current); draw(); return
      }
      iFramesRef.current = 60
    }

    const progress = Math.min(elapsedRef.current / (timeLimit * 60), 1)
    const spawnRamp = 1 + progress * 0.7
    const spawnInterval = Math.max(4, 22 / (propSpawnRate * spawnRamp))
    spawnAccum.current += dt
    if (spawnAccum.current >= spawnInterval) {
      spawnAccum.current -= spawnInterval
      spawnThreat()
    }

    draw()
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [draw, checkCollision, spawnThreat, propSpawnRate, timeLimit,
      playerMinX, playerMaxX, playerMinY, playerMaxY, changePhase, phaseRef])

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    tickRef.current = 0
    lastFrameRef.current = 0
    elapsedRef.current = 0
    spawnAccum.current = 0
    threatIdRef.current = 0
    dodgedRef.current = 0
    livesRef.current = propLives
    iFramesRef.current = 0
    playerXRef.current = layout.padX + layout.usedCols / 2
    playerYRef.current = playerMaxY - 1
    keysRef.current = { left: false, right: false, up: false, down: false }
    threatsRef.current = []
    setDodgedCount(0)
    setLives(propLives)
    setTimeLeft(timeLimit)
    changePhase('playing')
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [gameLoop, layout, propLives, timeLimit, playerMaxY, changePhase])

  useEffect(() => {
    const isMove = (key: string) => {
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
      const dir = isMove(e.key)
      if (dir) {
        e.preventDefault(); e.stopPropagation()
        keysRef.current[dir] = true
      }
    }

    const onUp = (e: KeyboardEvent) => {
      const dir = isMove(e.key)
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
  }, [startGame, phaseRef])

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
  }, [phase, changePhase, phaseRef])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [dodgedCount])

  useEffect(() => {
    draw()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  const logMilestones = useMemo(() => {
    const m: number[] = []
    for (let i = 5; i <= dodgedCount; i += 5) m.push(i)
    return m
  }, [dodgedCount])

  return (
    <GameShell
      canvasRef={canvasRef}
      phase={phase}
      failBarDrained={failBarDrained}
      overlay={{
        idleSubtitle: t('minigames.dodger.idle_subtitle'),
        idleDescription: t('minigames.dodger.idle_description', timeLimit),
        controlsHint: t('minigames.dodger.controls_hint'),
        deadTitle: t('minigames.dodger.dead_title'),
        deadDescription: t('minigames.dodger.dead_description'),
        wonTitle: t('minigames.dodger.won_title'),
        wonDescription: t('minigames.dodger.won_description', dodgedCount),
      }}
      hudContent={<>
        <TimerDisplay timeLeft={timeLeft} />
        {propLives > 1 && (
          <LivesDots total={propLives} current={lives} />
        )}
        <span style={{ fontSize: 10, color: alpha('fog', 0.35) }}>
          {t('minigames.dodger.hud_evaded', dodgedCount)}
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
      logTitle={t('minigames.dodger.log_title')}
      logRef={logRef}
      logStatusContent={phase === 'playing'
        ? t('minigames.dodger.log_status', Math.round(((timeLimit - timeLeft) / timeLimit) * 100))
        : undefined}
      logContent={<>
        {phase === 'idle' && IDLE_LOG_KEYS.map((key, i) => (
          <div key={`idle-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '5px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
          }}>
            <span style={{ fontSize: 10, color: alpha('fog', 0.35), letterSpacing: '0.04em' }}>{t(`minigames.dodger.${key}`)}</span>
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
                {t(`minigames.dodger.${EVADE_MESSAGE_KEYS[i % EVADE_MESSAGE_KEYS.length]}`)}
              </span>
              <div style={{ width: 100, height: 4, background: alpha('white', 0.07), borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: '100%', height: '100%', borderRadius: 3, background: palette.green, boxShadow: `0 0 4px ${alpha('green', 0.5)}` }} />
              </div>
              <span style={{ fontSize: 9, letterSpacing: '0.06em', flexShrink: 0, minWidth: 38, textAlign: 'right', color: palette.green }}>
                {t('minigames.dodger.log_clear')} ✓
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
                {t('minigames.dodger.log_live')}
              </span>
              <span style={{ flex: 1, fontSize: 10, letterSpacing: '0.04em', color: alpha('fog', 0.45) }}>
                {t('minigames.dodger.log_playing', dodgedCount)}
              </span>
              <div style={{ width: 100, height: 4, background: alpha('white', 0.07), borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{
                  width: `${Math.min(100, (dodgedCount % 5) * 20)}%`, height: '100%', borderRadius: 3,
                  background: palette.dim, transition: 'width 0.3s ease',
                }} />
              </div>
              <span style={{ fontSize: 9, letterSpacing: '0.06em', flexShrink: 0, minWidth: 38, textAlign: 'right', color: alpha('dim', 0.6) }}>
                ...
              </span>
            </div>
          )}

          {phase === 'won' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '5px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: palette.green, minWidth: 54, flexShrink: 0 }}>{t('minigames.dodger.log_upload')}</span>
              <span style={{ flex: 1, fontSize: 10, color: alpha('fog', 0.65), letterSpacing: '0.04em' }}>
                {t('minigames.dodger.log_upload_verified')}
              </span>
              <div style={{ width: 100, height: 4, background: alpha('white', 0.07), borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: '100%', height: '100%', background: palette.green, borderRadius: 3, boxShadow: `0 0 4px ${alpha('green', 0.5)}` }} />
              </div>
              <span style={{ fontSize: 9, letterSpacing: '0.06em', flexShrink: 0, minWidth: 38, textAlign: 'right', color: palette.green }}>{t('minigames.dodger.log_done')} ✓</span>
            </div>
          )}
        </>)}
      </>}
    />
  )
}
