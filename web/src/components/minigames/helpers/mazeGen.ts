export interface MazeCell { n: boolean; e: boolean; s: boolean; w: boolean }

export function generateMaze(w: number, h: number): MazeCell[][] {
  const grid: MazeCell[][] = []
  for (let r = 0; r < h; r++) {
    grid[r] = []
    for (let c = 0; c < w; c++) grid[r][c] = { n: true, e: true, s: true, w: true }
  }
  const visited: boolean[][] = []
  for (let r = 0; r < h; r++) visited[r] = new Array(w).fill(false)

  const stack: [number, number][] = [[0, 0]]
  visited[0][0] = true

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1]
    const nbrs: { dr: number; dc: number; wall: keyof MazeCell; opp: keyof MazeCell }[] = []
    if (r > 0 && !visited[r - 1][c]) nbrs.push({ dr: -1, dc: 0, wall: 'n', opp: 's' })
    if (c < w - 1 && !visited[r][c + 1]) nbrs.push({ dr: 0, dc: 1, wall: 'e', opp: 'w' })
    if (r < h - 1 && !visited[r + 1][c]) nbrs.push({ dr: 1, dc: 0, wall: 's', opp: 'n' })
    if (c > 0 && !visited[r][c - 1]) nbrs.push({ dr: 0, dc: -1, wall: 'w', opp: 'e' })

    if (nbrs.length === 0) { stack.pop(); continue }

    const d = nbrs[Math.floor(Math.random() * nbrs.length)]
    grid[r][c][d.wall] = false
    grid[r + d.dr][c + d.dc][d.opp] = false
    visited[r + d.dr][c + d.dc] = true
    stack.push([r + d.dr, c + d.dc])
  }
  return grid
}

export function placeNodes(
  grid: MazeCell[][], w: number, h: number, count: number,
): { r: number; c: number }[] {
  const candidates: { r: number; c: number; dist: number; walls: number }[] = []
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (r === 0 && c === 0) continue
      if (r === h - 1 && c === w - 1) continue
      const cell = grid[r][c]
      const wallCnt = [cell.n, cell.e, cell.s, cell.w].filter(Boolean).length
      const dist = r + c
      candidates.push({ r, c, dist, walls: wallCnt })
    }
  }
  candidates.sort((a, b) => {
    if (b.walls !== a.walls) return b.walls - a.walls
    return b.dist - a.dist
  })

  const result: { r: number; c: number }[] = []
  const pool = [...candidates]
  for (let i = 0; i < count && pool.length > 0; i++) {
    const range = Math.min(4, pool.length)
    const idx = Math.floor(Math.random() * range)
    const { r, c } = pool.splice(idx, 1)[0]
    result.push({ r, c })
  }
  return result
}
