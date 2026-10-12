import { CELL, CANVAS_COLS, CANVAS_ROWS, CANVAS_W, CANVAS_H } from './constants'
import { palette, triple, alpha, type PaletteKey } from '@/theme/palette'

export function drawVoid(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = palette.canvasBg
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.strokeStyle = alpha('green', 0.04)
  ctx.lineWidth = 0.5
  for (let x = 0; x <= CANVAS_COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, CANVAS_H); ctx.stroke()
  }
  for (let y = 0; y <= CANVAS_ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(CANVAS_W, y * CELL); ctx.stroke()
  }
}

export function drawPlayArea(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number, pw: number, ph: number,
  bg = palette.fieldBg,
): void {
  ctx.fillStyle = bg
  ctx.fillRect(ox, oy, pw, ph)
}

export function drawPlayGrid(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number,
  cols: number, rows: number,
  cell: number = CELL,
  lineAlpha = 0.045,
): void {
  const pw = cols * cell
  const ph = rows * cell
  ctx.strokeStyle = `rgba(${triple.green}, ${lineAlpha})`
  ctx.lineWidth = 0.5
  for (let x = 0; x <= cols; x++) {
    ctx.beginPath()
    ctx.moveTo(ox + x * cell, oy)
    ctx.lineTo(ox + x * cell, oy + ph)
    ctx.stroke()
  }
  for (let y = 0; y <= rows; y++) {
    ctx.beginPath()
    ctx.moveTo(ox, oy + y * cell)
    ctx.lineTo(ox + pw, oy + y * cell)
    ctx.stroke()
  }
}

export function drawBorder(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number, pw: number, ph: number,
  key: PaletteKey = 'green',
): void {
  ctx.strokeStyle = alpha(key, 0.12)
  ctx.lineWidth = 6
  ctx.strokeRect(ox + 3, oy + 3, pw - 6, ph - 6)

  ctx.strokeStyle = alpha(key, 0.55)
  ctx.lineWidth = 1
  ctx.strokeRect(ox + 0.5, oy + 0.5, pw - 1, ph - 1)
}

const spriteCache = new Map<string, HTMLCanvasElement>()

export function glowSprite(
  key: string,
  w: number, h: number, pad: number,
  render: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const cached = spriteCache.get(key)
  if (cached) return cached
  const sprite = document.createElement('canvas')
  sprite.width = w + pad * 2
  sprite.height = h + pad * 2
  const ctx = sprite.getContext('2d')!
  ctx.translate(pad, pad)
  render(ctx)
  spriteCache.set(key, sprite)
  return sprite
}

export function drawScanlines(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.globalAlpha = 0.03
  for (let sy = 0; sy < CANVAS_H; sy += 3) {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, sy, CANVAS_W, 1)
  }
  ctx.globalAlpha = 1
  ctx.restore()
}
