---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table Profile + log persistence (server.computers.store).
local store = require 'server.computers.store'
---@type table UTF-8-safe clipping (shared.text).
local text = require 'shared.text'

---@type table System Logs module; the table returned at end of file.
local logs = {}

---@type table<string, boolean> Event Viewer levels: Information / Warning / Error, plus the
---Security log's Audit Success / Audit Failure.
local LEVELS = { information = true, warning = true, error = true, success = true, failure = true }

---Event ids in the style of a real OS event log (4624 = logon, 4625 = failed logon, ...).
---@type table<string, integer>
logs.EVENT = {
    LOGON = 4624, LOGON_FAILED = 4625, LOGOFF = 4634, LOCKED_OUT = 4740, LOG_CLEARED = 1102,
    APP_START = 1000,
    MAIL_SENT = 3001, MAIL_SIGNIN = 3002, MAIL_SIGNOUT = 3003, MAIL_CREATED = 3004,
    HACK_PRACTICE_OK = 7001, HACK_PRACTICE_FAIL = 7002,
    BREACH_START = 7101, BREACH_OK = 7102, BREACH_FAIL = 7103,
    BOSS_HIRE = 6001, BOSS_FIRE = 6002, BOSS_GRADE = 6003, BOSS_DEPOSIT = 6004, BOSS_WITHDRAW = 6005,
    EXTERNAL = 9000,
}

---Write one entry to a computer's System Logs. Never throws (a bad entry is dropped with a
---warning) and never blocks (the insert is fire-and-forget).
---@param computer string instance id (registry.instanceId)
---@param entry { level: string, source: string, eventId?: integer, message: string, data?: table }
---@param actor? table { cid, name } of who did it (nil for system events)
function logs.write(computer, entry, actor)
    if type(computer) ~= 'string' or type(entry) ~= 'table' or type(entry.message) ~= 'string' then
        log.warn('logs', 'dropped malformed log entry for %s', tostring(computer))
        return
    end
    local level = LEVELS[entry.level] and entry.level or 'information'
    store.insertLog({
        computer = computer,
        level = level,
        source = text.clip(entry.source or 'System', 32),
        eventId = math.floor(tonumber(entry.eventId) or 0),
        message = text.clip(entry.message, 512),
        actorCid = actor and actor.cid,
        actorName = actor and actor.name and text.clip(actor.name, 96),
        data = entry.data and json.encode(entry.data) or nil,
    })
end

---One page of a computer's log plus its summary (level counts + source list) for the viewer.
---@param computer string instance id
---@param filter table|nil { level?, source?, search?, beforeId? } (validated here)
---@return table page { entries, counts, sources, pageSize }
function logs.page(computer, filter)
    filter = type(filter) == 'table' and filter or {}
    local clean = {
        level = LEVELS[filter.level] and filter.level or nil,
        source = type(filter.source) == 'string' and filter.source ~= '' and text.clip(filter.source, 32) or nil,
        search = type(filter.search) == 'string' and filter.search ~= '' and text.clip(filter.search, 64) or nil,
        beforeId = math.tointeger(tonumber(filter.beforeId)), -- NUI numbers can arrive as floats (123.0)
    }
    local pageSize = (config.Logs and config.Logs.PageSize) or 200
    local rows = store.listLogs(computer, clean, pageSize)
    for _, r in ipairs(rows) do
        r.data = r.data and json.decode(r.data) or nil
    end
    local counts, sources = store.logSummary(computer)
    return { entries = rows, counts = counts, sources = sources, pageSize = pageSize }
end

---Wipe a computer's log, then write the 1102 "audit log was cleared" entry naming who did
---it - so a cleared log is never silently empty.
---@param computer string instance id
---@param actor table { cid, name } of who cleared it
function logs.clear(computer, actor)
    store.clearLogs(computer)
    logs.write(computer, {
        level = 'warning', source = 'Eventlog', eventId = logs.EVENT.LOG_CLEARED,
        message = locale('logs.cleared', actor and actor.name or '?'),
    }, actor)
end

---Purge entries past config.Logs.RetentionDays (no-op when 0/nil).
function logs.purge()
    local days = config.Logs and config.Logs.RetentionDays
    if not days or days <= 0 then return end
    local removed = store.purgeLogs(days)
    if removed > 0 then log.info('logs', 'purged %d log entries older than %d days', removed, days) end
end

---Export: write a System Logs entry from another resource, e.g. a door script logging "Vault door
---opened" to the security office PC. `computer` is a computers.lua id (a location computer) or a
---full instance id ('<id>@x,y,z') for one specific prop computer.
---@param computer string computer id or instance id
---@param level string 'information'|'warning'|'error'|'success'|'failure'
---@param source string short source name shown in the Source column (e.g. your resource name)
---@param message string the entry text (max 512 chars)
---@param data? table extra details shown in the entry's detail pane
exports('AddLog', function(computer, level, source, message, data)
    logs.write(computer, {
        level = level, source = source or GetInvokingResource() or 'External',
        eventId = logs.EVENT.EXTERNAL, message = message, data = type(data) == 'table' and data or nil,
    })
end)

return logs
