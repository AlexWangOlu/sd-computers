---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table RPC registration (server.computers.rpc).
local rpc = require 'server.computers.rpc'
---@type table Job roster adapter (server.computers.employees).
local employees = require 'server.computers.employees'
---@type table Job helpers (bridge.server.job).
local job = require 'bridge.server.job'
---@type table Player resolution helpers (bridge.server.player).
local player = require 'bridge.server.player'
---@type table UTF-8-safe clipping (shared.text).
local text = require 'shared.text'

-- Company Board: a job's notice board. Everyone in the job reads it; its bosses post, pin, reword
-- and remove announcements. Which board a call is about is never the client's to say: it is the
-- caller's primary job at that moment, and every query carries that job name - so an announcement
-- of one job can't be read or touched from another. Every endpoint is registered with app 'board',
-- so session.guard has already confirmed the caller is signed in at a computer that gives them the
-- app. Whether they may WRITE is settled again on every write, from the framework, never from
-- what the UI was told when it loaded.

---@type table Board config (config.Board).
local B = config.Board or {}

---@type integer Announcements kept per job.
local MAX_POSTS = math.max(1, math.floor(tonumber(B.MaxPosts) or 50))
---@type integer Characters per headline (the column holds 255).
local MAX_TITLE = math.min(255, math.max(1, math.floor(tonumber(B.MaxTitle) or 80)))
---@type integer Characters per announcement.
local MAX_BODY = math.max(0, math.floor(tonumber(B.MaxBody) or 2000))

---@type table<string, boolean> Jobs that are not a company (config.Board.NoBoard, as a set).
local NO_BOARD = {}
for _, name in ipairs(B.NoBoard or { 'unemployed' }) do NO_BOARD[name] = true end

---@type table Board module; the table returned at end of file.
local board = {}

---Create the table if it doesn't exist, so the resource stays drop-in. Run once at boot.
function board.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS computers_board (
            id         INT          NOT NULL AUTO_INCREMENT,
            job        VARCHAR(64)  NOT NULL,
            title      VARCHAR(255) NOT NULL,
            body       MEDIUMTEXT   NOT NULL,
            author     VARCHAR(96)  NOT NULL,
            author_cid VARCHAR(64)  NULL,
            pinned     TINYINT(1)   NOT NULL DEFAULT 0,
            created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            edited_at  TIMESTAMP    NULL DEFAULT NULL,
            PRIMARY KEY (id),
            KEY idx_job (job, pinned, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
end

-- ── Whose board, and who may write on it ──────────────────────────────────────────────────

---The board a player reads right now: their primary job's. No job, or a job that is not a
---company (config.Board.NoBoard), has none - and nobody has one while the feature is off.
---@param src integer
---@return string|nil jobName
local function boardOf(src)
    if B.Enabled == false then return nil end
    local name = job.getName(src)
    if type(name) ~= 'string' or name == '' or NO_BOARD[name] then return nil end
    return name
end

---May this player write on `jobName`'s board right now? QBCore/Qbox: their primary job at an
---isboss grade. ESX has no such flag: there the boss is whoever holds the grade named 'boss'.
---@param src integer
---@param jobName string
---@return boolean
local function isBoss(src, jobName)
    if employees.supported() then return employees.isBoss(src, jobName) end
    local p = player.get(src)
    local j = p and p.job
    return j ~= nil and j.name == jobName and j.grade_name == 'boss'
end

---A job's display name, with its definition where the framework has a roster adapter. ESX only
---knows the label of the job the player holds, which is the one asked about; else the name does.
---@param src integer
---@param jobName string
---@return string label
---@return table|nil def employees.job(jobName): { name, label, grades }
local function describe(src, jobName)
    if employees.supported() then
        local def = employees.job(jobName)
        return def and def.label or jobName, def
    end
    local p = player.get(src)
    local j = p and p.job
    return j and j.name == jobName and j.label or jobName, nil
end

---The gate every write passes: the caller's own board, the one the UI was showing (`payload.job`:
---someone who changed jobs with the app open must not write on the board they now have instead),
---and only while they are a boss of that job at this moment.
---@param src integer
---@param payload table
---@return string|nil jobName
---@return table|nil refusal the reply to send back when refused
local function writable(src, payload)
    local jobName = boardOf(src)
    if not jobName then return nil, rpc.fail('board.err_no_board') end
    if payload.job ~= nil and payload.job ~= jobName then return nil, rpc.fail('board.err_job_changed') end
    if not isBoss(src, jobName) then return nil, rpc.fail('board.err_not_boss') end
    return jobName, nil
end

-- ── What an announcement may hold ─────────────────────────────────────────────────────────

---A headline from the composer: one line, trimmed, cut to length ('' when nothing is left).
---@param raw any
---@return string
local function titleOf(raw)
    if type(raw) ~= 'string' then return '' end
    local line = raw:gsub('%c', ' ')
    return text.trim(text.clip(text.trim(line), MAX_TITLE))
end

---An announcement's text: its line breaks kept, blanks at the end of a line and runs of empty
---lines tidied away, trimmed, cut to length.
---@param raw any
---@return string
local function bodyOf(raw)
    if type(raw) ~= 'string' then return '' end
    local s = raw:gsub('\r\n?', '\n'):gsub('[ \t]+\n', '\n'):gsub('\n\n\n+', '\n\n')
    return text.trim(text.clip(text.trim(s), MAX_BODY))
end

-- ── Reading ───────────────────────────────────────────────────────────────────────────────

---A job's announcements as the board shows them: pinned first, then newest first.
---@param jobName string
---@return table[] posts { id, title, body, author, pinned, ts, edited? } (ts / edited = unix seconds)
local function postsOf(jobName)
    local rows = MySQL.query.await(
        'SELECT id, title, body, author, pinned, UNIX_TIMESTAMP(created_at) AS ts, UNIX_TIMESTAMP(edited_at) AS edited FROM computers_board WHERE job = ? ORDER BY pinned DESC, id DESC',
        { jobName }) --[[@as table[]?]]
    local out = {}
    for i, r in ipairs(rows or {}) do
        out[i] = {
            id = r.id, title = r.title, body = r.body, author = r.author,
            pinned = r.pinned == true or r.pinned == 1, -- (a TINYINT(1) comes back as either)
            ts = r.ts, edited = r.edited,
        }
    end
    return out
end

---Is announcement `id` on `jobName`'s board? One from another job's board is simply not there.
---@param jobName string
---@param id integer
---@return boolean
local function has(jobName, id)
    return MySQL.scalar.await('SELECT 1 FROM computers_board WHERE id = ? AND job = ?', { id, jobName }) ~= nil
end

---Everyone in the job for the On duty page, highest rank first - or nil where the framework has
---no roster to give (ESX). No citizenids: a colleague's name and rank is all the board shows.
---@param jobName string
---@param def table|nil employees.job(jobName)
---@param myCid string the caller, marked `me`
---@return table[]|nil roster { name, grade, gradeName, online, onDuty, me }
local function rosterOf(jobName, def, myCid)
    if not employees.supported() then return nil end
    local out = {}
    for i, e in ipairs(employees.list(jobName)) do
        local g = def and def.grades[e.grade]
        out[i] = {
            name = e.name, grade = e.grade, gradeName = g and g.name or tostring(e.grade),
            online = e.online, onDuty = e.onDuty, me = e.cid == myCid,
        }
    end
    return out
end

---The board: the job, whether the caller may post, its announcements, the roster where there is
---one, and the limits the composer works to.
rpc.register('board:state', 'board', function(src, s)
    local jobName = boardOf(src)
    if not jobName then return rpc.fail('board.err_no_board') end
    local label, def = describe(src, jobName)
    return rpc.ok({
        job = { name = jobName, label = label },
        canPost = isBoss(src, jobName),
        posts = postsOf(jobName),
        roster = rosterOf(jobName, def, s.citizenid),
        limits = { maxTitle = MAX_TITLE, maxBody = MAX_BODY, maxPosts = MAX_POSTS },
    })
end)

-- ── Writing (bosses; each replies with the board's announcements as they now stand) ───────

---Post an announcement. A board at MaxPosts drops its oldest unpinned announcement to make room;
---one that is pinned from top to bottom has no room to make.
---@param payload { job?: string, title: string, body?: string, pinned?: boolean }
rpc.register('board:post', 'board', function(src, s, payload)
    local jobName, refusal = writable(src, payload)
    if not jobName then return refusal end
    local title, body = titleOf(payload.title), bodyOf(payload.body)
    if title == '' then return rpc.fail('board.err_title') end

    local total = MySQL.scalar.await('SELECT COUNT(*) FROM computers_board WHERE job = ?', { jobName }) or 0
    local over = total - MAX_POSTS + 1
    if over > 0 then
        -- (more than one goes only when MaxPosts was lowered under a fuller board)
        local removed = MySQL.update.await('DELETE FROM computers_board WHERE job = ? AND pinned = 0 ORDER BY id ASC LIMIT ?', { jobName, over })
        if (removed or 0) < 1 then return rpc.fail('board.err_full', MAX_POSTS) end
    end

    local id = MySQL.insert.await(
        'INSERT INTO computers_board (job, title, body, author, author_cid, pinned) VALUES (?, ?, ?, ?, ?, ?)',
        { jobName, title, body, text.clip(s.name, 96), s.citizenid, payload.pinned == true and 1 or 0 })
    if not id then return rpc.fail('err.internal') end
    return rpc.ok({ id = id, posts = postsOf(jobName) })
end)

---Reword an announcement. It keeps its author, its date and its pin; the board marks it edited.
---@param payload { job?: string, id: integer, title: string, body?: string }
rpc.register('board:edit', 'board', function(src, _, payload)
    local jobName, refusal = writable(src, payload)
    if not jobName then return refusal end
    local id = math.tointeger(tonumber(payload.id))
    if not id then return rpc.fail('err.invalid') end
    local title, body = titleOf(payload.title), bodyOf(payload.body)
    if title == '' then return rpc.fail('board.err_title') end
    if not has(jobName, id) then return rpc.fail('board.err_gone') end

    MySQL.update.await('UPDATE computers_board SET title = ?, body = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ? AND job = ?', { title, body, id, jobName })
    return rpc.ok({ posts = postsOf(jobName) })
end)

---Pin an announcement to the top of its board, or let it go back among the others.
---@param payload { job?: string, id: integer, pinned: boolean }
rpc.register('board:pin', 'board', function(src, _, payload)
    local jobName, refusal = writable(src, payload)
    if not jobName then return refusal end
    local id = math.tointeger(tonumber(payload.id))
    if not id or type(payload.pinned) ~= 'boolean' then return rpc.fail('err.invalid') end
    if not has(jobName, id) then return rpc.fail('board.err_gone') end

    MySQL.update.await('UPDATE computers_board SET pinned = ? WHERE id = ? AND job = ?', { payload.pinned and 1 or 0, id, jobName })
    return rpc.ok({ posts = postsOf(jobName) })
end)

---Take an announcement off the board. One that is already gone is no error: it is off the board.
---@param payload { job?: string, id: integer }
rpc.register('board:delete', 'board', function(src, _, payload)
    local jobName, refusal = writable(src, payload)
    if not jobName then return refusal end
    local id = math.tointeger(tonumber(payload.id))
    if not id then return rpc.fail('err.invalid') end

    MySQL.query.await('DELETE FROM computers_board WHERE id = ? AND job = ?', { id, jobName })
    return rpc.ok({ posts = postsOf(jobName) })
end)

return board
