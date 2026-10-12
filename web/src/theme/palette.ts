const hex = {
  green: '#88e52b',
  bright: '#b5ff59',
  dim: '#5a9e2e',
  danger: '#f14c4c',
  alert: '#ff3c00',
  warn: '#ff9500',
  warnBright: '#ffaa00',
  accent: '#00e5ff',
  canvasBg: '#070a0e',
  fieldBg: '#0b0f15',
  panelBg: '#0a0d12',
  slate: '#11151b',
  deep: '#0c0f14',
  raise: '#161b24',
  ink: '#08080b',
  white: '#ffffff',
  fog: '#cccccc',
} as const

export type PaletteKey = keyof typeof hex

export const palette: Record<PaletteKey, string> = hex

function hexToTriple(value: string): string {
  const n = parseInt(value.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

export const triple = Object.fromEntries(
  (Object.keys(hex) as PaletteKey[]).map(key => [key, hexToTriple(hex[key])]),
) as Record<PaletteKey, string>

export function alpha(key: PaletteKey, a: number): string {
  return `rgba(${triple[key]}, ${a})`
}
