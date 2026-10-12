---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table RPC registration (server.computers.rpc).
local rpc = require 'server.computers.rpc'
---@type table Session helpers (server.computers.session).
local session = require 'server.computers.session'
---@type table System Logs writer (server.computers.logs).
local logs = require 'server.computers.logs'
---@type table Proof-of-play floors + milestone counts (server.computers.proof).
local proof = require 'server.computers.proof'
---@type table Server-seeded puzzles + answer checks (server.computers.challenge).
local challenge = require 'server.computers.challenge'
---@type table Mail delivery, for `mail` rewards (server.computers.mail).
local mail = require 'server.computers.mail'
---@type table Inventory helpers (bridge.server.inventory).
local inventory = require 'bridge.server.inventory'
---@type table Money helpers (bridge.server.money).
local money = require 'bridge.server.money'

-- Hacking. Three ways a minigame runs, ONE verified pipeline (start -> advance -> submit/fail):
--   practice  `hack <game>` in Command Prompt - rewards nothing, logged to the computer.
--   breach    `breach <target>` - every step of a configs/server/targets.lua target, in order; the
--             server pays the reward after the LAST step redeems. Never trusts the client's "I won".
--   library   the StartHack export (any resource): a win mints a one-shot proof the calling
--             resource redeems server-side with ConsumeHackProof (or uses RunHack, which does both).
-- Each run carries sd-deaddrop's two proof layers: a minimum play time + ordered milestones paced no
-- faster than a human (proof.lua), and server-generated puzzle content whose answers are re-checked
-- per milestone (challenge.lua). Skipping the minigame in devtools gets nothing but a log line.

---@type table Hack config (config.Hacks).
local H = config.Hacks

---@class HackRun
---@field src integer
---@field game string
---@field difficulty string
---@field kind 'practice'|'breach'|'library'
---@field instance string|nil computer instance (practice/breach)
---@field breach integer|nil breach id (breach runs)
---@field stepIndex integer|nil which target step this run plays
---@field startedAtMs integer
---@field floor number seconds
---@field steps integer milestones required
---@field progress integer milestones reported
---@field stepGapMs number
---@field lastStepAtMs integer
---@field challengeAnswer table|nil
---@field expiresAt integer os.time

---@type table<integer, HackRun> Live runs by token.
local runs = {}
---@type integer Token sequence.
local runSeq = 0

---@class Breach
---@field src integer
---@field target table the targets.lua entry
---@field instance string
---@field computer string computer id
---@field step integer 1-based index of the next step to play
---@field actor table { cid, name } who opened it (for the log, even after their session is gone)

---@type table<integer, Breach> Live breaches by id.
local breaches = {}
---@type integer Breach id sequence.
local breachSeq = 0
---@type table<string, integer> target id -> os.time() it unlocks after a success.
local targetCooldown = {}
---@type table<integer, table<string, integer>> src -> target id -> os.time() they may retry after a failure.
local failCooldown = {}
---@type table<string, integer> target id -> breach id holding it (exclusive targets).
local holder = {}
---@type table<string, table> proof id -> { src, game, difficulty, elapsed, expiresAt } (library wins).
local proofs = {}
---@type table<integer, integer> src -> GetGameTimer ms of their last run start.
local lastStart = {}

---Difficulty knobs for a game at a difficulty (the server's trusted copy).
---@param game string
---@param difficulty string
---@return table|nil
local function paramsFor(game, difficulty)
    local preset = H.Presets and H.Presets[difficulty]
    return preset and preset[game]
end

---Start one minigame run: validate, rate-limit, derive the proof floor + milestone count + puzzle
---from the trusted params, and mint the token the client must redeem.
---@param src integer
---@param game string
---@param difficulty string
---@param kind 'practice'|'breach'|'library'
---@param extra table|nil { instance?, breach?, stepIndex? }
---@return table|nil data, string|nil err locale key
local function begin(src, game, difficulty, kind, extra)
    local meta = H.Games and H.Games[game]
    if not meta then return nil, 'hack.err_unknown_game' end
    local params = paramsFor(game, difficulty)
    if not params then return nil, 'hack.err_unknown_difficulty' end

    local now = GetGameTimer()
    if lastStart[src] and (now - lastStart[src]) < (H.StartGap or 1.0) * 1000 then return nil, 'err.slow_down' end
    lastStart[src] = now

    -- One live run per player: starting another voids the previous token.
    for token, r in pairs(runs) do
        if r.src == src then runs[token] = nil end
    end

    local floor = proof.floorSeconds(game, params, H.Proof)
    local steps = proof.steps(game, params, H.Proof)
    local ch = challenge.make(game, params)
    runSeq = runSeq + 1
    extra = extra or {}
    runs[runSeq] = {
        src = src, game = game, difficulty = difficulty, kind = kind,
        instance = extra.instance, breach = extra.breach, stepIndex = extra.stepIndex,
        startedAtMs = now, floor = floor, steps = steps, progress = 0,
        stepGapMs = proof.stepGapSeconds(game, params, H.Proof) * 1000, lastStepAtMs = now,
        challengeAnswer = ch and ch.answer, expiresAt = os.time() + (H.TokenTTL or 600),
    }
    log.debug('hack', 'start src=%s kind=%s game=%s/%s floor=%.1fs steps=%d', src, kind, game, difficulty, floor, steps)
    return {
        token = runSeq, game = game, difficulty = difficulty, program = meta.program, label = meta.label,
        params = params, steps = steps, minSeconds = math.ceil(floor), challenge = ch and ch.client,
    }, nil
end

---Is a run still attached to the computer it started on? (practice/breach runs die with the session)
---@param src integer
---@param r HackRun
---@return boolean
local function stillAttached(src, r)
    if r.kind == 'library' then return true end
    local s = session.get(src)
    return s ~= nil and s.signedIn and s.instance == r.instance
end

---Report one in-order milestone (wave cleared, node captured, string typed...). Copied from
---sd-deaddrop's advanceDaemon: must be the NEXT step, within the count, no faster than the game's
---physical inter-milestone gap, and (content games) carry the right server-seeded answer.
---@param src integer
---@param token any
---@param step any
---@param payload any
---@return table result
local function advance(src, token, step, payload)
    local r = type(token) == 'number' and runs[token] or nil
    if not r or r.src ~= src or os.time() > r.expiresAt or not stillAttached(src, r) then return { ok = false } end
    step = math.tointeger(tonumber(step))
    if not step or step ~= r.progress + 1 or step > r.steps then return { ok = false } end
    if (GetGameTimer() - r.lastStepAtMs) < r.stepGapMs then
        log.debug('hack', 'advance reject src=%s game=%s: milestone too fast', src, r.game)
        return { ok = false }
    end
    if not challenge.verify(r.game, r.challengeAnswer, step, payload) then
        log.debug('hack', 'advance reject src=%s game=%s: bad answer', src, r.game)
        return { ok = false }
    end
    r.progress = step
    r.lastStepAtMs = GetGameTimer()
    return { ok = true, data = { progress = r.progress, steps = r.steps } }
end

---Close a breach: release its target, and on failure bench the player + maybe alert police.
---@param id integer breach id
---@param failed boolean
local function endBreach(id, failed)
    local br = breaches[id]
    if not br then return end
    breaches[id] = nil
    if holder[br.target.id] == id then holder[br.target.id] = nil end
    if failed then
        failCooldown[br.src] = failCooldown[br.src] or {}
        failCooldown[br.src][br.target.id] = os.time() + (br.target.failCooldown or 60)
        local a = br.target.alert
        if a and a.onFail and math.random(100) <= (a.chance or 100) then
            TriggerClientEvent('sd-computers:client:alert', br.src, a)
        end
        logs.write(br.instance, {
            level = 'failure', source = 'Security', eventId = logs.EVENT.BREACH_FAIL,
            message = locale('logs.breach_fail', br.target.label or br.target.id),
        }, br.actor)
    end
end

---Pay a target's reward (server-side only; each part independent, a failing part is logged).
---@param src integer
---@param br Breach
local function payReward(src, br)
    local r = br.target.reward or {}
    for _, it in ipairs(r.items or {}) do
        if not inventory.add(src, it.name, it.count or 1, it.metadata) then
            log.warn('hack', 'reward item %s x%s could not be given to src=%s (inventory full?)', it.name, it.count or 1, src)
        end
    end
    if r.money and (r.money.amount or 0) > 0 then
        money.add(src, r.money.type or 'cash', math.floor(r.money.amount), 'sd-computers-breach')
    end
    if r.mail then
        local s = session.get(src)
        local to = s and mail.addressesOf(s.citizenid) or {}
        if #to > 0 then
            mail.sendSystem({ to = to, subject = r.mail.subject, body = r.mail.body, from = r.mail.from })
        end
    end
    local info = { target = br.target.id, computer = br.computer, instance = br.instance }
    if type(r.event) == 'string' and r.event ~= '' then TriggerEvent(r.event, src, info) end
    TriggerEvent('sd-computers:server:breachCompleted', src, info)
end

---Redeem a run: valid live token, floor elapsed, every milestone reported, still at the computer.
---Then: practice logs; breach advances (and pays on the last step); library mints a proof.
---@param src integer
---@param token any
---@return table result
local function submit(src, token)
    local r = type(token) == 'number' and runs[token] or nil
    if not r or r.src ~= src then return { ok = false, error = locale('hack.err_token') } end
    runs[token] = nil
    if os.time() > r.expiresAt then return { ok = false, error = locale('hack.err_token') } end
    local elapsed = (GetGameTimer() - r.startedAtMs) / 1000
    if elapsed < r.floor or r.progress < r.steps then
        log.warn('hack', 'rejected %s win from src=%s: %.1fs/%.1fs floor, %d/%d milestones', r.game, src, elapsed, r.floor, r.progress, r.steps)
        if r.breach then endBreach(r.breach, true) end
        return { ok = false, error = locale('hack.err_rejected') }
    end
    if not stillAttached(src, r) then return { ok = false, error = locale('err.no_session') } end

    local meta = H.Games[r.game]
    if r.kind == 'practice' then
        local s = session.get(src)
        logs.write(r.instance, {
            level = 'information', source = 'Hack', eventId = logs.EVENT.HACK_PRACTICE_OK,
            message = locale('logs.practice_ok', meta.program, r.difficulty, math.floor(elapsed)),
        }, s and session.actor(s))
        return { ok = true, data = { done = true } }
    end

    if r.kind == 'library' then
        local id = ('%08x%08x'):format(math.random(0, 0x7FFFFFFF), math.random(0, 0x7FFFFFFF))
        proofs[id] = { src = src, game = r.game, difficulty = r.difficulty, elapsed = elapsed, expiresAt = os.time() + (H.ProofTTL or 120) }
        return { ok = true, data = { proof = id } }
    end

    local br = breaches[r.breach]
    if not br or br.src ~= src or br.step ~= r.stepIndex then return { ok = false, error = locale('hack.err_token') } end
    br.step = br.step + 1
    if br.step <= #br.target.steps then
        return { ok = true, data = { done = false, next = br.step, total = #br.target.steps } }
    end

    targetCooldown[br.target.id] = os.time() + (br.target.cooldown or 0)
    endBreach(r.breach, false)
    local s = session.get(src)
    logs.write(br.instance, {
        level = 'error', source = 'Security', eventId = logs.EVENT.BREACH_OK,
        message = locale('logs.breach_ok', br.target.label or br.target.id),
    }, s and session.actor(s))
    payReward(src, br)
    log.debug('hack', 'breach %s completed by src=%s', br.target.id, src)
    return { ok = true, data = { done = true, total = #br.target.steps } }
end

---The player lost (or quit) a run.
---@param src integer
---@param token any
---@return table result
local function fail(src, token)
    local r = type(token) == 'number' and runs[token] or nil
    if not r or r.src ~= src then return { ok = true } end
    runs[token] = nil
    if r.kind == 'practice' then
        local s = session.get(src)
        logs.write(r.instance, {
            level = 'warning', source = 'Hack', eventId = logs.EVENT.HACK_PRACTICE_FAIL,
            message = locale('logs.practice_fail', H.Games[r.game].program, r.difficulty),
        }, s and session.actor(s))
    elseif r.kind == 'breach' and r.breach then
        endBreach(r.breach, true)
    end
    return { ok = true }
end

---Targets reachable from a computer id (hidden ones included - callers filter for listing).
---@param computerId string
---@return table[]
local function targetsFor(computerId)
    local out = {}
    for _, t in ipairs(config.Targets or {}) do
        for _, c in ipairs(t.computers or {}) do
            if c == computerId then out[#out + 1] = t; break end
        end
    end
    return out
end

-- ── RPC (app 'cmd') ───────────────────────────────────────────────────────────────────────

---`targets`: the visible targets on this computer with their status.
rpc.register('hack:targets', 'cmd', function(src, s)
    local out = {}
    local now = os.time()
    for _, t in ipairs(targetsFor(s.def.id)) do
        if not t.hidden then
            local cd = (targetCooldown[t.id] or 0) - now
            local mine = failCooldown[src] and failCooldown[src][t.id] or 0
            out[#out + 1] = {
                command = t.command, label = t.label, steps = #(t.steps or {}),
                cooldown = math.max(0, cd, mine - now), busy = holder[t.id] ~= nil and breaches[holder[t.id]] ~= nil,
                requires = t.requires and inventory.label(t.requires.item) or nil,
            }
        end
    end
    return rpc.ok(out)
end)

---`breach <command>`: open a breach on a target. Every gate is server-side: the target must exist on
---THIS computer, the player must pass its groups/cooldowns/exclusivity/item requirement.
---@param payload { command: string }
rpc.register('hack:breach', 'cmd', function(src, s, payload)
    local command = type(payload.command) == 'string' and payload.command:lower() or ''
    local t
    for _, cand in ipairs(targetsFor(s.def.id)) do
        if cand.command == command then t = cand; break end
    end
    if not t or not t.steps or #t.steps == 0 then return rpc.fail('hack.err_no_target', command) end
    if not session.inGroups(src, t.groups) then return rpc.fail('hack.err_denied') end

    local now = os.time()
    if (targetCooldown[t.id] or 0) > now then return rpc.fail('hack.err_target_cooldown', targetCooldown[t.id] - now) end
    local mine = failCooldown[src] and failCooldown[src][t.id]
    if mine and mine > now then return rpc.fail('hack.err_fail_cooldown', mine - now) end
    if t.exclusive ~= false and holder[t.id] and breaches[holder[t.id]] and breaches[holder[t.id]].src ~= src then
        return rpc.fail('hack.err_target_busy')
    end

    local req = t.requires
    if req and req.item then
        local need = req.count or 1
        if inventory.count(src, req.item) < need then return rpc.fail('hack.err_requires', inventory.label(req.item) or req.item) end
        if req.consume and not inventory.remove(src, req.item, need) then return rpc.fail('hack.err_requires', inventory.label(req.item) or req.item) end
    end

    for id, br in pairs(breaches) do
        if br.src == src then endBreach(id, false) end
    end
    breachSeq = breachSeq + 1
    breaches[breachSeq] = { src = src, target = t, instance = s.instance, computer = s.def.id, step = 1, actor = session.actor(s) }
    if t.exclusive ~= false then holder[t.id] = breachSeq end

    local a = t.alert
    if a and math.random(100) <= (a.chance or 100) then
        TriggerClientEvent('sd-computers:client:alert', src, a)
    end
    logs.write(s.instance, {
        level = 'warning', source = 'Security', eventId = logs.EVENT.BREACH_START,
        message = locale('logs.breach_start', t.label or t.id),
    }, session.actor(s))

    local steps = {}
    for i, st in ipairs(t.steps) do
        local meta = H.Games[st.game] or {}
        steps[i] = { game = st.game, difficulty = st.difficulty, program = meta.program, label = meta.label }
    end
    return rpc.ok({ id = breachSeq, label = t.label, steps = steps })
end)

---Start a run: the breach's NEXT step (game picked server-side) or, with no breach, a practice run.
---@param payload { breach?: integer, game?: string, difficulty?: string }
rpc.register('hack:start', 'cmd', function(src, s, payload)
    local id = math.tointeger(tonumber(payload.breach))
    if id then
        local br = breaches[id]
        if not br or br.src ~= src or br.instance ~= s.instance then return rpc.fail('hack.err_token') end
        local st = br.target.steps[br.step]
        if not st then return rpc.fail('hack.err_token') end
        local data, err = begin(src, st.game, st.difficulty, 'breach', { instance = s.instance, breach = id, stepIndex = br.step })
        if not data then return rpc.fail(err) end
        data.step, data.total = br.step, #br.target.steps
        return rpc.ok(data)
    end
    if H.Practice == false then return rpc.fail('hack.err_no_practice') end
    local data, err = begin(src, tostring(payload.game or ''), tostring(payload.difficulty or H.DefaultDifficulty or 'medium'), 'practice', { instance = s.instance })
    if not data then return rpc.fail(err) end
    return rpc.ok(data)
end)

rpc.register('hack:advance', 'cmd', function(src, _, payload) return advance(src, payload.token, payload.step, payload.payload) end)
rpc.register('hack:submit', 'cmd', function(src, _, payload) return submit(src, payload.token) end)
rpc.register('hack:fail', 'cmd', function(src, _, payload) return fail(src, payload.token) end)

---Abandon a breach between steps (CMD closed / Ctrl+C) - counts as a failure.
---@param payload { breach: integer }
rpc.register('hack:abort', 'cmd', function(src, _, payload)
    local id = math.tointeger(tonumber(payload.breach))
    if id and breaches[id] and breaches[id].src == src then endBreach(id, true) end
    return rpc.ok()
end)

-- ── Library (StartHack export - no computer session) ────────────────────────────────────

lib.callback.register('sd-computers:server:libStart', function(src, game, difficulty)
    local data, err = begin(src, tostring(game or ''), tostring(difficulty or H.DefaultDifficulty or 'medium'), 'library')
    if not data then return { ok = false, error = locale(err) } end
    return { ok = true, data = data }
end)
lib.callback.register('sd-computers:server:libAdvance', function(src, token, step, payload) return advance(src, token, step, payload) end)
lib.callback.register('sd-computers:server:libSubmit', function(src, token) return submit(src, token) end)
lib.callback.register('sd-computers:server:libFail', function(src, token) return fail(src, token) end)

---Export: redeem a StartHack proof server-side. One-shot; expires after config.Hacks.ProofTTL.
---Optionally insist on the game / minimum difficulty the run used.
---@param src integer the player who played it
---@param proofId string|nil what StartHack returned on the client
---@param expect? { game?: string, difficulty?: string }
---@return table|false info { game, difficulty, elapsed } or false
local function consumeProof(src, proofId, expect)
    local p = type(proofId) == 'string' and proofs[proofId] or nil
    if not p then return false end
    proofs[proofId] = nil
    if p.src ~= src or os.time() > p.expiresAt then return false end
    if type(expect) == 'table' then
        if expect.game and expect.game ~= p.game then return false end
        if expect.difficulty then
            local rank = { easy = 1, medium = 2, hard = 3 }
            if (rank[p.difficulty] or 0) < (rank[expect.difficulty] or 0) then return false end
        end
    end
    return { game = p.game, difficulty = p.difficulty, elapsed = p.elapsed }
end
exports('ConsumeHackProof', consumeProof)

---Export: run a hack on a player FROM THE SERVER and get a verified result - the simplest
---integration (`if exports['sd-computers']:RunHack(src, 'maze', 'hard') then ... end`). Yields
---until the player wins, loses or quits.
---@param src integer
---@param game string config.Hacks.Games key
---@param difficulty? string 'easy'|'medium'|'hard'
---@return boolean won
exports('RunHack', function(src, game, difficulty)
    difficulty = difficulty or H.DefaultDifficulty or 'medium'
    local proofId = lib.callback.await('sd-computers:client:runHack', src, game, difficulty)
    return consumeProof(src, proofId, { game = game, difficulty = difficulty }) ~= false
end)

-- ── Cleanup ───────────────────────────────────────────────────────────────────────────────

---A closed session abandons its breach (walking away mid-breach is a failed breach).
session.onClose(function(src)
    for id, br in pairs(breaches) do
        if br.src == src then endBreach(id, true) end
    end
    for token, r in pairs(runs) do
        if r.src == src and r.kind ~= 'library' then runs[token] = nil end
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    for token, r in pairs(runs) do if r.src == src then runs[token] = nil end end
    for id, br in pairs(breaches) do if br.src == src then endBreach(id, false) end end
    for id, p in pairs(proofs) do if p.src == src then proofs[id] = nil end end
    failCooldown[src], lastStart[src] = nil, nil
end)

return {}
