-- Proof-of-play floor (copied from sd-deaddrop): the server-authoritative minimum play time (seconds)
-- for one hack run, derived from that minigame's difficulty params. submit rejects any completion faster
-- than the floor, so skipping the client-side minigame via devtools saves no time. Pure + stateless
-- (no FiveM natives).

---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'

---@type table Fallback tuning, layered under config.Hacks.Proof. Also the single home of
---the signal timing constants, which MIRROR web SignalGame.tsx - keep them in sync if that game retimes.
local DEFAULTS = {
    MinFloor = 3.0, -- global floor-of-the-floor (seconds): no run is ever accepted faster than this
    Grace = 2.0, -- survival games (cipher, evasion): floor = timeLimit - Grace
    Safety = 0.85, -- throughput floors are multiplied by this so lag/variance never false-rejects a fast run
    SurvivalSlice = 5.0, -- survival games report one progress tick per this many seconds survived; MUST match SURVIVAL_SLICE_SEC (web/src/components/minigames/core/constants.ts) or client tick counts won't line up with the expected step count
    StepGapSafety = 0.9, -- min gap between consecutive milestones is the physical minimum * this (never false-rejects)

    Capture = { perUnit = 0.20 }, -- units = capturesRequired
    Snake = { perUnit = 0.10 }, -- units = nodesRequired (lucky adjacent spawns make this game genuinely fast)
    Typing = { maxCps = 20.0 }, -- floor = stringsRequired*stringLength / maxCps (20 cps ~ 240 WPM, above any human)
    Maze = { perNode = 1.5, perCell = 0.20 }, -- units = dataNodes*perNode + (width+height)*perCell (tuned up: maze ships its answer, so time is the only real bound)
    Pipe = { base = 3.0, perBoard = 4.0 }, -- units = rounds
    Breakout = { perBrick = 0.18 }, -- units = rows*cols, divided by ballSpeed
    Signal = { flashOnMs = 450, flashOffMs = 200, startDelayMs = 600, showPauseMs = 500 }, -- forced flash-show timing
}

---@type table Proof module; the table returned at end of file.
local proof = {}

---Read a numeric field from a possibly-nil table, falling back to a default (guards params/config
---that may be absent or the wrong type).
---@param sub table|nil source table (e.g. params, or cfg.Maze)
---@param key string field name
---@param fallback number value returned when the field is missing or non-numeric
---@return number value
local function num(sub, key, fallback)
    local v = sub and sub[key]
    return type(v) == 'number' and v or fallback
end

---Effective tuning: DEFAULTS with any provided config layered on top, one level deep. Every field
---resolves to a number, so the floor formulas never see nil.
---@param cfg table|nil config.Hacks.Proof (or nil)
---@return table merged effective tuning
local function effective(cfg)
    if type(cfg) ~= 'table' then return DEFAULTS end
    local out = {}
    for k, v in pairs(DEFAULTS) do
        if type(v) == 'table' then
            local sub = {}
            for kk, vv in pairs(v) do sub[kk] = num(cfg[k], kk, vv) end
            out[k] = sub
        else
            out[k] = num(cfg, k, v)
        end
    end
    return out
end

---@type table<string, boolean> Games whose win condition is outlasting a timeLimit; these floor at
---timeLimit - Grace (a legit win literally can't arrive before the timer) and skip the Safety margin.
local SURVIVAL = { cipher = true, evasion = true }

---Raw floor in seconds (pre-Safety, pre-clamp) per config.Hacks.Games key. Each reads the difficulty
---params that game's config block carries. The hard-bound games (firewall, signal, typing) derive
---from a rate that no human can beat, so their floors are physical bounds rather than estimates.
---@type table<string, fun(p: table, c: table): number>
local FLOORS = {
    -- Survival: reach the end of the timer. floor = timeLimit - Grace.
    cipher = function(p, c) return num(p, 'timeLimit', 0) - c.Grace end,
    evasion = function(p, c) return num(p, 'timeLimit', 0) - c.Grace end,

    -- Throughput: complete N units.
    maze = function(p, c)
        return num(p, 'dataNodes', 0) * c.Maze.perNode + (num(p, 'width', 0) + num(p, 'height', 0)) * c.Maze.perCell
    end,
    capture = function(p, c) return num(p, 'capturesRequired', 0) * c.Capture.perUnit end,
    snake = function(p, c) return num(p, 'nodesRequired', 0) * c.Snake.perUnit end,
    pipe = function(p, c) return c.Pipe.base + math.max(1, num(p, 'rounds', 1)) * c.Pipe.perBoard end,
    breakout = function(p, c)
        return (num(p, 'rows', 0) * num(p, 'cols', 0) * c.Breakout.perBrick) / math.max(0.1, num(p, 'ballSpeed', 1))
    end,

    -- Shot-bounded: each of rows*cols*waves invaders needs >= 1 shot, and shots are >= shootCooldown
    -- apart, so total time can't drop below (invaders - 1) * shootCooldown - a hard mathematical bound.
    firewall = function(p, c)
        local invaders = num(p, 'rows', 0) * num(p, 'cols', 0) * math.max(1, num(p, 'waves', 1))
        return math.max(0, invaders - 1) * (num(p, 'shootCooldown', 250) / 1000)
    end,

    -- Keystroke-bounded: stringsRequired*stringLength characters can't be typed faster than maxCps.
    typing = function(p, c)
        local chars = num(p, 'stringsRequired', 0) * num(p, 'stringLength', 0)
        return chars / math.max(1, c.Typing.maxCps)
    end,

    -- Watch-bounded: every round forces a flash-show phase the player must watch before repeating it.
    -- Sum the forced show time across all rounds - the strongest floor, since it's pure unskippable wait.
    signal = function(p, c)
        local rounds = math.max(2, num(p, 'sequenceLength', 2))
        local startLen = math.min(8, math.max(2, num(p, 'startLength', 3)))
        local flashSpeed = math.max(0.1, num(p, 'flashSpeed', 1))
        local perSignal = (c.Signal.flashOnMs + c.Signal.flashOffMs) / flashSpeed
        local ms = 0
        for r = 0, rounds - 1 do
            ms = ms + c.Signal.startDelayMs + (startLen + r) * perSignal + c.Signal.showPauseMs
        end
        return ms / 1000
    end,
}

---@type table<string, fun(p: table, c: table): number> Expected milestone count per game - the
---number of in-order progress checkpoints (waves, nodes, strings, rounds, survival ticks, ...) the
---client must report before submit will accept. Server-authoritative: derived from the same
---trusted config params as the floor, never from the client.
local STEPS = {
    maze = function(p) return math.floor(num(p, 'dataNodes', 0)) end, -- data fragments collected
    capture = function(p) return math.floor(num(p, 'capturesRequired', 1)) end,
    cipher = function(p, c) return math.floor(num(p, 'timeLimit', 0) / c.SurvivalSlice) end, -- survival ticks
    snake = function(p) return math.floor(num(p, 'nodesRequired', 1)) end,
    firewall = function(p) return math.floor(math.max(1, num(p, 'waves', 1))) end, -- waves cleared
    evasion = function(p, c) return math.floor(num(p, 'timeLimit', 0) / c.SurvivalSlice) end, -- survival ticks
    typing = function(p) return math.floor(num(p, 'stringsRequired', 1)) end,
    signal = function(p) return math.floor(math.max(2, num(p, 'sequenceLength', 2))) end, -- rounds repeated
    pipe = function(p) return math.floor(math.max(1, num(p, 'rounds', 1))) end, -- boards solved
    breakout = function(p) return math.floor(num(p, 'rows', 0) * num(p, 'cols', 0)) end, -- bricks cleared
}

---@type table<string, fun(p: table, c: table): number> Minimum seconds between two consecutive
---milestones for each game (pre-StepGapSafety) - a conservative lower bound on the physical time
---the honest player needs between checkpoints, so advance can reject checkpoints reported
---faster than that (which forces a cheat to space them out = reproduce the real timeline). Games
---whose milestones legitimately fire in quick succession or at variable spacing (capture, breakout,
---snake, maze), and single-checkpoint games (pipe defaults to 1 round), return 0 to avoid
---false-rejecting a fast legit run - they rely on count + order + the floor (and, for maze/pipe,
---the content verifier in challenge.lua) instead.
local STEP_GAP = {
    maze = function() return 0 end,   -- fragments can sit close; content-verified per node instead
    capture = function() return 0 end,
    cipher = function(p, c) return c.SurvivalSlice end,
    snake = function() return 0 end,   -- speeds up over time; adjacent food is legitimately fast
    firewall = function(p) return num(p, 'rows', 0) * num(p, 'cols', 0) * (num(p, 'shootCooldown', 250) / 1000) end,
    evasion = function(p, c) return c.SurvivalSlice end,
    typing = function(p, c) return num(p, 'stringLength', 0) / math.max(1, c.Typing.maxCps) end,
    signal = function(p, c)
        local startLen = math.min(8, math.max(2, num(p, 'startLength', 3)))
        local flashSpeed = math.max(0.1, num(p, 'flashSpeed', 1))
        local perSignal = (c.Signal.flashOnMs + c.Signal.flashOffMs) / flashSpeed
        return (c.Signal.startDelayMs + startLen * perSignal + c.Signal.showPauseMs) / 1000
    end,
    pipe = function() return 0 end,   -- often a single board; content-verified by flood-fill instead
    breakout = function() return 0 end,
}

---How many in-order progress checkpoints the client must report for a run of `key` before it can
---be submitted. 0 for an unknown key or non-table params (floor-only, no checkpoint requirement).
---@param key string config.Hacks.Games key
---@param params table|nil that game's config.Hacks.Presets difficulty block
---@param cfg table|nil config.Hacks.Proof
---@return integer steps expected milestone count
function proof.steps(key, params, cfg)
    local c = effective(cfg)
    local fn = STEPS[key]
    if not fn or type(params) ~= 'table' then return 0 end
    return math.max(0, fn(params, c))
end

---The minimum seconds that must elapse between two consecutive milestone reports for `key`. A
---checkpoint arriving sooner than this after the previous one is rejected by advance. 0 means
---no gap is enforced (rapid-milestone games). Always >= 0.
---@param key string config.Hacks.Games key
---@param params table|nil that game's config.Hacks.Presets difficulty block
---@param cfg table|nil config.Hacks.Proof
---@return number gapSeconds minimum seconds between consecutive milestones
function proof.stepGapSeconds(key, params, cfg)
    local c = effective(cfg)
    local fn = STEP_GAP[key]
    if not fn or type(params) ~= 'table' then return 0 end
    local gap = fn(params, c) * c.StepGapSafety
    return gap > 0 and gap or 0
end

---The minimum play time (seconds) the server requires before it will accept a run of `key`.
---Survival games floor at timeLimit - Grace; the rest at a physical throughput bound * Safety. The
---result is always at least MinFloor, and an unknown key or non-table params returns MinFloor - so a
---missing mapping fails safe (over-strict) rather than open (instant-complete).
---@param key string config.Hacks.Games key (maze|capture|cipher|snake|firewall|evasion|typing|signal|pipe|breakout)
---@param params table|nil that game's config.Hacks.Presets difficulty block
---@param cfg table|nil config.Hacks.Proof (defaults are used for any absent field)
---@return number floorSeconds minimum elapsed seconds required to redeem the run
function proof.floorSeconds(key, params, cfg)
    local c = effective(cfg)
    local fn = FLOORS[key]
    if not fn or type(params) ~= 'table' then
        log.debug('proof', 'proof floor fallback key=%s', tostring(key))
        return c.MinFloor
    end
    local raw = fn(params, c)
    if not SURVIVAL[key] then raw = raw * c.Safety end
    if raw < c.MinFloor then return c.MinFloor end
    return raw
end

return proof
