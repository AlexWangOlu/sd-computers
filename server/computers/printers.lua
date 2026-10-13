---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'

---@type table Printers config (config.Printers): the props a printer can be, how far one reaches.
local P = config.Printers or {}
---@type table Admin config (config.Admin): the longest name a printer can be given.
local A = config.Admin or {}
---@type string GlobalState key the printers are published under (clients stand their props from it).
local STATE_KEY = 'sd-computers:printers'
---@type integer Most printers that can be made from the panel.
local MAX_PRINTERS = 200
---@type number Metres within which a picked prop is the one already picked.
local SAME_PROP = 0.3

-- The printers: props made from the admin panel (/computeradmin > Printers) and kept in the
-- database. Two kinds, as with computers: PLACED ones, whose prop is stood there with the placement
-- gizmo, and PICKED ones (`world`), which are a prop the game already has - nothing is spawned for
-- those. The prop is local to each client (client/computers/printers.lua), so nothing syncs.
--
-- This file only knows where the printers are. What is in their trays, and what a page is, belongs
-- to server/computers/printing.lua.

---@type table Printers module; the table returned at end of file.
local printers = {}

---@class Printer
---@field id integer row id
---@field label string
---@field prop string model name (one of config.Printers.Props)
---@field world boolean picked: a prop the game has there already
---@field coords { x: number, y: number, z: number, w: number } the prop's origin and heading

---@type table<integer, Printer>
local list = {}

---@type table<string, table> model name -> its entry in config.Printers.Props.
local models = {}
for _, p in ipairs(type(P.Props) == 'table' and P.Props or {}) do
    if type(p) == 'table' and type(p.model) == 'string' then models[p.model] = p end
end

---Create the table if it doesn't exist, so the resource stays drop-in. Run once at boot.
function printers.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS computers_printers (
            id         INT          NOT NULL AUTO_INCREMENT,
            label      VARCHAR(64)  NOT NULL,
            prop       VARCHAR(64)  NOT NULL,
            x          DOUBLE       NOT NULL,
            y          DOUBLE       NOT NULL,
            z          DOUBLE       NOT NULL,
            heading    FLOAT        NOT NULL DEFAULT 0,
            world      TINYINT(1)   NOT NULL DEFAULT 0,
            created_by VARCHAR(96)  NULL,
            created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
end

---A name from the panel, trimmed and cut to length (nil when nothing is left).
---@param raw any
---@return string|nil
local function labelOf(raw)
    if type(raw) ~= 'string' then return nil end
    local label = raw:gsub('%c', ' '):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, A.MaxLabel or 48)
    return label ~= '' and label or nil
end

---A transform from the panel as stored coords (nil when it is not one).
---@param at any { x, y, z, heading }
---@return table|nil coords { x, y, z, w }
local function coordsOf(at)
    if type(at) ~= 'table' then return nil end
    local x, y, z, w = tonumber(at.x), tonumber(at.y), tonumber(at.z), tonumber(at.w or at.heading)
    if not x or not y or not z or x ~= x or y ~= y or z ~= z then return nil end
    return { x = x + 0.0, y = y + 0.0, z = z + 0.0, w = ((w or 0.0) + 0.0) % 360.0 }
end

---Publish the printers. String keys: a sparse integer-keyed table does not survive state-bag
---serialisation as a map.
local function publish()
    local out = {}
    for id, r in pairs(list) do
        out[tostring(id)] = { id = id, label = r.label, prop = r.prop, coords = r.coords, world = r.world or nil }
    end
    GlobalState[STATE_KEY] = out
end

---Load every printer from the database and publish them. Run once at boot.
function printers.load()
    list = {}
    for _, row in ipairs(MySQL.query.await('SELECT id, label, prop, x, y, z, heading, world FROM computers_printers ORDER BY id') or {}) do
        list[row.id] = {
            id = row.id, label = row.label, prop = row.prop,
            world = row.world == true or row.world == 1, -- (a TINYINT(1) comes back as either)
            coords = { x = row.x + 0.0, y = row.y + 0.0, z = row.z + 0.0, w = (row.heading or 0.0) + 0.0 },
        }
    end
    publish()
end

---@param id integer|nil
---@return Printer|nil
function printers.get(id) return id and list[id] or nil end

---How many printers there are.
---@return integer
function printers.count()
    local n = 0
    for _ in pairs(list) do n = n + 1 end
    return n
end

---The printers within `range` metres of a spot, nearest first.
---@param at vector3|table { x, y, z }
---@param range number
---@return { printer: Printer, distance: number }[]
function printers.near(at, range)
    local out = {}
    local origin = vec3(at.x, at.y, at.z)
    for _, r in pairs(list) do
        local d = #(vec3(r.coords.x, r.coords.y, r.coords.z) - origin)
        if d <= range then out[#out + 1] = { printer = r, distance = d } end
    end
    table.sort(out, function(a, b) return a.distance < b.distance end)
    return out
end

-- printers.onRemoved(id) hears that a printer went, so what waited in its tray can go with it
-- (server/computers/printing.lua).
---@type fun(id: integer)
printers.onRemoved = function() end

-- ── The admin panel ───────────────────────────────────────────────────────────────────────

---Everything the panel's Printers tab shows. `waiting` (copies in a printer's tray) is filled in
---by whoever asks, from the printing module.
---@param waiting fun(id: integer): integer
---@param itemReady boolean whether the inventory knows the item a printout is
---@return table { enabled, max, range, item, itemMissing?, props, list }
function printers.snapshot(waiting, itemReady)
    local ids = {}
    for id in pairs(list) do ids[#ids + 1] = id end
    table.sort(ids)
    local rows = {}
    for i, id in ipairs(ids) do
        local r = list[id]
        rows[i] = {
            id = id, label = r.label, prop = r.prop, world = r.world or nil,
            x = r.coords.x, y = r.coords.y, z = r.coords.z, heading = r.coords.w, waiting = waiting(id),
        }
    end
    local props = {}
    for _, p in ipairs(type(P.Props) == 'table' and P.Props or {}) do
        if type(p) == 'table' and type(p.model) == 'string' then
            props[#props + 1] = { model = p.model, label = type(p.label) == 'string' and p.label or p.model, image = p.image }
        end
    end
    return {
        enabled = P.Enabled ~= false, max = MAX_PRINTERS, range = tonumber(P.Range) or 30.0,
        item = P.Item or 'printed_document', itemMissing = (not itemReady) or nil, props = props, list = rows,
    }
end

-- ── Changes (each returns ok, then a locale key saying why not) ───────────────────────────

---Make a printer: place one (its prop is stood at the spot), or pick one (`world`: the spot is
---where a prop of that model already stands in the game's world, and that prop is it).
---@param d table { x, y, z, heading, label, prop, world? } from the panel
---@param by string|nil who made it (kept with the row)
---@return integer|nil id
---@return string|nil why locale key
function printers.create(d, by)
    local world = d.world == true
    local coords, label = coordsOf(d), labelOf(d.label)
    local model = type(d.prop) == 'string' and models[d.prop] and d.prop or nil
    if not coords or not label or not model then return nil, 'admin.bad_request' end
    if printers.count() >= MAX_PRINTERS then return nil, 'admin.printer_limit' end
    if world then
        local at = vec3(coords.x, coords.y, coords.z)
        for _, other in pairs(list) do
            if other.world and other.prop == model and #(vec3(other.coords.x, other.coords.y, other.coords.z) - at) <= SAME_PROP then
                return nil, 'admin.already_printer'
            end
        end
    end

    local id = MySQL.insert.await(
        'INSERT INTO computers_printers (label, prop, x, y, z, heading, world, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        { label, model, coords.x, coords.y, coords.z, coords.w, world and 1 or 0, by })
    if not id then return nil, 'admin.failed' end
    list[id] = { id = id, label = label, prop = model, world = world, coords = coords }
    publish()
    return id
end

---Change what a printer is called, and the prop it stands as (a picked one keeps its prop: that
---is the game's, not ours to swap).
---@param id integer|nil
---@param d table { label, prop }
---@return boolean ok
---@return string|nil why locale key
function printers.update(id, d)
    local r = printers.get(id)
    if not r then return false, 'admin.gone' end
    local label = labelOf(d.label)
    local model = r.world and r.prop or (type(d.prop) == 'string' and models[d.prop] and d.prop or nil)
    if not label or not model then return false, 'admin.bad_request' end
    r.label, r.prop = label, model
    MySQL.update.await('UPDATE computers_printers SET label = ?, prop = ? WHERE id = ?', { label, model, r.id })
    publish()
    return true
end

---Stand a placed printer somewhere else. What waits in its tray moves with it.
---@param id integer|nil
---@param at table { x, y, z, heading }
---@return boolean ok
---@return string|nil why locale key
function printers.move(id, at)
    local r = printers.get(id)
    if not r then return false, 'admin.gone' end
    local coords = coordsOf(at)
    if not coords or r.world then return false, 'admin.bad_request' end -- (a picked prop is where the game put it)
    r.coords = coords
    MySQL.update.await('UPDATE computers_printers SET x = ?, y = ?, z = ?, heading = ? WHERE id = ?', { coords.x, coords.y, coords.z, coords.w, r.id })
    publish()
    return true
end

---Take a printer away, and what was waiting in its tray with it.
---@param id integer|nil
---@return boolean ok
---@return string|nil why locale key
function printers.remove(id)
    local r = printers.get(id)
    if not r then return false, 'admin.gone' end
    MySQL.query.await('DELETE FROM computers_printers WHERE id = ?', { r.id })
    list[r.id] = nil
    printers.onRemoved(r.id)
    publish()
    return true
end

---Clear the published list (resource stop: GlobalState outlives the resource, and clients must
---drop their props at once).
function printers.unpublish()
    GlobalState[STATE_KEY] = {}
end

return printers
