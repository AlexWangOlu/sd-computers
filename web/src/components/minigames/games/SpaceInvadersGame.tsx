import { useState, useEffect, useRef, useCallback } from 'react'
import { gated } from '../core/inputGate'
import { PLAY_COLS, PLAY_ROWS, PW, PH, OX, OY } from '../core/constants'
import type { BaseGameProps } from '../core/types'
import { useGameLifecycle } from '../core/useGameLifecycle'
import { useEventLog } from '../core/useEventLog'
import { EventLog } from '../core/EventLog'
import { drawVoid, drawPlayArea, drawPlayGrid, drawBorder, drawScanlines, glowSprite } from '../core/canvasUtils'
import GameShell from '../core/GameShell'
import { TimerDisplay } from '../core/HudElements'
import { t } from '@/i18n'
import { palette, alpha } from '@/theme/palette'

const SHIP_W = 36
const SHIP_H = 14
const BULLET_W = 2
const BULLET_H = 8
const PLAYER_SPEED = 300
const BULLET_SPD = 420
const INV_BULLET_SPD = 200
const ENEMY_W = 22
const ENEMY_H = 14
const BASE_DROP_SPD = 55
const SWOOP_AMP = 40
const SWOOP_FREQ = 2.5

const CITY_BLOCK_W = 48
const CITY_BLOCK_H = 28
const CITY_BLOCK_HP = 4
const CITY_Y = PH - SHIP_H - 16 - CITY_BLOCK_H

const ENEMY_COLORS = [
  palette.alert, '#bf00ff', palette.accent, '#aaff00',
  '#ff0066', palette.warn, '#00ff88', '#8855ff',
]

const BULLET_TRAIL = 12
const BULLET_PAD = 12

function bulletSprite(isPlayer: boolean): HTMLCanvasElement {
  const key = isPlayer ? 'invadersBulletPlayer' : 'invadersBulletEnemy'
  return glowSprite(key, BULLET_W + 2, BULLET_H + BULLET_TRAIL, BULLET_PAD, ctx => {
    const tone = isPlayer ? 'accent' as const : 'alert' as const
    const bulletY = isPlayer ? 0 : BULLET_TRAIL
    const trailY = isPlayer ? BULLET_H : 0
    ctx.shadowBlur = 6
    ctx.shadowColor = palette[tone]
    ctx.fillStyle = palette[tone]
    ctx.fillRect(1, bulletY, BULLET_W, BULLET_H)
    ctx.shadowBlur = 0
    const grad = isPlayer
      ? ctx.createLinearGradient(0, trailY, 0, trailY + BULLET_TRAIL)
      : ctx.createLinearGradient(0, trailY + BULLET_TRAIL, 0, trailY)
    grad.addColorStop(0, alpha(tone, 0.5))
    grad.addColorStop(1, alpha(tone, 0))
    ctx.fillStyle = grad
    ctx.fillRect(0, trailY, BULLET_W + 2, BULLET_TRAIL)
  })
}

type EnemyType = 'swooper' | 'diver' | 'strafer'

interface Enemy {
  x: number; y: number
  baseX: number
  amplitude: number
  frequency: number
  phase: number
  ySpeed: number
  alive: boolean
  colorIdx: number
  type: EnemyType
  diving: boolean
  diveTarget: number
  strafeDir: 1 | -1
  wingAnim: number
}
interface Bullet { x: number; y: number; isPlayer: boolean }
interface CityBlock { x: number; hp: number; maxHp: number }

function rectHit(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by }

function makeCityBlocks(count: number): CityBlock[] {
  const blocks: CityBlock[] = []
  const spacing = PW / (count + 1)
  for (let i = 0; i < count; i++) {
    blocks.push({ x: spacing * (i + 1) - CITY_BLOCK_W / 2, hp: CITY_BLOCK_HP, maxHp: CITY_BLOCK_HP })
  }
  return blocks
}

interface SpaceInvadersProps extends BaseGameProps {
  rows?: number
  cols?: number
  waves?: number
  speed?: number
  timeLimit?: number
  fireRate?: number
  playerLives?: number
  shootCooldown?: number
}

export default function SpaceInvadersGame({
  onWin, onFail, onProgress,
  rows: propRows = 4, cols: propCols = 8,
  waves: propWaves = 3,
  speed = 1.0, timeLimit = 0,
  fireRate = 0.8, playerLives: propLives = 1,
  shootCooldown: propShootCD = 250,
}: SpaceInvadersProps) {
  const numWaves = Math.max(1, Math.min(5, propWaves))
  const enemiesPerWave = Math.max(1, Math.min(8, propRows)) * Math.max(3, Math.min(12, propCols))
  const cityCount = 6

  const groupSize = Math.max(2, Math.min(5, Math.ceil(enemiesPerWave / 8)))
  const spawnIntervalBase = 1.8

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { phase, changePhase, phaseRef, failBarDrained, reportProgress } = useGameLifecycle(onWin, onFail, onProgress)

  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [killCount, setKillCount] = useState(0)
  const [waveNum, setWaveNum] = useState(1)
  const [cityHpDisplay, setCityHpDisplay] = useState(cityCount * CITY_BLOCK_HP)
  const { entries: eventLog, addEvent, reset: resetLog, logRef } = useEventLog<'kill' | 'hit' | 'wave' | 'sys'>(30)
  const rafRef = useRef<number>(0)
  const tickRef = useRef(0)
  const lastFrameRef = useRef(0)
  const gameTimeRef = useRef(0)

  const playerRef = useRef({ x: PW / 2, lives: propLives })
  const enemiesRef = useRef<Enemy[]>([])
  const bulletsRef = useRef<Bullet[]>([])
  const cityBlocksRef = useRef<CityBlock[]>([])
  const keysRef = useRef(new Set<string>())
  const lastShotRef = useRef(0)
  const killCountRef = useRef(0)
  const waveIdxRef = useRef(0)
  const spawnedInWaveRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const totalKilledRef = useRef(0)
  const totalSpawnedRef = useRef(0)

  const spawnGroup = useCallback((count: number, waveIdx: number) => {
    const enemies = enemiesRef.current
    const zone = Math.random()
    for (let i = 0; i < count; i++) {
      let startX: number, baseX: number
      if (zone < 0.33) {
        startX = -20 - i * 30
        baseX = 80 + Math.random() * (PW - 160)
      } else if (zone < 0.66) {
        startX = PW + 20 + i * 30
        baseX = 80 + Math.random() * (PW - 160)
      } else {
        baseX = 60 + Math.random() * (PW - 120)
        startX = baseX + (Math.random() - 0.5) * 80
      }

      const roll = Math.random()
      const diverChance = 0.15 + waveIdx * 0.08
      const straferChance = 0.12 + waveIdx * 0.06
      let type: EnemyType
      if (roll < diverChance) type = 'diver'
      else if (roll < diverChance + straferChance) type = 'strafer'
      else type = 'swooper'

      const amp = type === 'strafer' ? SWOOP_AMP * 0.3
                 : SWOOP_AMP * (0.6 + Math.random() * 0.8)
      const freq = type === 'strafer' ? SWOOP_FREQ * 0.4
                 : SWOOP_FREQ * (0.7 + Math.random() * 0.6)
      const ySpd = type === 'diver' ? BASE_DROP_SPD * speed * (0.4 + Math.random() * 0.3)
                 : type === 'strafer' ? BASE_DROP_SPD * speed * (0.35 + Math.random() * 0.2)
                 : BASE_DROP_SPD * speed * (0.8 + Math.random() * 0.4)

      const aliveBlocks = cityBlocksRef.current.filter(b => b.hp > 0)
      const targetBlock = aliveBlocks.length > 0
        ? aliveBlocks[Math.floor(Math.random() * aliveBlocks.length)]
        : null
      const diveTarget = targetBlock ? targetBlock.x + CITY_BLOCK_W / 2 : PW / 2

      enemies.push({
        x: startX,
        y: -20 - i * 18 - Math.random() * 30,
        baseX: type === 'strafer' ? (Math.random() < 0.5 ? -10 : PW + 10) : baseX,
        amplitude: amp,
        frequency: freq,
        phase: Math.random() * Math.PI * 2,
        ySpeed: ySpd,
        alive: true,
        colorIdx: (waveIdx * 3 + i) % ENEMY_COLORS.length,
        type,
        diving: false,
        diveTarget,
        strafeDir: Math.random() < 0.5 ? 1 : -1,
        wingAnim: Math.random() * Math.PI * 2,
      })
      totalSpawnedRef.current++
    }
  }, [speed])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const tick = tickRef.current

    drawVoid(ctx)
    drawPlayArea(ctx, OX, OY, PW, PH)
    drawPlayGrid(ctx, OX, OY, PLAY_COLS, PLAY_ROWS)
    drawBorder(ctx, OX, OY, PW, PH)

    ctx.save()
    ctx.beginPath(); ctx.rect(OX, OY, PW, PH); ctx.clip()

    cityBlocksRef.current.forEach(block => {
      if (block.hp <= 0) return
      const bx = OX + block.x
      const by = OY + CITY_Y
      const hpRatio = block.hp / block.maxHp

      const fillAlpha = 0.3 + 0.5 * hpRatio
      const glow = hpRatio > 0.5 ? alpha('green', 0.4) : alpha('danger', 0.4)
      ctx.shadowBlur = 8 * hpRatio
      ctx.shadowColor = glow
      ctx.fillStyle = `${alpha('green', fillAlpha)}`
      ctx.fillRect(bx, by, CITY_BLOCK_W, CITY_BLOCK_H)

      ctx.shadowBlur = 0
      if (hpRatio < 1) {
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'
        ctx.lineWidth = 1
        const cracks = block.maxHp - block.hp
        for (let ci = 0; ci < cracks; ci++) {
          const cx = bx + 6 + (ci * 13) % (CITY_BLOCK_W - 12)
          const cy = by + 4 + (ci * 7) % (CITY_BLOCK_H - 8)
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + 5 + ci * 2, cy + 6 + ci)
          ctx.lineTo(cx + 2, cy + 10 + ci * 2)
          ctx.stroke()
        }
      }

      const barW = CITY_BLOCK_W
      const barH = 3
      const barY = by + CITY_BLOCK_H + 2
      ctx.fillStyle = alpha('white', 0.06)
      ctx.fillRect(bx, barY, barW, barH)
      ctx.fillStyle = hpRatio > 0.5 ? alpha('green', 0.6) : hpRatio > 0.25 ? alpha('warnBright', 0.6) : alpha('danger', 0.6)
      ctx.fillRect(bx, barY, barW * hpRatio, barH)

      ctx.fillStyle = `${alpha('green', 0.2 + 0.3 * hpRatio)}`
      ctx.font = '700 7px "JetBrains Mono Variable","JetBrains Mono","Fira Code",monospace'
      ctx.textAlign = 'center'
      ctx.fillText(t('minigames.firewall.node_label'), bx + CITY_BLOCK_W / 2, by - 3)
      ctx.textAlign = 'start'
    })

    enemiesRef.current.forEach(en => {
      if (!en.alive) return
      const ex = OX + en.x - ENEMY_W / 2
      const ey = OY + en.y - ENEMY_H / 2
      const color = ENEMY_COLORS[en.colorIdx]
      const pulse = 0.3 + 0.2 * Math.sin(tick * 0.08 + en.phase)
      const wingBeat = Math.sin(tick * 0.18 + en.wingAnim)

      ctx.shadowBlur = 10 + 4 * pulse
      ctx.shadowColor = color
      ctx.fillStyle = color

      if (en.type === 'swooper') {
        const cx = ex + ENEMY_W / 2
        const cy = ey + ENEMY_H / 2
        ctx.beginPath()
        ctx.ellipse(cx, cy, ENEMY_W * 0.28, ENEMY_H * 0.45, 0, 0, Math.PI * 2)
        ctx.fill()
        const wingSpread = 4 + wingBeat * 3
        ctx.beginPath()
        ctx.moveTo(cx - 3, cy - 2)
        ctx.lineTo(cx - ENEMY_W * 0.55, cy - wingSpread)
        ctx.lineTo(cx - ENEMY_W * 0.35, cy + 2)
        ctx.closePath()
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(cx + 3, cy - 2)
        ctx.lineTo(cx + ENEMY_W * 0.55, cy - wingSpread)
        ctx.lineTo(cx + ENEMY_W * 0.35, cy + 2)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.fillStyle = '#000'
        ctx.beginPath(); ctx.arc(cx - 3, cy - 2, 1.5, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(cx + 3, cy - 2, 1.5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = color
        ctx.globalAlpha = 0.6
        ctx.beginPath()
        ctx.moveTo(cx - 2, cy + ENEMY_H * 0.4)
        ctx.lineTo(cx, cy + ENEMY_H * 0.7)
        ctx.lineTo(cx + 2, cy + ENEMY_H * 0.4)
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1

      } else if (en.type === 'diver') {
        const cx = ex + ENEMY_W / 2
        const diveGlow = en.diving ? 0.7 + 0.3 * Math.sin(tick * 0.25) : 0
        if (en.diving) {
          ctx.shadowBlur = 18
          ctx.shadowColor = palette.alert
        }
        ctx.beginPath()
        ctx.moveTo(cx, ey)
        ctx.lineTo(cx + ENEMY_W * 0.5, ey + ENEMY_H * 0.7)
        ctx.lineTo(cx + ENEMY_W * 0.25, ey + ENEMY_H)
        ctx.lineTo(cx, ey + ENEMY_H * 0.75)
        ctx.lineTo(cx - ENEMY_W * 0.25, ey + ENEMY_H)
        ctx.lineTo(cx - ENEMY_W * 0.5, ey + ENEMY_H * 0.7)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
        if (en.diving) {
          const trailAlpha = 0.3 + diveGlow * 0.4
          const grad = ctx.createLinearGradient(cx, ey + ENEMY_H, cx, ey + ENEMY_H + 16)
          grad.addColorStop(0, `${alpha('alert', trailAlpha)}`)
          grad.addColorStop(1, alpha('alert', 0))
          ctx.fillStyle = grad
          ctx.fillRect(cx - 4, ey + ENEMY_H, 8, 16)
          ctx.fillStyle = color
        }
        ctx.fillStyle = en.diving ? '#ff0' : '#000'
        ctx.fillRect(cx - 4, ey + ENEMY_H * 0.3, 8, 2)

      } else {
        const scx = ex + ENEMY_W / 2
        const scy = ey + ENEMY_H / 2
        ctx.beginPath()
        ctx.moveTo(scx - ENEMY_W * 0.45, scy - ENEMY_H * 0.25)
        ctx.lineTo(scx + ENEMY_W * 0.45, scy - ENEMY_H * 0.25)
        ctx.lineTo(scx + ENEMY_W * 0.35, scy + ENEMY_H * 0.25)
        ctx.lineTo(scx - ENEMY_W * 0.35, scy + ENEMY_H * 0.25)
        ctx.closePath()
        ctx.fill()
        const enginePulse = 0.5 + 0.5 * Math.sin(tick * 0.15 + en.phase)
        ctx.globalAlpha = 0.5 + 0.3 * enginePulse
        ctx.beginPath()
        ctx.moveTo(scx - ENEMY_W * 0.45, scy - ENEMY_H * 0.15)
        ctx.lineTo(scx - ENEMY_W * 0.6, scy)
        ctx.lineTo(scx - ENEMY_W * 0.45, scy + ENEMY_H * 0.15)
        ctx.closePath()
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(scx + ENEMY_W * 0.45, scy - ENEMY_H * 0.15)
        ctx.lineTo(scx + ENEMY_W * 0.6, scy)
        ctx.lineTo(scx + ENEMY_W * 0.45, scy + ENEMY_H * 0.15)
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.shadowBlur = 0
        ctx.fillStyle = '#000'
        ctx.beginPath()
        ctx.ellipse(scx, scy, 3, 2, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.strokeStyle = color + Math.floor(pulse * 200).toString(16).padStart(2, '0')
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.arc(ex + ENEMY_W / 2, ey + ENEMY_H / 2, ENEMY_W * 0.55 + pulse * 3, 0, Math.PI * 2)
      ctx.stroke()
    })

    bulletsRef.current.forEach(b => {
      const sprite = bulletSprite(b.isPlayer)
      const sx = OX + b.x - BULLET_W / 2 - 1 - BULLET_PAD
      const sy = OY + b.y - (b.isPlayer ? 0 : BULLET_TRAIL) - BULLET_PAD
      ctx.drawImage(sprite, sx, sy)
    })

    const alive = phaseRef.current === 'playing' || phaseRef.current === 'won'
    if (alive) {
      const px = OX + playerRef.current.x - SHIP_W / 2
      const py = OY + PH - SHIP_H - 8
      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.1)
      ctx.shadowBlur = 12 + 6 * pulse
      ctx.shadowColor = palette.accent
      ctx.fillStyle = palette.accent

      ctx.beginPath()
      ctx.moveTo(px + SHIP_W / 2, py)
      ctx.lineTo(px + SHIP_W, py + SHIP_H)
      ctx.lineTo(px + SHIP_W - 6, py + SHIP_H - 3)
      ctx.lineTo(px + 6, py + SHIP_H - 3)
      ctx.lineTo(px, py + SHIP_H)
      ctx.closePath()
      ctx.fill()
      ctx.shadowBlur = 0

      ctx.fillStyle = '#000d18'
      ctx.beginPath()
      ctx.arc(px + SHIP_W / 2, py + 6, 3, 0, Math.PI * 2)
      ctx.fill()

      const lives = playerRef.current.lives
      if (lives > 1) {
        for (let li = 0; li < lives - 1; li++) {
          const lx = OX + 10 + li * 16
          const ly = OY + PH - 12
          ctx.fillStyle = alpha('accent', 0.5)
          ctx.beginPath()
          ctx.moveTo(lx + 5, ly); ctx.lineTo(lx + 10, ly + 6); ctx.lineTo(lx, ly + 6)
          ctx.closePath(); ctx.fill()
        }
      }
    }

    const lineY = OY + PH - 4
    ctx.strokeStyle = `${alpha('accent', 0.15 + 0.05 * Math.sin(tick * 0.05))}`
    ctx.lineWidth = 1; ctx.setLineDash([4, 8])
    ctx.beginPath(); ctx.moveTo(OX, lineY); ctx.lineTo(OX + PW, lineY); ctx.stroke()
    ctx.setLineDash([])

    ctx.restore()

    drawScanlines(ctx)
  }, [])

  const damageCity = useCallback((enemyX: number): boolean => {
    const blocks = cityBlocksRef.current
    let closest: CityBlock | null = null
    let closestDist = Infinity
    for (const b of blocks) {
      if (b.hp <= 0) continue
      const cx = b.x + CITY_BLOCK_W / 2
      const dist = Math.abs(enemyX - cx)
      if (dist < closestDist && dist < CITY_BLOCK_W) {
        closest = b
        closestDist = dist
      }
    }
    if (closest) {
      closest.hp--
      let totalHp = 0
      for (const b of blocks) totalHp += Math.max(0, b.hp)
      setCityHpDisplay(totalHp)
      return true
    }
    return false
  }, [])

  const gameLoop = useCallback((timestamp: number) => {
    if (phaseRef.current !== 'playing') return

    const dt = lastFrameRef.current
      ? Math.min((timestamp - lastFrameRef.current) / 16.667, 3)
      : 1
    lastFrameRef.current = timestamp
    tickRef.current++
    gameTimeRef.current += dt / 60

    const player = playerRef.current
    const enemies = enemiesRef.current
    const bullets = bulletsRef.current
    const keys = keysRef.current
    const gt = gameTimeRef.current

    spawnTimerRef.current -= dt / 60
    if (spawnTimerRef.current <= 0 && spawnedInWaveRef.current < enemiesPerWave) {
      const remaining = enemiesPerWave - spawnedInWaveRef.current
      const count = Math.min(groupSize, remaining)
      spawnGroup(count, waveIdxRef.current)
      spawnedInWaveRef.current += count
      spawnTimerRef.current = spawnIntervalBase / speed
    }

    const pspd = PLAYER_SPEED / 60 * dt
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) player.x = Math.max(SHIP_W / 2, player.x - pspd)
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) player.x = Math.min(PW - SHIP_W / 2, player.x + pspd)

    const now = performance.now()
    if ((keys.has(' ') || keys.has('ArrowUp') || keys.has('w') || keys.has('W'))
        && now - lastShotRef.current >= propShootCD) {
      lastShotRef.current = now
      bullets.push({ x: player.x, y: PH - SHIP_H - 10, isPlayer: true })
    }

    const aliveEnemies = enemies.filter(e => e.alive)
    for (const en of aliveEnemies) {
      if (en.type === 'swooper') {
        en.y += en.ySpeed / 60 * dt
        const targetX = en.baseX + Math.sin(gt * en.frequency * Math.PI * 2 + en.phase) * en.amplitude
        en.x += (targetX - en.x) * 0.04 * dt

      } else if (en.type === 'diver') {
        if (!en.diving && en.y > PH * 0.25 && en.y < PH * 0.5) {
          if (Math.random() < 0.008 * dt) en.diving = true
        }
        if (en.diving) {
          en.y += en.ySpeed * 3.5 / 60 * dt
          en.x += (en.diveTarget - en.x) * 0.06 * dt
        } else {
          en.y += en.ySpeed / 60 * dt
          const targetX = en.baseX + Math.sin(gt * en.frequency * Math.PI * 2 + en.phase) * en.amplitude * 1.5
          en.x += (targetX - en.x) * 0.03 * dt
        }

      } else {
        en.y += en.ySpeed / 60 * dt
        en.x += 180 * speed * en.strafeDir / 60 * dt
        if (en.x > PW - ENEMY_W / 2) { en.x = PW - ENEMY_W / 2; en.strafeDir = -1 }
        if (en.x < ENEMY_W / 2) { en.x = ENEMY_W / 2; en.strafeDir = 1 }
        en.y += Math.sin(gt * 3 + en.phase) * 0.3 * dt
      }

      en.x = Math.max(ENEMY_W / 2, Math.min(PW - ENEMY_W / 2, en.x))
    }

    if (aliveEnemies.length > 0) {
      const shootChance = fireRate / 60 * dt
      const onScreen = aliveEnemies.filter(e => e.y > 0 && e.y < CITY_Y)
      if (onScreen.length > 0 && Math.random() < shootChance) {
        const shooter = onScreen[Math.floor(Math.random() * onScreen.length)]
        if (shooter.type === 'strafer') {
          const sx = shooter.x, sy = shooter.y + ENEMY_H / 2
          bullets.push({ x: sx, y: sy, isPlayer: false })
          bullets.push({ x: sx - 12, y: sy - 4, isPlayer: false })
          bullets.push({ x: sx + 12, y: sy - 4, isPlayer: false })
        } else if (shooter.type === 'diver' && shooter.diving) {
          bullets.push({ x: shooter.x, y: shooter.y + ENEMY_H / 2, isPlayer: false })
        } else {
          bullets.push({ x: shooter.x, y: shooter.y + ENEMY_H / 2, isPlayer: false })
        }
      }
    }

    for (const b of bullets) {
      b.y += (b.isPlayer ? -BULLET_SPD : INV_BULLET_SPD) / 60 * dt
    }

    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi]
      if (!b.isPlayer) continue
      for (const en of enemies) {
        if (!en.alive) continue
        if (rectHit(b.x - BULLET_W / 2, b.y, BULLET_W, BULLET_H,
                    en.x - ENEMY_W / 2, en.y - ENEMY_H / 2, ENEMY_W, ENEMY_H)) {
          en.alive = false
          bullets.splice(bi, 1)
          killCountRef.current++
          totalKilledRef.current++
          setKillCount(killCountRef.current)
          addEvent(t('minigames.firewall.event_threat_neutralized', Math.floor(en.x / (PW / 8)) + 1, killCountRef.current), 'kill')
          break
        }
      }
    }

    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi]
      if (b.isPlayer) continue
      for (const block of cityBlocksRef.current) {
        if (block.hp <= 0) continue
        if (rectHit(b.x - BULLET_W / 2, b.y, BULLET_W, BULLET_H,
                    block.x, CITY_Y, CITY_BLOCK_W, CITY_BLOCK_H)) {
          block.hp--
          bullets.splice(bi, 1)
          let totalHp = 0
          for (const bl of cityBlocksRef.current) totalHp += Math.max(0, bl.hp)
          setCityHpDisplay(totalHp)
          const nodeIdx = cityBlocksRef.current.indexOf(block) + 1
          if (block.hp <= 0) {
            addEvent(t('minigames.firewall.event_node_destroyed', nodeIdx), 'hit')
          } else {
            addEvent(t('minigames.firewall.event_node_damaged', nodeIdx, Math.round(block.hp / block.maxHp * 100)), 'hit')
          }
          break
        }
      }
    }

    const playerY = PH - SHIP_H - 8
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi]
      if (b.isPlayer) continue
      if (rectHit(b.x - BULLET_W / 2, b.y, BULLET_W, BULLET_H,
                  player.x - SHIP_W / 2, playerY, SHIP_W, SHIP_H)) {
        bullets.splice(bi, 1)
        player.lives--
        if (player.lives <= 0) {
          changePhase('dead'); cancelAnimationFrame(rafRef.current); draw(); return
        }
      }
    }

    for (const en of aliveEnemies) {
      if (en.y + ENEMY_H / 2 >= CITY_Y) {
        en.alive = true
        damageCity(en.x)
        en.alive = false
        totalKilledRef.current++
        addEvent(t('minigames.firewall.event_packet_breached', Math.floor(en.x / (PW / 8)) + 1), 'hit')
      }
    }

    const anyBlockAlive = cityBlocksRef.current.some(b => b.hp > 0)
    if (!anyBlockAlive) {
      changePhase('dead'); cancelAnimationFrame(rafRef.current); draw(); return
    }

    enemiesRef.current = enemies.filter(e => e.alive)
    bulletsRef.current = bullets.filter(b => b.y > -20 && b.y < PH + 20)

    const waveFullySpawned = spawnedInWaveRef.current >= enemiesPerWave
    const allWaveDead = waveFullySpawned && enemiesRef.current.length === 0

    if (allWaveDead) {
      reportProgress(waveIdxRef.current + 1)
      if (waveIdxRef.current + 1 >= numWaves) {
        changePhase('won'); cancelAnimationFrame(rafRef.current); draw(); return
      }
      waveIdxRef.current++
      spawnedInWaveRef.current = 0
      spawnTimerRef.current = 1.2
      setWaveNum(waveIdxRef.current + 1)
      addEvent(t('minigames.firewall.event_wave_cleared', waveIdxRef.current, waveIdxRef.current + 1), 'wave')
    }

    draw()
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [draw, speed, fireRate, enemiesPerWave, groupSize, spawnIntervalBase, propShootCD, numWaves, spawnGroup, damageCity, addEvent, changePhase, phaseRef])

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    tickRef.current = 0
    lastFrameRef.current = 0
    gameTimeRef.current = 0
    killCountRef.current = 0
    totalKilledRef.current = 0
    totalSpawnedRef.current = 0
    waveIdxRef.current = 0
    spawnedInWaveRef.current = 0
    spawnTimerRef.current = 0.3
    setKillCount(0)
    setWaveNum(1)
    resetLog()

    playerRef.current = { x: PW / 2, lives: propLives }
    enemiesRef.current = []
    bulletsRef.current = []
    cityBlocksRef.current = makeCityBlocks(cityCount)
    setCityHpDisplay(cityCount * CITY_BLOCK_HP)
    lastShotRef.current = 0
    keysRef.current.clear()

    if (timeLimit && timeLimit > 0) setTimeLeft(timeLimit)
    changePhase('playing')
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [gameLoop, propLives, timeLimit, cityCount, resetLog, changePhase])

  useEffect(() => {
    const GAME_KEYS = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','w','W','a','A','s','S','d','D']
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
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [phase, timeLimit, changePhase, phaseRef])

  useEffect(() => {
    draw()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  const maxCityHp = cityCount * CITY_BLOCK_HP
  const cityPct = Math.round(cityHpDisplay / maxCityHp * 100)

  return (
    <GameShell
      canvasRef={canvasRef}
      phase={phase}
      failBarDrained={failBarDrained}
      overlay={{
        idleSubtitle: t('minigames.firewall.idle_subtitle', numWaves, cityCount),
        idleDescription: <>
          {t('minigames.firewall.idle_description')}
          {timeLimit ? t('minigames.firewall.idle_description_time_limit', timeLimit) : ''}
        </>,
        controlsHint: t('minigames.firewall.controls_hint'),
        deadTitle: t('minigames.firewall.dead_title'),
        deadDescription: timeLeft === 0 ? t('minigames.firewall.dead_description_time_expired')
          : cityHpDisplay <= 0 ? t('minigames.firewall.dead_description_nodes_destroyed')
          : t('minigames.firewall.dead_description_compromised'),
        wonTitle: t('minigames.firewall.won_title'),
        wonDescription: <>{t('minigames.firewall.won_description', numWaves)}</>,
      }}
      hudContent={<>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,150,0,0.6)', letterSpacing: '0.08em' }}>
            {t('minigames.firewall.hud_wave')} {waveNum}/{numWaves}
          </span>
        </div>
        {}
        <span style={{ fontSize: 9, color: cityPct > 50 ? alpha('green', 0.6) : cityPct > 25 ? alpha('warnBright', 0.6) : alpha('danger', 0.7), letterSpacing: '0.06em' }}>
          {t('minigames.firewall.hud_nodes')} {cityPct}%
        </span>
        <div style={{ width: 60, height: 4, background: alpha('white', 0.07), borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: `${cityPct}%`, height: '100%', borderRadius: 2, transition: 'width 0.2s ease',
            background: cityPct > 50 ? palette.green : cityPct > 25 ? palette.warnBright : palette.danger,
          }} />
        </div>
        {timeLeft !== null && timeLeft >= 0 && (
          <TimerDisplay timeLeft={timeLeft} />
        )}
        <span style={{ fontSize: 10, color: alpha('fog', 0.35) }}>
          {killCount} {t('minigames.firewall.hud_kills')}
        </span>
      </>}
      logTitle={t('minigames.firewall.log_title')}
      logRef={logRef}
      logStatusContent={phase === 'playing'
        ? t('minigames.firewall.log_status', waveNum, numWaves, killCount, cityPct)
        : undefined}
      logContent={<>
        {phase === 'idle' && [
          t('minigames.firewall.log_idle_module_loaded'),
          t('minigames.firewall.log_idle_waves_inbound', numWaves, enemiesPerWave * numWaves),
          t('minigames.firewall.log_idle_nodes_online', cityCount),
          t('minigames.firewall.log_idle_awaiting'),
        ].map((line, i) => (
          <div key={`idle-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '4px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
          }}>
            <span style={{ fontSize: 10, color: alpha('fog', 0.35), letterSpacing: '0.04em' }}>{line}</span>
          </div>
        ))}

        <EventLog entries={eventLog} badgeMinWidth={32} styles={{
          kill: { label: t('minigames.firewall.badge_kill'), color: palette.green },
          hit: { label: t('minigames.firewall.badge_hit'), color: palette.danger, msg: alpha('danger', 0.65) },
          wave: { label: t('minigames.firewall.badge_wave'), color: palette.warn },
          sys: { label: t('minigames.firewall.badge_sys'), color: palette.dim },
        }} />

        {phase === 'won' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 2px', borderBottom: `1px solid ${alpha('white', 0.04)}`,
          }}>
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: palette.green, minWidth: 32, flexShrink: 0 }}>{t('minigames.firewall.badge_done')}</span>
            <span style={{ fontSize: 9, color: alpha('fog', 0.6), letterSpacing: '0.04em' }}>
              {t('minigames.firewall.log_complete', numWaves)}
            </span>
          </div>
        )}
      </>}
    />
  )
}
