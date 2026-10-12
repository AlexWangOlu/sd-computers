---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table Computer definitions (server.computers.registry).
local registry = require 'server.computers.registry'

---@type table Admin config (config.Admin): the props a computer can be placed as, label length.
local A = config.Admin or {}
---@type string GlobalState key the placed computers are published under (clients spawn their props from it).
local STATE_KEY = 'sd-computers:placed'

-- Computers placed from the admin panel (/computeradmin): a prop, an OS style and an optional job
-- lock at a spot an admin picked with the placement gizmo. They are kept in the database beside
-- everything else the resource stores, and registered with the registry as LOCATION computers - so
-- opening one goes through exactly the checks a computers.lua entry does: reach is measured from
-- the computer's own coords (never the client's), the job lock is enforced, one user at a time.
-- The prop itself is local to each client (client/computers/placed.lua), so nothing syncs.

---@type table Placed-computer module; the table returned at end of file.
local placed = {}

---@class PlacedComputer
---@field id integer row id
---@field key string registry id ('placed_<id>'): keys its System Logs like any computer id
---@field label string
---@field hostname string
---@field prop string model name (one of config.Admin.Props)
---@field style string|nil Desktop.Styles key; nil = Desktop.DefaultStyle
---@field coords { x: number, y: number, z: number, w: number } the prop's origin and heading
---@field groups table<string, integer>|nil job lock, ox_target style
---@field def table the registry entry (the same table for its whole life: open sessions hold it)

---@type table<integer, PlacedComputer>
local list = {}

---Create the table if it doesn't exist, so the resource stays drop-in. Run once at boot.
function placed.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS computers_placed (
            id         INT          NOT NULL AUTO_INCREMENT,
            label      VARCHAR(64)  NOT NULL,
            hostname   VARCHAR(48)  NOT NULL,
            prop       VARCHAR(64)  NOT NULL,
            style      VARCHAR(24)  NULL,
            x          DOUBLE       NOT NULL,
            y          DOUBLE       NOT NULL,
            z          DOUBLE       NOT NULL,
            heading    FLOAT        NOT NULL DEFAULT 0,
            access     TEXT         NULL,
            created_by VARCHAR(96)  NULL,
            created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
end

-- ── What a record may hold ────────────────────────────────────────────────────────────────

---The config.Admin.Props entry for a model name (a computer can only be one of those).
---@param model any
---@return table|nil prop { model, label, kind }
function placed.prop(model)
    for _, p in ipairs(A.Props or {}) do
        if p.model == model then return p end
    end
    return nil
end

---A label from the panel, trimmed and cut to length (nil when nothing is left).
---@param raw any
---@return string|nil
local function labelOf(raw)
    if type(raw) ~= 'string' then return nil end
    local label = raw:gsub('%c', ' '):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, A.MaxLabel or 48)
    return label ~= '' and label or nil
end

---A style from the panel: a Desktop.Styles key, or nil for "whatever the default is".
---@param raw any
---@return string|nil style
---@return boolean ok false when it names a style that does not exist
local function styleOf(raw)
    if raw == nil or raw == '' or raw == false then return nil, true end
    if type(raw) == 'string' and (config.Desktop.Styles or {})[raw] then return raw, true end
    return nil, false
end

---A job lock from the panel ({ police = 0, ... }), cut down to what a lock can be.
---@param raw any
---@return table<string, integer>|nil groups nil = anyone
---@return boolean ok false when an entry is not a job name + grade
local function groupsOf(raw)
    if raw == nil then return nil, true end
    if type(raw) ~= 'table' then return nil, false end
    local out, n = {}, 0
    for name, grade in pairs(raw) do
        grade = tonumber(grade)
        if type(name) ~= 'string' or not name:match('^[%w_%-]+$') or #name > 48 or not grade or grade < 0 or grade > 100 then return nil, false end
        out[name] = math.floor(grade)
        n = n + 1
        if n > 16 then return nil, false end
    end
    return n > 0 and out or nil, true
end

---The machine name CMD and the logs show: the label as a hostname, plus the id so two never match.
---@param label string
---@param id integer
---@return string
local function hostnameOf(label, id)
    local slug = label:upper():gsub('[^%w]+', '-'):gsub('^%-+', ''):gsub('%-+$', ''):sub(1, 12):gsub('%-+$', '')
    return ('%s-%02d'):format(slug ~= '' and slug or 'PC', id)
end

---A transform from the panel as stored coords (nil when it is not one).
---@param at any { x, y, z, w|heading }
---@return table|nil coords { x, y, z, w }
local function coordsOf(at)
    if type(at) ~= 'table' and type(at) ~= 'vector4' then return nil end
    local x, y, z, w = tonumber(at.x), tonumber(at.y), tonumber(at.z), tonumber(at.w or at.heading)
    if not x or not y or not z then return nil end
    return { x = x + 0.0, y = y + 0.0, z = z + 0.0, w = ((w or 0.0) + 0.0) % 360.0 }
end

-- ── Registry + state ──────────────────────────────────────────────────────────────────────

---Write a record's fields into its registry entry (in place: sessions that are open keep reading
---the same table, so a changed job lock applies to them at once).
---@param r PlacedComputer
local function apply(r)
    local def = r.def
    def.id, def.placed = r.key, r.id
    def.label, def.hostname = r.label, r.hostname
    def.coords, def.heading = vec3(r.coords.x, r.coords.y, r.coords.z), r.coords.w
    def.prop, def.style, def.groups = r.prop, r.style, r.groups
end

---Publish the placed computers. String keys: a sparse integer-keyed table does not survive
---state-bag serialisation as a map.
local function publish()
    local out = {}
    for id, r in pairs(list) do
        out[tostring(id)] = { id = id, key = r.key, prop = r.prop, coords = r.coords, groups = r.groups }
    end
    GlobalState[STATE_KEY] = out
end

---Track a record: build its registry entry and add it.
---@param r table a PlacedComputer that has no key / def yet
---@return boolean ok
local function track(r)
    r.key, r.def = 'placed_' .. r.id, {}
    apply(r)
    if not registry.add(r.def) then
        log.warn('placed', 'computer id %s is already taken by configs/shared/computers.lua - placed computer %d skipped', r.key, r.id)
        return false
    end
    list[r.id] = r
    return true
end

---Load every placed computer from the database and publish them. Run once at boot.
function placed.load()
    local rows = MySQL.query.await('SELECT id, label, hostname, prop, style, x, y, z, heading, access FROM computers_placed ORDER BY id') or {}
    for _, row in ipairs(rows) do
        local access = row.access and json.decode(row.access) or nil
        track({
            id = row.id, label = row.label, hostname = row.hostname, prop = row.prop,
            style = select(1, styleOf(row.style)), groups = select(1, groupsOf(access)),
            coords = { x = row.x + 0.0, y = row.y + 0.0, z = row.z + 0.0, w = (row.heading or 0.0) + 0.0 },
        })
    end
    publish()
    if #rows > 0 then log.info('placed', '%d placed computer(s)', #rows) end
end

---@return table<integer, PlacedComputer> list every placed computer, by id
function placed.all() return list end

---@param id integer|nil
---@return PlacedComputer|nil
function placed.get(id) return id and list[id] or nil end

-- placed.onChanged(key, reason) hears that a computer moved or went, so whoever sits at it can be
-- stood up (server/admin/panel.lua wires it to session.closeComputer).
---@type fun(key: string, reason: string)
placed.onChanged = function() end

-- ── Changes (each returns ok, then a locale key saying why not) ───────────────────────────

---Place a new computer.
---@param d table { x, y, z, heading, label, prop, style?, jobs? } from the panel
---@param by string|nil who placed it (kept with the row)
---@return integer|nil id
---@return string|nil why locale key
function placed.create(d, by)
    local coords, label, prop = coordsOf(d), labelOf(d.label), placed.prop(d.prop)
    local style, styleOk = styleOf(d.style)
    local groups, groupsOk = groupsOf(d.jobs)
    if not coords or not label or not prop or not styleOk or not groupsOk then return nil, 'admin.bad_request' end

    local id = MySQL.insert.await(
        'INSERT INTO computers_placed (label, hostname, prop, style, x, y, z, heading, access, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        { label, '', prop.model, style, coords.x, coords.y, coords.z, coords.w, groups and json.encode(groups) or nil, by })
    if not id then return nil, 'admin.failed' end
    local r = { id = id, label = label, hostname = hostnameOf(label, id), prop = prop.model, style = style, groups = groups, coords = coords }
    MySQL.update.await('UPDATE computers_placed SET hostname = ? WHERE id = ?', { r.hostname, id })
    if not track(r) then return nil, 'admin.failed' end
    publish()
    return id
end

---Change what a placed computer is: its name, prop, style and job lock (the panel sends all four).
---@param id integer|nil
---@param d table { label, prop, style?, jobs? }
---@return boolean ok
---@return string|nil why locale key
function placed.update(id, d)
    local r = placed.get(id)
    if not r then return false, 'admin.gone' end
    local label, prop = labelOf(d.label), placed.prop(d.prop)
    local style, styleOk = styleOf(d.style)
    local groups, groupsOk = groupsOf(d.jobs)
    if not label or not prop or not styleOk or not groupsOk then return false, 'admin.bad_request' end

    if label ~= r.label then r.hostname = hostnameOf(label, r.id) end
    r.label, r.prop, r.style, r.groups = label, prop.model, style, groups
    MySQL.update.await('UPDATE computers_placed SET label = ?, hostname = ?, prop = ?, style = ?, access = ? WHERE id = ?',
        { r.label, r.hostname, r.prop, r.style, groups and json.encode(groups) or nil, r.id })
    apply(r)
    publish()
    return true
end

---Stand a placed computer somewhere else. Whoever is using it is stood up first.
---@param id integer|nil
---@param at table { x, y, z, heading }
---@return boolean ok
---@return string|nil why locale key
function placed.move(id, at)
    local r = placed.get(id)
    if not r then return false, 'admin.gone' end
    local coords = coordsOf(at)
    if not coords then return false, 'admin.bad_request' end
    placed.onChanged(r.key, 'err.computer_changed')
    r.coords = coords
    MySQL.update.await('UPDATE computers_placed SET x = ?, y = ?, z = ?, heading = ? WHERE id = ?', { coords.x, coords.y, coords.z, coords.w, r.id })
    apply(r)
    publish()
    return true
end

---Take a placed computer away. Its System Logs stay until the retention purge gets to them.
---@param id integer|nil
---@return boolean ok
---@return string|nil why locale key
function placed.remove(id)
    local r = placed.get(id)
    if not r then return false, 'admin.gone' end
    placed.onChanged(r.key, 'err.computer_changed')
    MySQL.query.await('DELETE FROM computers_placed WHERE id = ?', { r.id })
    registry.remove(r.key)
    list[r.id] = nil
    publish()
    return true
end

---Take every placed computer away.
---@return integer count
function placed.clear()
    local ids = {}
    for id in pairs(list) do ids[#ids + 1] = id end -- (remove() edits the table being walked)
    local n = 0
    for _, id in ipairs(ids) do
        if placed.remove(id) then n = n + 1 end
    end
    return n
end

---Clear the published list (resource stop: GlobalState outlives the resource, and clients must
---drop their props at once).
function placed.unpublish()
    GlobalState[STATE_KEY] = {}
end

return placed
