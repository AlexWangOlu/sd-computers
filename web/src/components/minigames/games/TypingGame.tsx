import { useState, useEffect, useRef, useCallback } from 'react'
import { gated } from '../core/inputGate'
import { CELL, PLAY_ROWS, OX, OY, PW, PH } from '../core/constants'
import type { BaseGameProps } from '../core/types'
import { useGameLifecycle } from '../core/useGameLifecycle'
import { useEventLog } from '../core/useEventLog'
import { EventLog } from '../core/EventLog'
import { drawVoid, drawPlayArea, drawBorder, drawScanlines } from '../core/canvasUtils'
import GameShell from '../core/GameShell'
import { LivesDots } from '../core/HudElements'
import { t } from '@/i18n'
import { palette, alpha } from '@/theme/palette'

const HEX_CHARS = '0123456789abcdef'
const CMD_PARTS = ['sudo', 'chmod', 'grep', 'curl', 'wget', 'ssh', 'kill', 'nmap', 'echo', 'cat', 'sed', 'awk', 'tar', 'ping', 'dig', 'nc']
const CMD_FLAGS = ['-rf', '-xvf', '-la', '-p', '--force', '-9', '-e', '-i', '-o', '-v', '-n', '-q', '-s', '-u']
const CMD_ARGS = ['0x4f2a', '/dev/null', '192.168.1.1', 'root@ghost', '/tmp/.key', '0.0.0.0:8080', '--no-check', 'payload.bin', '::1', '/proc/self']

function genHex(len: number): string {
  let s = '0x'
  for (let i = 0; i < len; i++) s += HEX_CHARS[Math.floor(Math.random() * 16)]
  return s
}

function genCommand(minLen: number): string {
  const parts: string[] = [CMD_PARTS[Math.floor(Math.random() * CMD_PARTS.length)]]
  parts.push(CMD_FLAGS[Math.floor(Math.random() * CMD_FLAGS.length)])
  parts.push(CMD_ARGS[Math.floor(Math.random() * CMD_ARGS.length)])
  let cmd = parts.join(' ')
  while (cmd.length < minLen) {
    cmd += ' ' + CMD_ARGS[Math.floor(Math.random() * CMD_ARGS.length)]
  }
  return cmd.slice(0, Math.max(minLen, cmd.length))
}

function genString(targetLen: number): string {
  if (Math.random() < 0.4) return genHex(targetLen)
  return genCommand(targetLen)
}

interface ActiveString {
  text: string
  spawnAt: number
  timeout: number
}

interface TypingGameProps extends BaseGameProps {
  stringLength?: number
  timePerString?: number
  stringsRequired?: number
  playerLives?: number
  challenge?: unknown
}

export default function TypingGame({
  onWin, onFail, onProgress,
  stringLength: propLen = 10,
  timePerString: propTimeMs = 6000,
  stringsRequired: propTarget = 12,
  playerLives: propLives = 3,
  challenge,
}: TypingGameProps) {

  const chal = challenge as { strings?: string[] } | null | undefined
  const baseLen = Math.max(4, propLen)
  const baseTime = Math.max(2000, propTimeMs)
  const target = Math.max(3, propTarget)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { phase, changePhase, phaseRef, failBarDrained, reportProgress } = useGameLifecycle(onWin, onFail, onProgress)

  const [lives, setLives] = useState(propLives)
  const [completed, setCompleted] = useState(0)
  const { entries: eventLog, addEvent, reset: resetLog, logRef } = useEventLog<'ok' | 'fail' | 'expire' | 'sys'>(40)

  const rafRef = useRef<number>(0)
  const tickRef = useRef(0)
  const lastFrameRef = useRef(0)
  const activeRef = useRef<ActiveString | null>(null)
  const typedRef = useRef('')
  const livesRef = useRef(propLives)
  const completedRef = useRef(0)
  const stringIdxRef = useRef(0)

  const nextString = useCallback((timestamp: number) => {
    const idx = stringIdxRef.current
    const len = baseLen + Math.floor(idx / 2)
    const timeMul = Math.max(0.45, 1 - idx * 0.08)
    const timeout = baseTime * timeMul

    const text = chal?.strings?.[idx] ?? genString(len)
    activeRef.current = { text, spawnAt: timestamp, timeout }
    typedRef.current = ''

    stringIdxRef.current++
  }, [baseLen, baseTime])

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const tick = tickRef.current

    drawVoid(ctx)

    drawPlayArea(ctx, OX, OY, PW, PH)

    ctx.save()
    ctx.beginPath(); ctx.rect(OX, OY, PW, PH); ctx.clip()

    const cx = OX + PW / 2
    const cy = OY + PH / 2

    const active = activeRef.current
    const input = typedRef.current

    if (active && phaseRef.current === 'playing') {
      const elapsed = timestamp - active.spawnAt
      const remaining = Math.max(0, 1 - elapsed / active.timeout)
      const isUrgent = remaining < 0.25

      const barY = OY + 20
      const barW = PW - 80
      const barH = 6
      const barX = OX + 40

      ctx.fillStyle = alpha('white', 0.06)
      ctx.fillRect(barX, barY, barW, barH)

      ctx.fillStyle = isUrgent ? palette.danger : remaining < 0.5 ? palette.warnBright : palette.green
      ctx.shadowBlur = isUrgent ? 8 : 0
      ctx.shadowColor = isUrgent ? palette.danger : 'transparent'
      ctx.fillRect(barX, barY, barW * remaining, barH)
      ctx.shadowBlur = 0

      const secsLeft = Math.max(0, (active.timeout - elapsed) / 1000)
      ctx.fillStyle = isUrgent ? palette.danger : alpha('fog', 0.4)
      ctx.font = '9px "Noto Sans SC Variable", monospace'
      ctx.textAlign = 'right'
      ctx.fillText(t('minigames.typing.canvas_timer', secsLeft.toFixed(1)), barX + barW, barY - 4)

      ctx.fillStyle = alpha('fog', 0.3)
      ctx.font = '9px "Noto Sans SC Variable", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(t('minigames.typing.canvas_inject_payload', completedRef.current + 1, target), cx, cy - 60)

      const targetText = active.text
      const charW = 13
      const totalTextW = targetText.length * charW
      const textStartX = cx - totalTextW / 2

      const boxPad = 12
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(textStartX - boxPad, cy - 30, totalTextW + boxPad * 2, 36)
      ctx.strokeStyle = isUrgent
        ? `${alpha('danger', 0.2 + 0.15 * Math.sin(tick * 0.15))}`
        : alpha('white', 0.06)
      ctx.lineWidth = 1
      ctx.strokeRect(textStartX - boxPad, cy - 30, totalTextW + boxPad * 2, 36)

      ctx.font = 'bold 16px "Noto Sans SC Variable", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      for (let i = 0; i < targetText.length; i++) {
        const charX = textStartX + i * charW + charW / 2
        const charY = cy - 12

        if (i < input.length) {
          if (input[i] === targetText[i]) {
            ctx.fillStyle = palette.green
          } else {
            ctx.fillStyle = palette.danger
          }
        } else if (i === input.length) {
          const pulse = 0.7 + 0.3 * Math.sin(tick * 0.15)
          ctx.fillStyle = `${alpha('white', pulse)}`
        } else {
          ctx.fillStyle = alpha('fog', 0.3)
        }

        ctx.fillText(targetText[i], charX, charY)
      }

      if (input.length < targetText.length) {
        const cursorX = textStartX + input.length * charW
        const pulse = 0.5 + 0.5 * Math.sin(tick * 0.12)
        ctx.fillStyle = `${alpha('green', pulse)}`
        ctx.fillRect(cursorX, cy - 2, charW, 2)
      }

      ctx.fillStyle = alpha('dim', 0.5)
      ctx.font = '10px "Noto Sans SC Variable", monospace'
      ctx.textAlign = 'left'
      ctx.fillText('> ' + input + (Math.floor(tick / 30) % 2 === 0 ? '█' : ''), textStartX - boxPad, cy + 28)

      ctx.fillStyle = alpha('fog', 0.2)
      ctx.font = '8px "Noto Sans SC Variable", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(t('minigames.typing.canvas_chars', targetText.length), cx, cy + 50)

    } else if (phaseRef.current === 'playing' && !active) {
      const pulse = 0.3 + 0.2 * Math.sin(tick * 0.08)
      ctx.fillStyle = `${alpha('dim', pulse)}`
      ctx.font = 'bold 12px "Noto Sans SC Variable", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(t('minigames.typing.canvas_loading'), cx, cy - 10)
    }

    ctx.font = '9px "Noto Sans SC Variable", monospace'
    ctx.textAlign = 'center'
    const rainAlpha = 0.04
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < PLAY_ROWS; row++) {
        const offset = (tick * 0.5 + col * 7 + row * 3) % 50
        if (offset > 2) continue
        const ch = HEX_CHARS[Math.floor((tick + row * 3 + col * 11) / 8) % 16]
        ctx.fillStyle = `${alpha('green', rainAlpha)}`
        ctx.fillText(ch, OX + 14 + col * 12, OY + row * CELL + 14)
        ctx.fillText(ch, OX + PW - 14 - col * 12, OY + row * CELL + 14)
      }
    }

    ctx.restore()

    drawBorder(ctx, OX, OY, PW, PH)

    drawScanlines(ctx)
  }, [target])

  const gameLoop = useCallback((timestamp: number) => {
    if (phaseRef.current !== 'playing') return

    lastFrameRef.current = timestamp
    tickRef.current++

    const active = activeRef.current
    if (active && timestamp - active.spawnAt >= active.timeout) {
      activeRef.current = null
      livesRef.current--
      setLives(livesRef.current)
      const snippet = active.text.slice(0, 20) + (active.text.length > 20 ? '...' : '')
      addEvent(t('minigames.typing.event_expired', snippet, livesRef.current), 'expire')

      if (livesRef.current <= 0) {
        changePhase('dead'); cancelAnimationFrame(rafRef.current); draw(timestamp); return
      }
      setTimeout(() => {
        if (phaseRef.current === 'playing') nextString(performance.now())
      }, 400)
    }

    if (!activeRef.current && stringIdxRef.current === 0) {
      nextString(timestamp)
    }

    draw(timestamp)
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [draw, nextString, addEvent, changePhase, phaseRef])

  const handleKey = useCallback((key: string) => {
    const active = activeRef.current
    if (!active) return

    const current = typedRef.current
    const expected = active.text

    if (key === 'Backspace') {
      if (current.length > 0) {
        typedRef.current = current.slice(0, -1)
      }
      return
    }

    if (key.length !== 1) return

    const newTyped = current + key
    typedRef.current = newTyped

    if (newTyped === expected) {
      completedRef.current++
      setCompleted(completedRef.current)
      reportProgress(completedRef.current, expected)
      const elapsed = performance.now() - active.spawnAt
      const wpm = Math.round((expected.length / 5) / (elapsed / 60000))
      const snippet = expected.slice(0, 24) + (expected.length > 24 ? '..' : '')
      addEvent(t('minigames.typing.event_injected', snippet, (elapsed / 1000).toFixed(1), wpm), 'ok')
      activeRef.current = null

      if (completedRef.current >= target) {
        changePhase('won'); cancelAnimationFrame(rafRef.current)
        return
      }

      setTimeout(() => {
        if (phaseRef.current === 'playing') nextString(performance.now())
      }, 350)
    } else if (newTyped.length >= expected.length && newTyped !== expected) {
      livesRef.current--
      setLives(livesRef.current)
      addEvent(t('minigames.typing.event_rejected', livesRef.current), 'fail')
      activeRef.current = null

      if (livesRef.current <= 0) {
        changePhase('dead'); cancelAnimationFrame(rafRef.current)
        return
      }

      setTimeout(() => {
        if (phaseRef.current === 'playing') nextString(performance.now())
      }, 400)
    }
  }, [target, nextString, addEvent, changePhase, phaseRef])

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    tickRef.current = 0
    lastFrameRef.current = 0
    livesRef.current = propLives
    completedRef.current = 0
    stringIdxRef.current = 0
    activeRef.current = null
    typedRef.current = ''

    setLives(propLives)
    setCompleted(0)
    resetLog()
    addEvent(t('minigames.typing.event_ready', target), 'sys')
    changePhase('playing')
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [gameLoop, propLives, target, addEvent, resetLog, changePhase])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (phaseRef.current === 'idle' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); startGame(); return
      }
      if (phaseRef.current !== 'playing') return

      e.preventDefault(); e.stopPropagation()
      handleKey(e.key)
    }

    window.addEventListener('keydown', gated(onDown), { capture: true })
    return () => window.removeEventListener('keydown', gated(onDown), { capture: true })
  }, [startGame, handleKey, phaseRef])

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
        idleSubtitle: t('minigames.typing.idle_subtitle'),
        idleDescription: t('minigames.typing.idle_description', target),
        controlsHint: t('minigames.typing.controls_hint'),
        deadTitle: t('minigames.typing.dead_title'),
        deadDescription: t('minigames.typing.dead_description'),
        wonTitle: t('minigames.typing.won_title'),
        wonDescription: t('minigames.typing.won_description', target),
      }}
      hudContent={<>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: alpha('green', 0.7) }}>
          {completed}/{target}
        </span>
        <LivesDots total={propLives} current={lives} />
        <div style={{ width: 120, height: 8, borderRadius: 2, background: alpha('white', 0.07), overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${Math.max(0, (completed / target) * 100)}%`,
            background: completed >= target - 1 ? palette.green : palette.dim,
            transition: 'width 0.3s ease, background 0.3s',
          }} />
        </div>
      </>}
      logTitle={t('minigames.typing.log_title')}
      logRef={logRef}
      logStatusContent={phase === 'playing'
        ? t('minigames.typing.log_status', completed, target, lives)
        : undefined}
      logContent={<>
        {phase === 'idle' && [
          t('minigames.typing.log_idle_module_loaded'),
          t('minigames.typing.log_idle_buffer_ready'),
          t('minigames.typing.log_idle_complexity'),
          t('minigames.typing.log_idle_awaiting'),
        ].map((line, i) => (
          <div key={`idle-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '5px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
          }}>
            <span style={{ fontSize: 10, color: alpha('fog', 0.35), letterSpacing: '0.04em' }}>{line}</span>
          </div>
        ))}

        <EventLog entries={eventLog} badgeMinWidth={36} styles={{
          ok: { label: t('minigames.typing.badge_ok'), color: palette.green },
          fail: { label: t('minigames.typing.badge_fail'), color: palette.danger, msg: alpha('danger', 0.65) },
          expire: { label: t('minigames.typing.badge_time'), color: palette.warn, msg: alpha('danger', 0.65) },
          sys: { label: t('minigames.typing.badge_sys'), color: palette.dim },
        }} />

        {phase === 'won' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
          }}>
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: palette.green, minWidth: 36, flexShrink: 0 }}>{t('minigames.typing.badge_done')}</span>
            <span style={{ fontSize: 9, color: alpha('fog', 0.6), letterSpacing: '0.04em' }}>
              {t('minigames.typing.log_complete', target)}
            </span>
          </div>
        )}
      </>}
    />
  )
}
