-- Server-seeded minigame content + answer verification (proof Layer 2, copied from sd-deaddrop). For the games that have a
-- concrete answer, the server GENERATES the puzzle here, sends the client half to the hack window,
-- keeps the answer, and verifies each echoed milestone in advance - so a cheat can't just
-- count checkpoints, it has to return the correct server-seeded answers. Games with no entry below
-- get no challenge and rely on Layer 1 (count + order + pacing) alone.

local challenge = {}

---@type string Hex alphabet for typing content (the client renders whatever we send; charset is cosmetic).
local HEX = '0123456789ABCDEF'

---A random hex string of length n.
---@param n integer length
---@return string
local function randString(n)
    local t = {}
    for i = 1, n do
        local k = math.random(1, #HEX)
        t[i] = HEX:sub(k, k)
    end
    return table.concat(t)
end

-- ── Pipe: spanning-tree routing board + flood-fill verifier (mirror web/helpers/pipeLogic.ts) ──
local PTOP, PRIGHT, PBOTTOM, PLEFT = 1, 2, 4, 8
local PDIRS = { PTOP, PRIGHT, PBOTTOM, PLEFT }
local POPP = { [PTOP] = PBOTTOM, [PRIGHT] = PLEFT, [PBOTTOM] = PTOP, [PLEFT] = PRIGHT }
local PDX = { [PTOP] = 0, [PRIGHT] = 1, [PBOTTOM] = 0, [PLEFT] = -1 }
local PDY = { [PTOP] = -1, [PRIGHT] = 0, [PBOTTOM] = 1, [PLEFT] = 0 }
local PIPE_SHAPES = {
    PRIGHT | PLEFT, PTOP | PBOTTOM, PTOP | PRIGHT, PRIGHT | PBOTTOM, PBOTTOM | PLEFT,
    PTOP | PLEFT, PTOP | PRIGHT | PBOTTOM, PRIGHT | PBOTTOM | PLEFT, PTOP | PBOTTOM | PLEFT, PTOP | PRIGHT | PLEFT,
}

---Rotate a connection mask 90 degrees clockwise.
---@param mask integer
---@return integer
local function rotateCW(mask) return ((mask << 1) | (mask >> 3)) & 0xF end

---Does a mask carry a connection in `dir`?
---@param mask integer
---@param dir integer
---@return boolean
local function hasConn(mask, dir) return (mask & dir) ~= 0 end

---Generate one solvable pipe board. Returns the client half { grid, sourceY, sinkY } (grid is a
---1-based row array of { connections, isPath, isSource, isSink } cells) and the answer half
---{ conns (flat row-major initial masks), sourceY, sinkY, w, h }.
---@param w integer
---@param h integer
---@return table client, table answer
local function pipeBoard(w, h)
    local function key(x, y) return x .. ',' .. y end
    local sourceY = math.random(0, h - 1)
    local visited = { [key(0, sourceY)] = true }
    local parent = {}
    local stack = { { x = 0, y = sourceY } }
    while #stack > 0 do
        local cur = stack[#stack]
        local nbrs = {}
        for _, dir in ipairs(PDIRS) do
            local nx, ny = cur.x + PDX[dir], cur.y + PDY[dir]
            if nx >= 0 and nx < w and ny >= 0 and ny < h and not visited[key(nx, ny)] then
                nbrs[#nbrs + 1] = { x = nx, y = ny }
            end
        end
        if #nbrs == 0 then
            stack[#stack] = nil
        else
            local n = nbrs[math.random(1, #nbrs)]
            visited[key(n.x, n.y)] = true
            parent[key(n.x, n.y)] = cur
            stack[#stack + 1] = n
        end
    end
    local function pathTo(x, y)
        local out = {}
        local c = { x = x, y = y }
        while c do out[#out + 1] = c; c = parent[key(c.x, c.y)] end
        local rev = {}
        for i = #out, 1, -1 do rev[#rev + 1] = out[i] end
        return rev
    end
    local targetLen = math.floor(w * 2.2 + 0.5)
    local path, best = {}, math.huge
    for y = 0, h - 1 do
        local p = pathTo(w - 1, y)
        local score = math.abs(#p - targetLen)
        if score < best then best = score; path = p end
    end
    local sinkY = path[#path].y
    local grid = {}
    for y = 0, h - 1 do
        grid[y] = {}
        for x = 0, w - 1 do
            grid[y][x] = { connections = PIPE_SHAPES[math.random(1, #PIPE_SHAPES)], isPath = false, isSource = false, isSink = false }
        end
    end
    for i = 1, #path do
        local p = path[i]
        local conn = 0
        if i == 1 then conn = conn | PLEFT end
        if i == #path then conn = conn | PRIGHT end
        if i > 1 then
            local prev = path[i - 1]
            if prev.x < p.x then conn = conn | PLEFT end
            if prev.x > p.x then conn = conn | PRIGHT end
            if prev.y < p.y then conn = conn | PTOP end
            if prev.y > p.y then conn = conn | PBOTTOM end
        end
        if i < #path then
            local nxt = path[i + 1]
            if nxt.x > p.x then conn = conn | PRIGHT end
            if nxt.x < p.x then conn = conn | PLEFT end
            if nxt.y > p.y then conn = conn | PBOTTOM end
            if nxt.y < p.y then conn = conn | PTOP end
        end
        grid[p.y][p.x] = { connections = conn, isPath = true, isSource = (i == 1), isSink = (i == #path) }
    end
    for y = 0, h - 1 do
        for x = 0, w - 1 do
            local cc = grid[y][x].connections
            for _ = 1, math.random(0, 3) do cc = rotateCW(cc) end
            grid[y][x].connections = cc
        end
    end
    local gridOut, conns = {}, {}
    for y = 0, h - 1 do
        gridOut[y + 1] = {}
        for x = 0, w - 1 do
            gridOut[y + 1][x + 1] = grid[y][x]
            conns[y * w + x + 1] = grid[y][x].connections
        end
    end
    return { grid = gridOut, sourceY = sourceY, sinkY = sinkY }, { conns = conns, sourceY = sourceY, sinkY = sinkY, w = w, h = h }
end

---Flood the connectivity of a flat connection board from the source, returning a set of "x,y" keys.
---@param conns table flat row-major masks (1-based idx = y*w + x + 1)
---@param w integer
---@param h integer
---@param sourceY integer
---@return table<string, boolean> connected
local function pipeFlood(conns, w, h, sourceY)
    local function at(x, y) return conns[y * w + x + 1] end
    local function ck(x, y) return x .. ',' .. y end
    local connected = {}
    if not hasConn(at(0, sourceY), PLEFT) then return connected end
    local queue = { { x = 0, y = sourceY } }
    connected[ck(0, sourceY)] = true
    local head = 1
    while head <= #queue do
        local cur = queue[head]; head = head + 1
        local mask = at(cur.x, cur.y)
        for _, dir in ipairs(PDIRS) do
            if hasConn(mask, dir) then
                local nx, ny = cur.x + PDX[dir], cur.y + PDY[dir]
                if nx >= 0 and nx < w and ny >= 0 and ny < h then
                    local k = ck(nx, ny)
                    if not connected[k] and hasConn(at(nx, ny), POPP[dir]) then
                        connected[k] = true
                        queue[#queue + 1] = { x = nx, y = ny }
                    end
                end
            end
        end
    end
    return connected
end

-- ── Maze: recursive-backtracker layout + node placement (mirror web/helpers/mazeGen.ts) ──
---Carve a maze; returns a 1-based row array of { n, e, s, w } wall flags.
---@param w integer
---@param h integer
---@return table maze
local function generateMaze(w, h)
    local grid, visited = {}, {}
    for r = 0, h - 1 do
        grid[r], visited[r] = {}, {}
        for c = 0, w - 1 do grid[r][c] = { n = true, e = true, s = true, w = true }; visited[r][c] = false end
    end
    local stack = { { r = 0, c = 0 } }
    visited[0][0] = true
    while #stack > 0 do
        local cur = stack[#stack]
        local r, c = cur.r, cur.c
        local nbrs = {}
        if r > 0 and not visited[r - 1][c] then nbrs[#nbrs + 1] = { dr = -1, dc = 0, wall = 'n', opp = 's' } end
        if c < w - 1 and not visited[r][c + 1] then nbrs[#nbrs + 1] = { dr = 0, dc = 1, wall = 'e', opp = 'w' } end
        if r < h - 1 and not visited[r + 1][c] then nbrs[#nbrs + 1] = { dr = 1, dc = 0, wall = 's', opp = 'n' } end
        if c > 0 and not visited[r][c - 1] then nbrs[#nbrs + 1] = { dr = 0, dc = -1, wall = 'w', opp = 'e' } end
        if #nbrs == 0 then
            stack[#stack] = nil
        else
            local d = nbrs[math.random(1, #nbrs)]
            grid[r][c][d.wall] = false
            grid[r + d.dr][c + d.dc][d.opp] = false
            visited[r + d.dr][c + d.dc] = true
            stack[#stack + 1] = { r = r + d.dr, c = c + d.dc }
        end
    end
    local out = {}
    for r = 0, h - 1 do
        out[r + 1] = {}
        for c = 0, w - 1 do out[r + 1][c + 1] = grid[r][c] end
    end
    return out
end

---Pick `count` fragment cells, favouring high-wall, far cells (mirror placeNodes). Uses the 1-based
---maze from generateMaze; returns { { r, c }, ... } in 0-based coords.
---@param maze table 1-based maze rows
---@param w integer
---@param h integer
---@param count integer
---@return table nodes
local function placeNodes(maze, w, h, count)
    local candidates = {}
    for r = 0, h - 1 do
        for c = 0, w - 1 do
            if not (r == 0 and c == 0) and not (r == h - 1 and c == w - 1) then
                local cell = maze[r + 1][c + 1]
                local walls = (cell.n and 1 or 0) + (cell.e and 1 or 0) + (cell.s and 1 or 0) + (cell.w and 1 or 0)
                candidates[#candidates + 1] = { r = r, c = c, dist = r + c, walls = walls }
            end
        end
    end
    table.sort(candidates, function(a, b)
        if a.walls ~= b.walls then return a.walls > b.walls end
        return a.dist > b.dist
    end)
    local result = {}
    for _ = 1, count do
        if #candidates == 0 then break end
        local idx = math.random(1, math.min(4, #candidates))
        result[#result + 1] = { r = candidates[idx].r, c = candidates[idx].c }
        table.remove(candidates, idx)
    end
    return result
end

---@type table<string, fun(p: table): table> Per-game generator: returns { client = <sent to NUI>,
---answer = <server-only, used by the matching verifier> }.
local GEN = {
    signal = function(p)
        local rounds = math.max(2, math.floor(p.sequenceLength or 6))
        local startLen = math.min(8, math.max(2, math.floor(p.startLength or 3)))
        local full = startLen + rounds - 1
        local seq = {}
        for i = 1, full do seq[i] = math.random(0, 3) end
        return { client = { sequence = seq, startLength = startLen }, answer = { sequence = seq, startLen = startLen } }
    end,
    typing = function(p)
        local n = math.max(1, math.floor(p.stringsRequired or 12))
        local baseLen = math.max(4, math.floor(p.stringLength or 10))
        local strings = {}
        for i = 1, n do strings[i] = randString(baseLen + math.floor((i - 1) / 2)) end
        return { client = { strings = strings }, answer = { strings = strings } }
    end,
    pipe = function(p)
        local w = math.max(5, math.min(10, math.floor(p.gridWidth or 7)))
        local h = math.max(4, math.min(8, math.floor(p.gridHeight or 6)))
        local rounds = math.max(1, math.min(5, math.floor(p.rounds or 1)))
        local clientBoards, answerBoards = {}, {}
        for i = 1, rounds do
            clientBoards[i], answerBoards[i] = pipeBoard(w, h)
        end
        return { client = { boards = clientBoards }, answer = { boards = answerBoards } }
    end,
    maze = function(p)
        local w = math.max(7, math.min(41, math.floor(p.width or 21)))
        local h = math.max(7, math.min(27, math.floor(p.height or 15)))
        local count = math.max(0, math.min(8, math.floor(p.dataNodes or 3)))
        local maze = generateMaze(w, h)
        local nodes = placeNodes(maze, w, h, count)
        return { client = { maze = maze, nodes = nodes }, answer = { nodes = nodes, collected = {} } }
    end,
}

---@type table<string, fun(answer: table, step: integer, payload: any): boolean> Per-game verifier
---for one echoed milestone answer.
local VERIFY = {
    signal = function(answer, step, payload)
        if type(payload) ~= 'table' then return false end
        local need = answer.startLen + step - 1
        if #payload ~= need then return false end
        for i = 1, need do
            if payload[i] ~= answer.sequence[i] then return false end
        end
        return true
    end,
    typing = function(answer, step, payload)
        return type(payload) == 'string' and payload == answer.strings[step]
    end,
    pipe = function(answer, step, payload)
        local board = answer.boards[step]
        if not board or type(payload) ~= 'table' then return false end
        local w, h = board.w, board.h
        if #payload ~= w * h then return false end
        for idx = 1, w * h do
            local v = payload[idx]
            if type(v) ~= 'number' then return false end
            local ok, c = false, board.conns[idx]
            for _ = 1, 4 do
                if c == v then ok = true; break end
                c = rotateCW(c)
            end
            if not ok then return false end
        end
        local connected = pipeFlood(payload, w, h, board.sourceY)
        return connected[(w - 1) .. ',' .. board.sinkY] == true
            and hasConn(payload[board.sinkY * w + (w - 1) + 1], PRIGHT)
    end,
    maze = function(answer, step, payload)
        if type(payload) ~= 'table' or type(payload.r) ~= 'number' or type(payload.c) ~= 'number' then return false end
        local nk = payload.r .. ',' .. payload.c
        if answer.collected[nk] then return false end
        for _, n in ipairs(answer.nodes) do
            if n.r == payload.r and n.c == payload.c then
                answer.collected[nk] = true
                return true
            end
        end
        return false
    end,
}

---Generate a server-seeded challenge for `key`, or nil if this game has no verifiable content.
---@param key string config.Hacks.Games key
---@param params table|nil difficulty params
---@return table|nil challenge { client, answer }
function challenge.make(key, params)
    local g = GEN[key]
    if not g or type(params) ~= 'table' then return nil end
    return g(params)
end

---Verify one echoed milestone answer. Games with no stored answer (progress-only, or a game without
---a verifier) always pass here - their integrity comes from Layer 1. Content games must match exactly.
---@param key string config.Hacks.Games key
---@param answer table|nil the stored server answer for this token (nil = no challenge)
---@param step integer 1-based milestone
---@param payload any the client's echoed answer for this milestone
---@return boolean ok
function challenge.verify(key, answer, step, payload)
    if answer == nil then return true end
    local v = VERIFY[key]
    if not v then return true end
    return v(answer, step, payload)
end

return challenge
