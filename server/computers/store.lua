---@type table Store module (profiles + System Logs); the table returned at end of file.
local store = {}

---Create the profile + log tables if they don't exist, so the resource is drop-in. Run once at
---boot (mail has its own tables - server/computers/mailstore.lua).
function store.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS computers_profiles (
            citizenid  VARCHAR(64) NOT NULL,
            settings   LONGTEXT    NULL,
            notes      LONGTEXT    NULL,
            updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (citizenid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS computers_logs (
            id         INT          NOT NULL AUTO_INCREMENT,
            computer   VARCHAR(96)  NOT NULL,
            level      VARCHAR(16)  NOT NULL,
            source     VARCHAR(32)  NOT NULL,
            event_id   INT          NOT NULL DEFAULT 0,
            message    VARCHAR(512) NOT NULL,
            actor_cid  VARCHAR(64)  NULL,
            actor_name VARCHAR(96)  NULL,
            data       LONGTEXT     NULL,
            created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_computer_id (computer, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
end

-- ── Profiles (roaming per-character settings + Notepad notes) ─────────────────────────────

---A character's stored settings + notes as raw JSON strings (nil fields when none yet). Caller
---decodes; the data layer stays dumb.
---@param citizenid string framework per-character id
---@return string|nil settings, string|nil notes
function store.getProfile(citizenid)
    local row = MySQL.single.await('SELECT settings, notes FROM computers_profiles WHERE citizenid = ?', { citizenid })
    if not row then return nil, nil end
    return row.settings, row.notes
end

---Persist a character's settings JSON (upsert).
---@param citizenid string framework per-character id
---@param json string settings json
function store.setSettings(citizenid, json)
    MySQL.prepare.await(
        'INSERT INTO computers_profiles (citizenid, settings) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings = VALUES(settings)',
        { citizenid, json })
end

---Persist a character's notes JSON (upsert).
---@param citizenid string framework per-character id
---@param json string notes json array
function store.setNotes(citizenid, json)
    MySQL.prepare.await(
        'INSERT INTO computers_profiles (citizenid, notes) VALUES (?, ?) ON DUPLICATE KEY UPDATE notes = VALUES(notes)',
        { citizenid, json })
end

-- ── System Logs ───────────────────────────────────────────────────────────────────────────

---Append one log entry. Fire-and-forget (not awaited) so logging never slows an action down.
---@param row { computer: string, level: string, source: string, eventId: integer, message: string, actorCid?: string, actorName?: string, data?: string }
function store.insertLog(row)
    MySQL.insert(
        'INSERT INTO computers_logs (computer, level, source, event_id, message, actor_cid, actor_name, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        { row.computer, row.level, row.source, row.eventId, row.message, row.actorCid, row.actorName, row.data })
end

---One page of a computer's log, newest first, with optional filters.
---@param computer string instance id
---@param filter { level?: string, source?: string, search?: string, beforeId?: integer } optional filters
---@param limit integer page size
---@return table[] rows { id, level, source, event_id, message, actor_name, data, ts }
function store.listLogs(computer, filter, limit)
    local sql = { 'SELECT id, level, source, event_id, message, actor_name, data, UNIX_TIMESTAMP(created_at) AS ts FROM computers_logs WHERE computer = ?' }
    ---@type any[] Positional query args, grown alongside `sql`.
    local args = { computer }
    if filter.level then sql[#sql + 1] = 'AND level = ?'; args[#args + 1] = filter.level end
    if filter.source then sql[#sql + 1] = 'AND source = ?'; args[#args + 1] = filter.source end
    if filter.search then sql[#sql + 1] = 'AND (message LIKE ? OR actor_name LIKE ?)'; args[#args + 1] = '%' .. filter.search .. '%'; args[#args + 1] = '%' .. filter.search .. '%' end
    if filter.beforeId then sql[#sql + 1] = 'AND id < ?'; args[#args + 1] = filter.beforeId end
    sql[#sql + 1] = 'ORDER BY id DESC LIMIT ?'
    args[#args + 1] = limit
    local rows = MySQL.query.await(table.concat(sql, ' '), args) --[[@as table[]?]]
    return rows or {}
end

---Per-level entry counts + the distinct sources for a computer (Event Viewer's summary pane).
---@param computer string instance id
---@return table<string, integer> counts, string[] sources
function store.logSummary(computer)
    local counts, sources = {}, {}
    local levelRows = MySQL.query.await('SELECT level, COUNT(*) AS n FROM computers_logs WHERE computer = ? GROUP BY level', { computer }) --[[@as table[]?]]
    for _, r in ipairs(levelRows or {}) do counts[r.level] = r.n end
    local sourceRows = MySQL.query.await('SELECT DISTINCT source FROM computers_logs WHERE computer = ? ORDER BY source', { computer }) --[[@as table[]?]]
    for _, r in ipairs(sourceRows or {}) do sources[#sources + 1] = r.source end
    return counts, sources
end

---Delete every entry of one computer's log.
---@param computer string instance id
function store.clearLogs(computer)
    MySQL.query.await('DELETE FROM computers_logs WHERE computer = ?', { computer })
end

---Delete entries older than `days` days across every computer.
---@param days integer retention window
---@return integer removed rows removed
function store.purgeLogs(days)
    local res = MySQL.query.await('DELETE FROM computers_logs WHERE created_at < (NOW() - INTERVAL ? DAY)', { days })
    return (type(res) == 'table' and res.affectedRows) or 0
end

return store
