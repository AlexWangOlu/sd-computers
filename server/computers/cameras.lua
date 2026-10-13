---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table Job predicates (bridge.server.job).
local job = require 'bridge.server.job'
---@type table Gang predicates (bridge.server.gang).
local gang = require 'bridge.server.gang'

---@type table Cameras config (config.Cameras).
local C = config.Cameras or {}
---@type table Admin config (config.Admin): the longest name a camera can be given.
local A = config.Admin or {}

-- The security cameras, and who may watch which from where. They come from two places: the ones
-- configs/shared/cameras.lua lists, and the ones an admin put up from the panel (/computeradmin >
-- Cameras), which are kept in the database (computers_cameras). One of the file's can be taken
-- away in the panel and put back; the file is never written to.
--
-- This file only knows the cameras: session.lua asks it whether a player gets the app at all (they
-- do when there is at least one camera for them at that computer), and the app's two endpoints
-- (server/computers/shell.lua) list those cameras and hand one's position over - never one the
-- player may not see, whatever the client asks for.

---@type table Camera module; the table returned at end of file.
local cameras = {}

---@type string Row of computers_settings: the ids of the file's cameras taken away in the panel.
local SETTING = 'cameras_removed'
---@type integer Most cameras that can be put up from the panel.
local MAX_PLACED = 200
---@type integer Longest name, and longest area heading, a camera can be given.
local MAX_LABEL = A.MaxLabel or 48

---@class SecurityCamera
---@field id string
---@field row integer|nil its row id, when it was put up from the panel
---@field label string
---@field area string|nil the heading it is listed under
---@field x number where it is
---@field y number
---@field z number
---@field pitch number the way it looks (rotation order 2)
---@field roll number
---@field yaw number
---@field fov number
---@field groups table<string, integer>|nil job/gang lock; nil = anyone
---@field computers table<string, boolean>|nil computer ids it can be watched from; nil = any

---@type SecurityCamera[] The file's cameras, in config order.
local fromFile = {}
do
    local seen = {}
    for _, c in ipairs(type(C.Cameras) == 'table' and C.Cameras or {}) do
        local rot = c.rot
        if type(c.id) == 'string' and not seen[c.id] and type(c.coords) == 'vector3' and (rot == nil or type(rot) == 'vector3') then
            seen[c.id] = true
            local from
            if type(c.computers) == 'table' then
                from = {}
                for _, id in ipairs(c.computers) do from[id] = true end
            end
            fromFile[#fromFile + 1] = {
                id = c.id, label = type(c.label) == 'string' and c.label or c.id, area = type(c.area) == 'string' and c.area or nil,
                x = c.coords.x, y = c.coords.y, z = c.coords.z,
                pitch = rot and rot.x or 0.0, roll = rot and rot.y or 0.0, yaw = rot and rot.z or 0.0,
                fov = math.min(110.0, math.max(10.0, tonumber(c.fov) or 60.0)),
                groups = type(c.groups) == 'table' and next(c.groups) ~= nil and c.groups or nil,
                computers = from,
            }
        else
            log.warn('cameras', 'camera %s needs a unique id and coords (and its rot must be a vec3) - skipped', tostring(c.id))
        end
    end
end

---@type table<string, boolean> id of one of the file's cameras -> true: taken away in the panel
local gone = {}
---@type table<integer, SecurityCamera> The cameras put up from the panel, by row id.
local placed = {}

-- ── Storage ───────────────────────────────────────────────────────────────────────────────

---Create the table if it doesn't exist, so the resource stays drop-in. Run once at boot.
function cameras.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS computers_cameras (
            id         INT          NOT NULL AUTO_INCREMENT,
            label      VARCHAR(64)  NOT NULL,
            area       VARCHAR(64)  NULL,
            x          DOUBLE       NOT NULL,
            y          DOUBLE       NOT NULL,
            z          DOUBLE       NOT NULL,
            pitch      FLOAT        NOT NULL DEFAULT 0,
            yaw        FLOAT        NOT NULL DEFAULT 0,
            fov        FLOAT        NOT NULL DEFAULT 60,
            access     TEXT         NULL,
            created_by VARCHAR(96)  NULL,
            created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
end

---The id a camera put up from the panel answers to (the System Logs name it by this).
---@param row integer
---@return string
local function idOf(row)
    return ('placed_cam_%d'):format(row)
end

---A name (or an area heading) from the panel, trimmed and cut to length (nil when nothing is left).
---@param raw any
---@return string|nil
local function labelOf(raw)
    if type(raw) ~= 'string' then return nil end
    local label = raw:gsub('%c', ' '):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, MAX_LABEL)
    return label ~= '' and label or nil
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

---@param v any
---@param lo number
---@param hi number
---@return number|nil n nil when it is not a number in that range
local function numberIn(v, lo, hi)
    local n = tonumber(v)
    if not n or n ~= n or n < lo or n > hi then return nil end
    return n + 0.0
end

---Where a camera is and the way it looks, from the camera tool, cut down to what a camera can be:
---on the map, tipped less than straight up or down, seeing between a narrow and a wide angle.
---@param d any { x, y, z, pitch, yaw, fov }
---@return table|nil spec
local function specOf(d)
    if type(d) ~= 'table' then return nil end
    local x, y, z = numberIn(d.x, -20000.0, 20000.0), numberIn(d.y, -20000.0, 20000.0), numberIn(d.z, -500.0, 5000.0)
    local pitch = numberIn(d.pitch, -89.0, 89.0)
    local yaw = tonumber(d.yaw)
    local fov = numberIn(d.fov, 10.0, 110.0)
    if not (x and y and z and pitch and yaw and yaw == yaw and fov) then return nil end
    -- (the way the game writes a heading: -180 to 180)
    yaw = ((yaw + 180.0) % 360.0) - 180.0
    return { x = x, y = y, z = z, pitch = pitch, yaw = yaw, fov = fov }
end

---Load the cameras put up from the panel, and which of the file's were taken away. Run once at
---boot, after both tables exist.
function cameras.load()
    placed = {}
    for _, r in ipairs(MySQL.query.await('SELECT id, label, area, x, y, z, pitch, yaw, fov, access FROM computers_cameras ORDER BY id') or {}) do
        placed[r.id] = {
            id = idOf(r.id), row = r.id, label = r.label, area = r.area ~= '' and r.area or nil,
            x = r.x + 0.0, y = r.y + 0.0, z = r.z + 0.0, pitch = (r.pitch or 0.0) + 0.0, roll = 0.0, yaw = (r.yaw or 0.0) + 0.0,
            fov = math.min(110.0, math.max(10.0, tonumber(r.fov) or 60.0)),
            groups = select(1, groupsOf(r.access and json.decode(r.access) or nil)),
        }
    end

    gone = {}
    local raw = MySQL.scalar.await('SELECT value FROM computers_settings WHERE name = ?', { SETTING })
    local saved = type(raw) == 'string' and json.decode(raw) or nil
    local known = {}
    for _, cam in ipairs(fromFile) do known[cam.id] = true end
    for _, id in ipairs(type(saved) == 'table' and saved or {}) do
        if known[id] then gone[id] = true end
    end
end

local function saveGone()
    local ids = {}
    for id in pairs(gone) do ids[#ids + 1] = id end
    table.sort(ids)
    MySQL.prepare.await('INSERT INTO computers_settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        { SETTING, json.encode(ids) })
end

---The cameras put up from the panel, oldest first.
---@return SecurityCamera[]
local function placedList()
    local rows = {}
    for row in pairs(placed) do rows[#rows + 1] = row end
    table.sort(rows)
    local out = {}
    for i, row in ipairs(rows) do out[i] = placed[row] end
    return out
end

-- ── Who may watch what ────────────────────────────────────────────────────────────────────

---Does the player satisfy a camera's `groups` lock (any listed job/gang at its min grade)?
---@param src integer
---@param groups table<string, integer>|nil
---@return boolean
local function allowed(src, groups)
    if not groups then return true end
    for name, minGrade in pairs(groups) do
        local g = tonumber(minGrade) or 0
        if job.has(src, name, g) or gang.has(src, name, g) then return true end
    end
    return false
end

---The cameras a player may watch from a computer: the file's in config order (but for the ones
---taken away in the panel), then the ones put up from the panel. None while the app is off, or
---the computer opts out with `cameras = false`.
---@param src integer
---@param def table computers.lua entry
---@return SecurityCamera[]
function cameras.visible(src, def)
    local out = {}
    if C.Enabled == false or def.cameras == false then return out end
    for _, cam in ipairs(fromFile) do
        if not gone[cam.id] and (not cam.computers or cam.computers[def.id]) and allowed(src, cam.groups) then out[#out + 1] = cam end
    end
    for _, cam in ipairs(placedList()) do
        if allowed(src, cam.groups) then out[#out + 1] = cam end
    end
    return out
end

---@type table<string, boolean> The looks a camera's picture can have (configs/shared/cameras.lua > Filter).
local FILTERS = { cctv = true, colour = true, none = true }

---How far a camera turns and zooms, and the look its picture has (configs/shared/cameras.lua).
---@return { pan: number, tilt: number, zoom: number, filter: 'cctv'|'colour'|'none' }
function cameras.limits()
    -- (a config from before there was a choice of looks said Effect = false for a clean picture)
    local filter = FILTERS[C.Filter] and C.Filter or (C.Effect == false and 'none' or 'cctv')
    return {
        pan = math.min(180.0, math.max(0.0, tonumber(C.Pan) or 60.0)),
        tilt = math.min(80.0, math.max(0.0, tonumber(C.Tilt) or 25.0)),
        zoom = math.min(10.0, math.max(1.0, tonumber(C.Zoom) or 3.0)),
        filter = filter,
    }
end

-- ── The admin panel ───────────────────────────────────────────────────────────────────────

---One camera as the panel lists it.
---@param cam SecurityCamera
---@param source 'config'|'placed'
---@return table row
local function rowOf(cam, source)
    local from
    if cam.computers then
        from = {}
        for id in pairs(cam.computers) do from[#from + 1] = id end
        table.sort(from)
    end
    return {
        key = cam.id, id = cam.row, source = source, label = cam.label, area = cam.area,
        x = cam.x, y = cam.y, z = cam.z, pitch = cam.pitch, yaw = cam.yaw, fov = cam.fov,
        groups = cam.groups, computers = from, removed = source == 'config' and gone[cam.id] or nil,
    }
end

---Everything the panel's Cameras tab shows: every camera, and whether the app is on at all.
---@return table { enabled, max, list }
function cameras.snapshot()
    local list = {}
    for _, cam in ipairs(fromFile) do list[#list + 1] = rowOf(cam, 'config') end
    for _, cam in ipairs(placedList()) do list[#list + 1] = rowOf(cam, 'placed') end
    return { enabled = C.Enabled ~= false, max = MAX_PLACED, list = list }
end

---Where a camera is, for the panel's "go there" (nil when there is no such camera).
---@param key any camera id
---@return SecurityCamera|nil
function cameras.get(key)
    for _, cam in ipairs(fromFile) do
        if cam.id == key then return cam end
    end
    for _, cam in pairs(placed) do
        if cam.id == key then return cam end
    end
    return nil
end

-- ── Changes (each returns ok, then a locale key saying why not) ───────────────────────────

---Put a camera up: where the camera tool left it, with the name, the heading and the jobs the
---panel gave it.
---@param d table { x, y, z, pitch, yaw, fov, label, area?, jobs? }
---@param by string|nil who put it up (kept with the row)
---@return integer|nil id its row id
---@return string|nil why locale key
function cameras.create(d, by)
    local spec, label = specOf(d), labelOf(d.label)
    local groups, groupsOk = groupsOf(d.jobs)
    if not spec or not label or not groupsOk then return nil, 'admin.bad_request' end
    local n = 0
    for _ in pairs(placed) do n = n + 1 end
    if n >= MAX_PLACED then return nil, 'admin.camera_limit' end

    local area = labelOf(d.area)
    local row = MySQL.insert.await(
        'INSERT INTO computers_cameras (label, area, x, y, z, pitch, yaw, fov, access, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        { label, area, spec.x, spec.y, spec.z, spec.pitch, spec.yaw, spec.fov, groups and json.encode(groups) or nil, by })
    if not row then return nil, 'admin.failed' end
    placed[row] = {
        id = idOf(row), row = row, label = label, area = area,
        x = spec.x, y = spec.y, z = spec.z, pitch = spec.pitch, roll = 0.0, yaw = spec.yaw, fov = spec.fov, groups = groups,
    }
    return row
end

---Change what a camera is called, the heading it is listed under and who may watch it (the panel
---sends all three).
---@param row integer|nil
---@param d table { label, area?, jobs? }
---@return boolean ok
---@return string|nil why locale key
function cameras.update(row, d)
    local cam = row and placed[row]
    if not cam then return false, 'admin.gone' end
    local label = labelOf(d.label)
    local groups, groupsOk = groupsOf(d.jobs)
    if not label or not groupsOk then return false, 'admin.bad_request' end
    cam.label, cam.area, cam.groups = label, labelOf(d.area), groups
    MySQL.update.await('UPDATE computers_cameras SET label = ?, area = ?, access = ? WHERE id = ?',
        { cam.label, cam.area, groups and json.encode(groups) or nil, row })
    return true
end

---Put a camera somewhere else, or aim it again.
---@param row integer|nil
---@param d table { x, y, z, pitch, yaw, fov }
---@return boolean ok
---@return string|nil why locale key
function cameras.move(row, d)
    local cam = row and placed[row]
    if not cam then return false, 'admin.gone' end
    local spec = specOf(d)
    if not spec then return false, 'admin.bad_request' end
    cam.x, cam.y, cam.z, cam.pitch, cam.yaw, cam.fov = spec.x, spec.y, spec.z, spec.pitch, spec.yaw, spec.fov
    MySQL.update.await('UPDATE computers_cameras SET x = ?, y = ?, z = ?, pitch = ?, yaw = ?, fov = ? WHERE id = ?',
        { spec.x, spec.y, spec.z, spec.pitch, spec.yaw, spec.fov, row })
    return true
end

---Take a camera put up from the panel down for good.
---@param row integer|nil
---@return boolean ok
---@return string|nil why locale key
function cameras.remove(row)
    if not row or not placed[row] then return false, 'admin.gone' end
    MySQL.query.await('DELETE FROM computers_cameras WHERE id = ?', { row })
    placed[row] = nil
    return true
end

---Take one of the file's cameras away, or put it back. The file is not written to.
---@param key any camera id
---@param away boolean
---@return boolean ok
---@return string|nil why locale key
function cameras.setRemoved(key, away)
    local known = false
    for _, cam in ipairs(fromFile) do
        if cam.id == key then known = true break end
    end
    if not known then return false, 'admin.gone' end
    away = away == true
    if (gone[key] == true) == away then return true end
    gone[key] = away or nil
    saveGone()
    return true
end

return cameras
