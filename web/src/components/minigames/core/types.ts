export type Phase = 'idle' | 'playing' | 'won' | 'dead'

export interface BaseGameProps {
  onWin: () => void
  onFail?: () => void
  onProgress?: (step: number, payload?: unknown) => void
}
