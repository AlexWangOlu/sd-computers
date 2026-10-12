export const TOP = 1, RIGHT = 2, BOTTOM = 4, LEFT = 8
export function rotateCW(mask: number) { return ((mask << 1) | (mask >> 3)) & 0xF }
export function hasConn(mask: number, dir: number) { return (mask & dir) !== 0 }

const OPP: Record<number, number> = { [TOP]: BOTTOM, [RIGHT]: LEFT, [BOTTOM]: TOP, [LEFT]: RIGHT }
const DX: Record<number, number> = { [TOP]: 0, [RIGHT]: 1, [BOTTOM]: 0, [LEFT]: -1 }
const DY: Record<number, number> = { [TOP]: -1, [RIGHT]: 0, [BOTTOM]: 1, [LEFT]: 0 }
const DIRS = [TOP, RIGHT, BOTTOM, LEFT]

const PIPE_SHAPES = [
  RIGHT | LEFT,
  TOP | BOTTOM,
  TOP | RIGHT,
  RIGHT | BOTTOM,
  BOTTOM | LEFT,
  TOP | LEFT,
  TOP | RIGHT | BOTTOM,
  RIGHT | BOTTOM | LEFT,
  TOP | BOTTOM | LEFT,
  TOP | RIGHT | LEFT,
]

export interface PipeCell {
  connections: number
  isPath: boolean
  isSource: boolean
  isSink: boolean
}

export function generatePuzzle(w: number, h: number): { grid: PipeCell[][]; sourceY: number; sinkY: number } {
  const key = (x: number, y: number) => `${x},${y}`
  const sourceY = Math.floor(Math.random() * h)

  const treeVisited = new Set<string>([key(0, sourceY)])
  const parent = new Map<string, { x: number; y: number }>()
  const stack: { x: number; y: number }[] = [{ x: 0, y: sourceY }]
  while (stack.length > 0) {
    const cur = stack[stack.length - 1]
    const nbrs: { x: number; y: number }[] = []
    for (const dir of DIRS) {
      const nx = cur.x + DX[dir], ny = cur.y + DY[dir]
      if (nx < 0 || nx >= w || ny < 0 || ny >= h || treeVisited.has(key(nx, ny))) continue
      nbrs.push({ x: nx, y: ny })
    }
    if (nbrs.length === 0) { stack.pop(); continue }
    const n = nbrs[Math.floor(Math.random() * nbrs.length)]
    treeVisited.add(key(n.x, n.y))
    parent.set(key(n.x, n.y), cur)
    stack.push(n)
  }

  const pathTo = (x: number, y: number): { x: number; y: number }[] => {
    const out: { x: number; y: number }[] = []
    let c: { x: number; y: number } | undefined = { x, y }
    while (c) { out.push(c); c = parent.get(key(c.x, c.y)) }
    return out.reverse()
  }

  const targetLen = Math.round(w * 2.2)
  let path: { x: number; y: number }[] = []
  let bestScore = Infinity
  for (let y = 0; y < h; y++) {
    const p = pathTo(w - 1, y)
    const score = Math.abs(p.length - targetLen)
    if (score < bestScore) { bestScore = score; path = p }
  }
  const sinkY = path[path.length - 1].y

  const grid: PipeCell[][] = Array.from({ length: h }, () =>
    Array.from({ length: w }, () => ({
      connections: PIPE_SHAPES[Math.floor(Math.random() * PIPE_SHAPES.length)],
      isPath: false, isSource: false, isSink: false,
    }))
  )

  for (let i = 0; i < path.length; i++) {
    const p = path[i]
    let conn = 0
    if (i === 0) conn |= LEFT
    if (i === path.length - 1) conn |= RIGHT
    if (i > 0) {
      const prev = path[i - 1]
      if (prev.x < p.x) conn |= LEFT
      if (prev.x > p.x) conn |= RIGHT
      if (prev.y < p.y) conn |= TOP
      if (prev.y > p.y) conn |= BOTTOM
    }
    if (i < path.length - 1) {
      const next = path[i + 1]
      if (next.x > p.x) conn |= RIGHT
      if (next.x < p.x) conn |= LEFT
      if (next.y > p.y) conn |= BOTTOM
      if (next.y < p.y) conn |= TOP
    }
    grid[p.y][p.x] = { connections: conn, isPath: true, isSource: i === 0, isSink: i === path.length - 1 }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rots = Math.floor(Math.random() * 4)
      let c = grid[y][x].connections
      for (let r = 0; r < rots; r++) c = rotateCW(c)
      grid[y][x].connections = c
    }
  }

  return { grid, sourceY, sinkY }
}

export function floodFill(grid: PipeCell[][], sourceY: number): Set<string> {
  const h = grid.length, w = grid[0].length
  const connected = new Set<string>()
  const queue: { x: number; y: number }[] = []

  if (!hasConn(grid[sourceY][0].connections, LEFT)) return connected
  queue.push({ x: 0, y: sourceY })
  connected.add(`0,${sourceY}`)

  while (queue.length > 0) {
    const { x, y } = queue.shift()!
    const cell = grid[y][x]
    for (const dir of DIRS) {
      if (!hasConn(cell.connections, dir)) continue
      const nx = x + DX[dir], ny = y + DY[dir]
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
      const key = `${nx},${ny}`
      if (connected.has(key)) continue
      if (!hasConn(grid[ny][nx].connections, OPP[dir])) continue
      connected.add(key)
      queue.push({ x: nx, y: ny })
    }
  }
  return connected
}
