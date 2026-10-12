---@type table Detected framework descriptor (bridge.shared.framework).
local framework = require 'bridge.shared.framework'
---@type table Player resolution helpers (bridge.server.player).
local player = require 'bridge.server.player'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'

-- Job roster adapter for the Business Manager. Qbox goes through qbx_core's group exports (the
-- same calls qbx_management makes - multi-job aware, offline-safe); plain QBCore mirrors
-- qb-management (live players via Functions.SetJob, offline rows via the players.job JSON). ESX is
-- not supported: supported() returns false and the app never appears.

---@type table Employees module; the table returned at end of file.
local employees = {}

---@type boolean Qbox (qbx_core exports) vs plain QBCore.
local QBX = framework.name == 'qb' and framework.isQbx == true

---Can this server run the Business Manager at all?
---@return boolean
function employees.supported()
    return framework.name == 'qb'
end

if framework.name == 'esx' then
    log.warn('boss', 'Business Manager is not supported on ESX - the app will stay hidden')
end

---A job's definition normalised to { name, label, grades = { [level] = { name, isboss } } }, or
---nil for an unknown job. QBCore keys grades by string ('0'), Qbox by integer - both come out
---integer-keyed here.
---@param jobName string
---@return table|nil
function employees.job(jobName)
    local def
    if QBX then
        def = exports.qbx_core:GetJob(jobName)
    else
        def = framework.core.Shared.Jobs[jobName]
    end
    if not def then return nil end
    local grades = {}
    for level, g in pairs(def.grades or {}) do
        local n = tonumber(level)
        if n then grades[n] = { name = g.name or tostring(n), isboss = g.isboss == true } end
    end
    return { name = jobName, label = def.label or jobName, grades = grades }
end

---Is the player the boss of `jobName` right now (primary job + isboss grade)?
---@param src integer
---@param jobName string
---@return boolean
function employees.isBoss(src, jobName)
    local p = player.get(src)
    local j = p and p.PlayerData and p.PlayerData.job
    return j ~= nil and j.name == jobName and j.isboss == true
end

---The player's grade level in their primary job (0 when unknown).
---@param src integer
---@return integer
function employees.gradeOf(src)
    local p = player.get(src)
    local j = p and p.PlayerData and p.PlayerData.job
    return (j and j.grade and tonumber(j.grade.level)) or 0
end

---"First Last" from a charinfo table (string or decoded).
---@param charinfo any
---@return string
local function nameOf(charinfo)
    if type(charinfo) == 'string' then charinfo = json.decode(charinfo) end
    if type(charinfo) ~= 'table' then return '?' end
    return ('%s %s'):format(charinfo.firstname or '?', charinfo.lastname or '')
end

---Online player object by citizenid (nil when offline).
---@param cid string
---@return table|nil
local function onlineByCid(cid)
    if QBX then return exports.qbx_core:GetPlayerByCitizenId(cid) end
    return framework.core.Functions.GetPlayerByCitizenId(cid)
end

---Server id of an online character (nil when offline).
---@param cid string
---@return integer|nil
function employees.sourceOf(cid)
    local p = onlineByCid(cid)
    return p and p.PlayerData.source or nil
end

---Everyone employed in `jobName`: { cid, name, grade, online, onDuty }, highest grade first.
---@param jobName string
---@return table[]
function employees.list(jobName)
    local out = {}
    if QBX then
        for _, m in ipairs(exports.qbx_core:GetGroupMembers(jobName, 'job') or {}) do
            local online = exports.qbx_core:GetPlayerByCitizenId(m.citizenid)
            local p = online or exports.qbx_core:GetOfflinePlayer(m.citizenid)
            if p then
                out[#out + 1] = {
                    cid = m.citizenid, name = nameOf(p.PlayerData.charinfo), grade = tonumber(m.grade) or 0,
                    online = online ~= nil,
                    onDuty = online ~= nil and online.PlayerData.job.name == jobName and online.PlayerData.job.onduty == true,
                }
            end
        end
    else
        local seen = {}
        for _, p in pairs(framework.core.Functions.GetQBPlayers()) do
            local j = p.PlayerData.job
            if j and j.name == jobName then
                seen[p.PlayerData.citizenid] = true
                out[#out + 1] = {
                    cid = p.PlayerData.citizenid, name = nameOf(p.PlayerData.charinfo), grade = tonumber(j.grade and j.grade.level) or 0,
                    online = true, onDuty = j.onduty == true,
                }
            end
        end
        local rows = MySQL.query.await("SELECT citizenid, charinfo, job FROM players WHERE JSON_UNQUOTE(JSON_EXTRACT(job, '$.name')) = ?", { jobName }) --[[@as table[]?]]
        for _, r in ipairs(rows or {}) do
            if not seen[r.citizenid] then
                local j = json.decode(r.job or '{}') or {}
                out[#out + 1] = {
                    cid = r.citizenid, name = nameOf(r.charinfo), grade = tonumber(j.grade and j.grade.level) or 0,
                    online = false, onDuty = false,
                }
            end
        end
    end
    table.sort(out, function(a, b)
        if a.grade ~= b.grade then return a.grade > b.grade end
        return a.name < b.name
    end)
    return out
end

---The grade an employee holds in `jobName` (nil when they aren't employed there).
---@param cid string
---@param jobName string
---@return integer|nil
function employees.gradeIn(cid, jobName)
    for _, e in ipairs(employees.list(jobName)) do
        if e.cid == cid then return e.grade end
    end
    return nil
end

---QBCore offline write: the players.job JSON for `jobName` at `grade` (or unemployed when nil).
---@param cid string
---@param jobName string
---@param grade integer|nil nil = unemployed
local function writeOfflineJob(cid, jobName, grade)
    local jobs = framework.core.Shared.Jobs
    local name = grade and jobName or 'unemployed'
    local def = jobs[name]
    local level = grade or 0
    local g = def and def.grades and (def.grades[tostring(level)] or def.grades[level]) or {}
    local row = {
        name = name, label = def and def.label or name, payment = g.payment or 0, onduty = false,
        isboss = g.isboss == true, grade = { name = g.name or tostring(level), level = level },
    }
    MySQL.update.await('UPDATE players SET job = ? WHERE citizenid = ?', { json.encode(row), cid })
end

---Set an employee's grade in `jobName` (online or offline). Callers enforce the boss rules.
---@param cid string
---@param jobName string
---@param grade integer
---@return boolean ok, string|nil err
function employees.setGrade(cid, jobName, grade)
    if QBX then
        local ok, err = exports.qbx_core:AddPlayerToJob(cid, jobName, grade)
        return ok == true, err and err.message
    end
    local p = onlineByCid(cid)
    if p then return p.Functions.SetJob(jobName, grade) == true, nil end
    writeOfflineJob(cid, jobName, grade)
    return true, nil
end

---Remove an employee from `jobName` (online or offline).
---@param cid string
---@param jobName string
---@return boolean ok, string|nil err
function employees.fire(cid, jobName)
    if QBX then
        local ok, err = exports.qbx_core:RemovePlayerFromJob(cid, jobName)
        return ok == true, err and err.message
    end
    local p = onlineByCid(cid)
    if p then return p.Functions.SetJob('unemployed', 0) == true, nil end
    writeOfflineJob(cid, jobName, nil)
    return true, nil
end

---Hire an ONLINE player into `jobName` at its lowest grade and make it their primary job.
---@param targetSrc integer
---@param jobName string
---@return boolean ok, string|nil err
function employees.hire(targetSrc, jobName)
    local p = player.get(targetSrc)
    if not p then return false, 'player not found' end
    local def = employees.job(jobName)
    local lowest = 0
    if def then
        lowest = math.huge
        for level in pairs(def.grades) do lowest = math.min(lowest, level) end
        if lowest == math.huge then lowest = 0 end
    end
    if QBX then
        local cid = p.PlayerData.citizenid
        local ok, err = exports.qbx_core:AddPlayerToJob(cid, jobName, lowest)
        if not ok then return false, err and err.message end
        ok, err = exports.qbx_core:SetPlayerPrimaryJob(cid, jobName)
        return ok == true, err and err.message
    end
    return p.Functions.SetJob(jobName, lowest) == true, nil
end

return employees
