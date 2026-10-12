---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table Target bridge (bridge.client.target): options across ox/qb/qtarget.
local target = require 'bridge.client.target'
---@type table Client computer state (client.computers.state).
local state = require 'client.computers.state'
---@type table Placement gizmo (client.admin.placer): nothing is used while an admin is placing.
local placer = require 'client.admin.placer'

---@type string GlobalState key the server publishes the placed computers under.
local STATE_KEY = 'sd-computers:placed'
---@type table Target option look (config.Interact.Target).
local T = (config.Interact and config.Interact.Target) or {}
---@type number Metres from a placed computer its prop is spawned at.
local SPAWN_DISTANCE = (config.Admin and config.Admin.SpawnDistance) or 60.0

-- Computers placed from the admin panel, in the world. Each is a local prop (every client spawns
-- its own from the server's list, so nothing syncs) with the same "Use Computer" option every
-- other computer has. To the server it is a location computer: opening it sends only its id, and
-- reach is measured from the coords the server holds (server/computers/placed.lua).

---@type table Placed-computer module; the table returned at end of file.
local placed = {}

-- Every placed computer this client knows about, keyed by id: { rec, point, obj }.
---@type table<integer, table>
local tracked = {}
---@type table<integer, integer> entity handle -> computer id, for the props that are spawned.
local entities = {}

---Whether an entity is one of our placed computers. A prop that is also a model computer in
---configs/shared/computers.lua must answer as the placed computer only (client/computers/interact.lua).
---@param entity any
---@return boolean
function placed.isPlaced(entity)
    return type(entity) == 'number' and entities[entity] ~= nil
end

---@param entry table tracked entry
local function spawn(entry)
    if entry.obj then return end
    local rec = entry.rec
    local hash = joaat(rec.prop)
    if not IsModelInCdimage(hash) then
        log.error('placed', 'computer %s: model %s does not exist', tostring(rec.key), tostring(rec.prop))
        return
    end
    if not lib.requestModel(hash, 5000) then return end
    local c = rec.coords
    local obj = CreateObjectNoOffset(hash, c.x, c.y, c.z, false, false, false)
    SetModelAsNoLongerNeeded(hash)
    if not DoesEntityExist(obj) then return end
    SetEntityRotation(obj, 0.0, 0.0, c.w, 2, false)
    FreezeEntityPosition(obj, true)
    SetEntityInvincible(obj, true)
    entry.obj = obj
    entities[obj] = rec.id
    target.addLocalEntity(obj, { {
        name = 'sd_computers_' .. rec.key,
        label = T.label or 'Use Computer',
        icon = T.icon or 'fas fa-desktop',
        distance = T.distance or 1.8,
        groups = rec.groups, -- ox_target hides the option from everyone else (the server enforces it regardless)
        canInteract = function() return not state.isOpen() and not placer.isActive() end,
        onSelect = function() state.open(rec.key, vec3(c.x, c.y, c.z), false) end,
    } })
end

---@param entry table tracked entry
local function despawn(entry)
    local obj = entry.obj
    if not obj then return end
    entry.obj = nil
    entities[obj] = nil
    target.removeLocalEntity(obj)
    if DoesEntityExist(obj) then DeleteEntity(obj) end
end

---@param a table<string, integer>|nil job lock
---@param b table<string, integer>|nil job lock
---@return boolean
local function sameGroups(a, b)
    a, b = a or {}, b or {}
    for job, grade in pairs(a) do
        if b[job] ~= grade then return false end
    end
    for job in pairs(b) do
        if a[job] == nil then return false end
    end
    return true
end

---What makes a record a different thing to stand: its prop, its spot, or who may use it.
---@param a table record
---@param b table record
---@return boolean
local function differs(a, b)
    local ca, cb = a.coords, b.coords
    return a.prop ~= b.prop or ca.x ~= cb.x or ca.y ~= cb.y or ca.z ~= cb.z or ca.w ~= cb.w or not sameGroups(a.groups, b.groups)
end

---@param id integer
local function forget(id)
    local entry = tracked[id]
    if not entry then return end
    despawn(entry)
    entry.point:remove()
    tracked[id] = nil
end

---Reconcile with the server's list.
---@param list table<string, table>|nil GlobalState payload, keyed by stringified computer id
local function sync(list)
    local seen = {}
    for _, rec in pairs(list or {}) do
        seen[rec.id] = true
        local old = tracked[rec.id]
        if old and differs(old.rec, rec) then forget(rec.id) end -- (changed: stood again as it is now)
        if not tracked[rec.id] then
            local entry = { rec = rec }
            local point = lib.points.new({ coords = vec3(rec.coords.x, rec.coords.y, rec.coords.z), distance = SPAWN_DISTANCE })
            function point:onEnter() spawn(entry) end
            function point:onExit() despawn(entry) end
            entry.point = point
            tracked[rec.id] = entry
        end
    end
    for id in pairs(tracked) do
        if not seen[id] then forget(id) end
    end
end

AddStateBagChangeHandler(STATE_KEY, 'global', function(_, _, value) sync(value) end)
sync(GlobalState[STATE_KEY])

---Delete every prop (resource stop).
function placed.cleanupAll()
    local ids = {}
    for id in pairs(tracked) do ids[#ids + 1] = id end
    for _, id in ipairs(ids) do forget(id) end
end

return placed
