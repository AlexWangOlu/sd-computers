import { useState, useEffect, useRef, useCallback } from 'react'
import { gated } from '../core/inputGate'
import { CELL, PLAY_COLS, PLAY_ROWS, OX, OY, PW, PH } from '../core/constants'
import type { BaseGameProps } from '../core/types'
import { useGameLifecycle } from '../core/useGameLifecycle'
import { useEventLog } from '../core/useEventLog'
import { EventLog } from '../core/EventLog'
import { drawVoid, drawPlayArea, drawPlayGrid, drawBorder, drawScanlines } from '../core/canvasUtils'
import GameShell from '../core/GameShell'
import { ProgressPips, LivesDots } from '../core/HudElements'
import { t } from '@/i18n'
import { palette, alpha } from '@/theme/palette'

const PAD_COLORS = [palette.accent, '#ff0066', palette.green, palette.warn]
const PAD_LABELS = ['▲', '▶', '▼', '◀']
const PAD_NAME_KEYS = ['pad_up', 'pad_right', 'pad_down', 'pad_left']

interface PadRect { x: number; y: number; w: number; h: number }
const PAD_RECTS: PadRect[] = [
  { x: 12, y: 0.5, w: 16, h: 4.5 },
  { x: 29, y: 2.5, w: 9, h: 14 },
  { x: 12, y: 14, w: 16, h: 4.5 },
  { x: 2, y: 2.5, w: 9, h: 14 },
]

const BASE_FLASH_ON = 450
const BASE_FLASH_OFF = 200
const SHOW_PAUSE = 500
const BASE_INPUT_TIME = 3200
const CORRECT_PAUSE = 800
const START_DELAY = 600
const INPUT_FLASH_DUR = 180
const DEFAULT_START_LEN = 3

type SubPhase = 'start' | 'show' | 'input' | 'correct'

interface SignalGameProps extends BaseGameProps {
  sequenceLength?: number
  startLength?: number
  flashSpeed?: number
  inputWindow?: number
  playerLives?: number
  challenge?: unknown
}

export default function SignalGame({
  onWin, onFail, onProgress,
  sequenceLength: propSeqLen = 6,
  startLength: propStartLen = DEFAULT_START_LEN,
  flashSpeed: propFlashSpd = 1.0,
  inputWindow: propInputWin = 1.0,
  playerLives: propLives = 1,
  challenge,
}: SignalGameProps) {

  const chal = challenge as { sequence?: number[]; startLength?: number } | null | undefined
  const totalRounds = Math.max(2, propSeqLen)
  const startLen = Math.max(2, Math.min(8, chal?.startLength ?? propStartLen))

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { phase, changePhase, phaseRef, failBarDrained, reportProgress } = useGameLifecycle(onWin, onFail, onProgress)

  const [lives, setLives] = useState(propLives)
  const [roundNum, setRoundNum] = useState(0)
  const { entries: eventLog, addEvent, logRef } = useEventLog<'input' | 'round' | 'warn' | 'sys'>(40)

  const subPhaseRef = useRef<SubPhase>('start')
  const rafRef = useRef<number>(0)
  const tickRef = useRef(0)
  const lastFrameRef = useRef(0)

  const sequenceRef = useRef<number[]>([])
  const roundRef = useRef(0)
  const livesRef = useRef(propLives)
  const activePadRef = useRef(-1)
  const allLitRef = useRef(false)
  const wrongPadRef = useRef(-1)

  const phaseStartRef = useRef(0)
  const inputIdxRef = useRef(0)
  const inputStartRef = useRef(0)
  const inputFlashRef = useRef({ dir: -1, until: 0 })

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const tick = tickRef.current
    const sub = subPhaseRef.current
    const lit = activePadRef.current
    const allLit = allLitRef.current
    const wrongPad = wrongPadRef.current

    drawVoid(ctx)

    drawPlayArea(ctx, OX, OY, PW, PH)
    drawPlayGrid(ctx, OX, OY, PLAY_COLS, PLAY_ROWS)

    ctx.save()
    ctx.beginPath(); ctx.rect(OX, OY, PW, PH); ctx.clip()

    for (let i = 0; i < 4; i++) {
      const pad = PAD_RECTS[i]
      const col = PAD_COLORS[i]
      const px = OX + pad.x * CELL
      const py = OY + pad.y * CELL
      const pw = pad.w * CELL
      const ph = pad.h * CELL
      const rad = 6

      const isLit = lit === i || allLit
      const isWrong = wrongPad === i
      const isInputFlash = inputFlashRef.current.dir === i && timestamp < inputFlashRef.current.until

      if (isWrong) {
        ctx.shadowBlur = 20
        ctx.shadowColor = alpha('danger', 0.8)
        ctx.fillStyle = alpha('danger', 0.45)
      } else if (isLit || isInputFlash) {
        ctx.shadowBlur = 18
        ctx.shadowColor = col
        ctx.fillStyle = col + '70'
      } else {
        ctx.shadowBlur = 0
        ctx.fillStyle = col + '0c'
      }

      ctx.beginPath()
      ctx.moveTo(px + rad, py)
      ctx.lineTo(px + pw - rad, py); ctx.quadraticCurveTo(px + pw, py, px + pw, py + rad)
      ctx.lineTo(px + pw, py + ph - rad); ctx.quadraticCurveTo(px + pw, py + ph, px + pw - rad, py + ph)
      ctx.lineTo(px + rad, py + ph); ctx.quadraticCurveTo(px, py + ph, px, py + ph - rad)
      ctx.lineTo(px, py + rad); ctx.quadraticCurveTo(px, py, px + rad, py)
      ctx.closePath()
      ctx.fill()
      ctx.shadowBlur = 0

      ctx.strokeStyle = isLit || isInputFlash ? col + '88' : isWrong ? alpha('danger', 0.5) : col + '18'
      ctx.lineWidth = isLit || isInputFlash ? 2 : 1
      ctx.stroke()

      ctx.fillStyle = isLit || isInputFlash ? palette.white : isWrong ? alpha('danger', 0.6) : col + '30'
      ctx.font = `700 ${isLit ? 28 : 22}px "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", 'Noto Sans SC Variable', monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(PAD_LABELS[i], px + pw / 2, py + ph / 2)
    }

    const hubX = OX + 12 * CELL
    const hubY = OY + 5.5 * CELL
    const hubW = 16 * CELL
    const hubH = 8 * CELL

    ctx.fillStyle = palette.canvasBg
    ctx.fillRect(hubX + 1, hubY + 1, hubW - 2, hubH - 2)
    ctx.strokeStyle = alpha('white', 0.06)
    ctx.lineWidth = 1
    ctx.strokeRect(hubX + 0.5, hubY + 0.5, hubW - 1, hubH - 1)

    const hcx = hubX + hubW / 2
    const hcy = hubY + hubH / 2

    if (phaseRef.current === 'playing') {
      ctx.fillStyle = alpha('fog', 0.6)
      ctx.font = '700 12px "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Noto Sans SC Variable", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(t('minigames.signal.canvas_round', roundRef.current + 1, totalRounds), hcx, hcy - 24)

      ctx.fillStyle = alpha('fog', 0.25)
      ctx.font = '9px "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Noto Sans SC Variable", monospace'
      ctx.fillText(t('minigames.signal.canvas_signals', roundRef.current + startLen), hcx, hcy - 10)

      if (sub === 'start' || sub === 'show') {
        const pulse = 0.4 + 0.3 * Math.sin(tick * 0.08)
        ctx.fillStyle = `${alpha('dim', pulse)}`
        ctx.font = '700 14px "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Noto Sans SC Variable", monospace'
        ctx.fillText(t('minigames.signal.canvas_watch'), hcx, hcy + 12)
      } else if (sub === 'input') {
        ctx.fillStyle = palette.green
        ctx.font = '700 14px "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Noto Sans SC Variable", monospace'
        ctx.fillText(t('minigames.signal.canvas_repeat'), hcx, hcy + 12)

        const seqLen = roundRef.current + startLen
        const dotY = hcy + 30
        const dotSpacing = Math.min(14, (hubW - 40) / seqLen)
        const dotsStartX = hcx - ((seqLen - 1) * dotSpacing) / 2
        for (let d = 0; d < seqLen; d++) {
          const dx = dotsStartX + d * dotSpacing
          const done = d < inputIdxRef.current
          ctx.fillStyle = done ? palette.green : alpha('white', 0.12)
          ctx.beginPath(); ctx.arc(dx, dotY, 3, 0, Math.PI * 2); ctx.fill()
        }

        const inputWindowMs = BASE_INPUT_TIME * propInputWin
        const elapsed = timestamp - inputStartRef.current
        const remaining = Math.max(0, 1 - elapsed / inputWindowMs)
        const arcR = 20
        const arcY = hcy + 62

        ctx.strokeStyle = remaining < 0.3 ? alpha('danger', 0.6) : alpha('green', 0.3)
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(hcx, arcY, arcR, -Math.PI / 2, -Math.PI / 2 + remaining * Math.PI * 2)
        ctx.stroke()

        const secsLeft = Math.max(0, (inputWindowMs - elapsed) / 1000)
        ctx.fillStyle = remaining < 0.3 ? palette.danger : alpha('fog', 0.4)
        ctx.font = '10px "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Noto Sans SC Variable", monospace'
        ctx.fillText(t('minigames.signal.canvas_seconds', secsLeft.toFixed(1)), hcx, arcY + 1)
      } else if (sub === 'correct') {
        ctx.shadowBlur = 12
        ctx.shadowColor = alpha('green', 0.8)
        ctx.fillStyle = palette.green
        ctx.font = '700 14px "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", "Noto Sans SC Variable", monospace'
        ctx.fillText(t('minigames.signal.canvas_correct'), hcx, hcy + 12)
        ctx.shadowBlur = 0
      }
    }

    ctx.restore()

    drawBorder(ctx, OX, OY, PW, PH)

    drawScanlines(ctx)
  }, [totalRounds, startLen, propInputWin, phaseRef])

  const gameLoop = useCallback((timestamp: number) => {
    if (phaseRef.current !== 'playing') return

    lastFrameRef.current = timestamp
    tickRef.current++

    const sub = subPhaseRef.current
    const elapsed = timestamp - phaseStartRef.current

    if (sub === 'start') {
      if (elapsed >= START_DELAY) {
        subPhaseRef.current = 'show'
        phaseStartRef.current = timestamp
        activePadRef.current = -1
      }
    }

    else if (sub === 'show') {
      const flashOn = BASE_FLASH_ON / propFlashSpd
      const flashOff = BASE_FLASH_OFF / propFlashSpd
      const cycle = flashOn + flashOff
      const seqLen = roundRef.current + startLen
      const totalFlash = seqLen * cycle
      const totalShow = totalFlash + SHOW_PAUSE

      if (elapsed >= totalShow) {
        subPhaseRef.current = 'input'
        inputIdxRef.current = 0
        inputStartRef.current = timestamp
        activePadRef.current = -1
        addEvent(t('minigames.signal.event_signal_received', seqLen), 'sys')
      } else if (elapsed < totalFlash) {
        const idx = Math.floor(elapsed / cycle)
        const within = elapsed % cycle
        activePadRef.current = within < flashOn ? sequenceRef.current[idx] : -1
      } else {
        activePadRef.current = -1
      }
    }

    else if (sub === 'input') {
      const inputWindowMs = BASE_INPUT_TIME * propInputWin
      const inputElapsed = timestamp - inputStartRef.current

      if (timestamp >= inputFlashRef.current.until) {
        inputFlashRef.current = { dir: -1, until: 0 }
      }

      if (inputElapsed > inputWindowMs) {
        wrongPadRef.current = -1
        livesRef.current--
        setLives(livesRef.current)
        addEvent(t('minigames.signal.event_input_timeout', livesRef.current, t(livesRef.current !== 1 ? 'minigames.signal.word_attempts' : 'minigames.signal.word_attempt')), 'warn')
        if (livesRef.current <= 0) {
          changePhase('dead'); cancelAnimationFrame(rafRef.current); draw(timestamp); return
        }
        subPhaseRef.current = 'start'
        phaseStartRef.current = timestamp
        activePadRef.current = -1
      }
    }

    else if (sub === 'correct') {
      allLitRef.current = elapsed < CORRECT_PAUSE * 0.6

      if (elapsed >= CORRECT_PAUSE) {
        allLitRef.current = false
        roundRef.current++
        setRoundNum(roundRef.current)
        reportProgress(roundRef.current, sequenceRef.current.slice(0, startLen + roundRef.current - 1))

        if (roundRef.current >= totalRounds) {
          addEvent(t('minigames.signal.event_all_complete', totalRounds), 'round')
          changePhase('won'); cancelAnimationFrame(rafRef.current); draw(timestamp); return
        }

        addEvent(t('minigames.signal.event_next_round', roundRef.current, totalRounds, roundRef.current + startLen), 'round')
        subPhaseRef.current = 'show'
        phaseStartRef.current = timestamp
        activePadRef.current = -1
      }
    }

    draw(timestamp)
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [draw, propFlashSpd, propInputWin, totalRounds, addEvent, changePhase, phaseRef, startLen])

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    tickRef.current = 0
    lastFrameRef.current = 0
    roundRef.current = 0
    livesRef.current = propLives
    activePadRef.current = -1
    allLitRef.current = false
    wrongPadRef.current = -1
    inputIdxRef.current = 0
    inputFlashRef.current = { dir: -1, until: 0 }

    const fullLen = startLen + totalRounds - 1
    sequenceRef.current = chal?.sequence ?? Array.from({ length: fullLen }, () => Math.floor(Math.random() * 4))

    subPhaseRef.current = 'start'
    phaseStartRef.current = performance.now()

    setRoundNum(0)
    setLives(propLives)
    changePhase('playing')
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [gameLoop, propLives, totalRounds, startLen, changePhase])

  useEffect(() => {
    const keyToDir = (key: string): number | null => {
      switch (key) {
        case 'ArrowUp': case 'w': case 'W': return 0
        case 'ArrowRight': case 'd': case 'D': return 1
        case 'ArrowDown': case 's': case 'S': return 2
        case 'ArrowLeft': case 'a': case 'A': return 3
        default: return null
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return

      if (phaseRef.current === 'idle' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); startGame(); return
      }
      if (phaseRef.current !== 'playing' || subPhaseRef.current !== 'input') return

      const dir = keyToDir(e.key)
      if (dir === null) return

      e.preventDefault(); e.stopPropagation()

      const expected = sequenceRef.current[inputIdxRef.current]

      if (dir === expected) {
        inputFlashRef.current = { dir, until: performance.now() + INPUT_FLASH_DUR }
        inputIdxRef.current++
        inputStartRef.current = performance.now()
        wrongPadRef.current = -1

        const seqLen = roundRef.current + startLen
        addEvent(t('minigames.signal.event_signal_confirmed', inputIdxRef.current, seqLen), 'input')

        if (inputIdxRef.current >= seqLen) {
          addEvent(t('minigames.signal.event_round_complete', roundRef.current + 1), 'round')
          subPhaseRef.current = 'correct'
          phaseStartRef.current = performance.now()
          activePadRef.current = -1
          inputFlashRef.current = { dir: -1, until: 0 }
        }
      } else {
        wrongPadRef.current = dir
        livesRef.current--
        setLives(livesRef.current)
        addEvent(t('minigames.signal.event_wrong_input', livesRef.current, t(livesRef.current !== 1 ? 'minigames.signal.word_attempts' : 'minigames.signal.word_attempt')), 'warn')

        if (livesRef.current <= 0) {
          changePhase('dead')
          cancelAnimationFrame(rafRef.current)
        } else {
          setTimeout(() => {
            wrongPadRef.current = -1
            subPhaseRef.current = 'start'
            phaseStartRef.current = performance.now()
            activePadRef.current = -1
            inputIdxRef.current = 0
            addEvent(t('minigames.signal.event_replaying', roundRef.current + 1), 'sys')
          }, 500)
        }
      }
    }

    window.addEventListener('keydown', gated(onKey), { capture: true })
    return () => window.removeEventListener('keydown', gated(onKey), { capture: true })
  }, [startGame, phaseRef, addEvent, changePhase, startLen])

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
        idleSubtitle: t('minigames.signal.idle_subtitle'),
        idleDescription: t('minigames.signal.idle_description', totalRounds),
        controlsHint: t('minigames.signal.controls_hint'),
        idleExtra: (
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            {PAD_COLORS.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c, boxShadow: `0 0 4px ${c}44` }} />
                <span style={{ fontSize: 9, color: alpha('fog', 0.3) }}>{t(`minigames.signal.${PAD_NAME_KEYS[i]}`)}</span>
              </div>
            ))}
          </div>
        ),
        deadTitle: t('minigames.signal.dead_title'),
        deadDescription: t('minigames.signal.dead_description'),
        wonTitle: t('minigames.signal.won_title'),
        wonDescription: t('minigames.signal.won_description', totalRounds),
      }}
      hudContent={<>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: alpha('green', 0.7) }}>
          {t('minigames.signal.hud_round', roundNum + 1, totalRounds)}
        </span>
        {propLives > 1 && (
          <LivesDots total={propLives} current={lives} />
        )}
        <ProgressPips total={totalRounds} current={roundNum} phase={phase} />
      </>}
      logTitle={t('minigames.signal.log_title')}
      logRef={logRef}
      logStatusContent={phase === 'playing'
        ? t('minigames.signal.log_status', roundNum + 1, totalRounds)
        : undefined}
      logContent={<>
        {phase === 'idle' && [
          t('minigames.signal.log_idle_module_loaded'),
          t('minigames.signal.log_idle_scanner'),
          t('minigames.signal.log_idle_complexity'),
          t('minigames.signal.log_idle_awaiting'),
        ].map((line, i) => (
          <div key={`idle-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '5px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
          }}>
            <span style={{ fontSize: 10, color: alpha('fog', 0.35), letterSpacing: '0.04em' }}>{line}</span>
          </div>
        ))}

        <EventLog entries={eventLog} badgeMinWidth={36} styles={{
          input: { label: t('minigames.signal.badge_key'), color: palette.green },
          round: { label: t('minigames.signal.badge_round'), color: palette.warn, msg: alpha('warn', 0.6) },
          warn: { label: t('minigames.signal.badge_warn'), color: palette.danger, msg: alpha('danger', 0.65) },
          sys: { label: t('minigames.signal.badge_sys'), color: palette.dim },
        }} />

        {phase === 'won' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
          }}>
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: palette.green, minWidth: 36, flexShrink: 0 }}>{t('minigames.signal.badge_done')}</span>
            <span style={{ fontSize: 9, color: alpha('fog', 0.6), letterSpacing: '0.04em' }}>
              {t('minigames.signal.log_complete', totalRounds)}
            </span>
          </div>
        )}
      </>}
    />
  )
}
