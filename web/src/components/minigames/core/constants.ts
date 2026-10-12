
export const CELL = 22
export const CANVAS_COLS = 50
export const CANVAS_ROWS = 21
export const CANVAS_W = CELL * CANVAS_COLS
export const CANVAS_H = CELL * CANVAS_ROWS

export const PLAY_COLS = 40
export const PLAY_ROWS = 19
export const PW = PLAY_COLS * CELL
export const PH = PLAY_ROWS * CELL
export const OX = Math.floor((CANVAS_COLS - PLAY_COLS) / 2) * CELL
export const OY = Math.floor((CANVAS_ROWS - PLAY_ROWS) / 2) * CELL

export const SURVIVAL_SLICE_SEC = 5
