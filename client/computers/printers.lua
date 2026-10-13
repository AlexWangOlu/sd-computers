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
---@type table Prop picker (client.admin.picker): nothing is used while an admin is picking either.
local picker = require 'client.admin.picker'

---@type table Printers config (config.Printers).
local P = config.Printers or {}
---@type table Target option look (config.Printers.Target).
local T = P.Target or {}
---@type string GlobalState key the server publishes the printers under.
local STATE_KEY = 'sd-computers:printers'
---@type number Metres from a printer its prop is stood at.
local SPAWN_DISTANCE = (config.Admin and config.Admin.SpawnDistance) or 60.0
---@type number Metres from where it was picked the game's prop is looked for.
local PICK_RADIUS = 0.4
---@type integer ms between looks for the game's props of the picked printers around.
local PICK_INTERVAL = 1000

-- The printers made from the admin panel, in the world: the same two kinds a computer made there
-- can be (client/computers/placed.lua). A placed one is a local prop every client stands for itself;
-- a picked one (`world`) is a prop the game has there already, found again each time it streams in.
-- Either gets the option that takes what is waiting in its tray. What is in the tray, and whether
-- this player may have it, is the server's to say (server/computers/printing.lua): the option only
-- names the printer.

---@type table Printers module; the table returned at end of file.
local printers = {}

-- Every printer this client knows about, keyed by id: { rec, point, obj, near }.
---@type table<integer, table>
local tracked = {}
---@type table<integer, integer> entity handle -> printer id, for the props that are standing.
local entities = {}

---@type table<string, string> model name -> what it is called (config.Printers.Props).
local labels = {}
---The models a printer can be, for the prop picker (client/admin/picker.lua).
---@type { byHash: table<integer, string>, label: fun(model: string): string }
printers.models = { byHash = {}, what = 'printer', label = function(model) return labels[model] or model end }
for _, p in ipairs(type(P.Props) == 'table' and P.Props or {}) do
    if type(p) == 'table' and type(p.model) == 'string' then
        labels[p.model] = type(p.label) == 'string' and p.label or p.model
        printers.models.byHash[joaat(p.model)] = p.model
    end
end

---What a printer prop is called (the model name when it has no label).
---@param model string
---@return string
function printers.label(model)
    return labels[model] or model
end

---Whether an entity is one of our printers.
---@param entity any
---@return boolean
function printers.isPrinter(entity)
    return type(entity) == 'number' and entities[entity] ~= nil
end

---Take what is ready from a printer's tray, and say what came of it.
---@param id integer
local function collect(id)
    local reply = lib.callback.await('sd-computers:server:printer:collect', false, id)
    if type(reply) ~= 'table' then return end
    lib.notify({ title = locale('print.notify_title'), description = reply.message, type = reply.ok and 'success' or 'inform' })
end

---What a target option of ours is taken off an entity by: ox_target goes by the option's name,
---qb-target and qtarget by its label. (Never by nothing: a picked prop is the game's, not only ours.)
---@param rec table record
---@return string
local function optionKey(rec)
    return target.system == 'ox_target' and ('sd_computers_printer_' .. rec.id) or (T.label or 'Take printouts')
end

---Make a prop the printer: remember it and give it the option.
---@param entry table tracked entry
---@param obj integer
local function attach(entry, obj)
    local rec = entry.rec
    entry.obj = obj
    entities[obj] = rec.id
    if P.Enabled == false then return end
    target.addLocalEntity(obj, { {
        name = 'sd_computers_printer_' .. rec.id,
        label = T.label or 'Take printouts',
        icon = T.icon or 'fas fa-print',
        distance = T.distance or 1.8,
        canInteract = function() return not state.isOpen() and not placer.isActive() and not picker.isActive() end,
        onSelect = function() collect(rec.id) end,
    } })
end

---Stand a placed printer's prop.
---@param entry table tracked entry
local function spawn(entry)
    if entry.obj then return end
    local rec = entry.rec
    local hash = joaat(rec.prop)
    if not IsModelInCdimage(hash) then
        log.error('printers', 'printer %s: model %s does not exist', tostring(rec.id), tostring(rec.prop))
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
    attach(entry, obj)
end

---Let go of a printer's prop: a placed one is deleted, a picked one is the game's and stays.
---@param entry table tracked entry
local function despawn(entry)
    local obj = entry.obj
    if not obj then return end
    entry.obj = nil
    entities[obj] = nil
    if P.Enabled ~= false then target.removeLocalEntity(obj, optionKey(entry.rec)) end
    if not DoesEntityExist(obj) then return end
    if entry.rec.world then FreezeEntityPosition(obj, false) else DeleteEntity(obj) end
end

---Find a picked printer's prop: the game's own, where it was picked. The game takes its props away
---and brings them back as the player moves about, under a new handle each time, so the one held is
---checked (still there, still that model, still at that spot) and looked for again.
---@param entry table tracked entry of a picked printer
local function find(entry)
    local rec = entry.rec
    local c, hash = rec.coords, joaat(rec.prop)
    local at = vec3(c.x, c.y, c.z)
    local obj = entry.obj
    if obj then
        if DoesEntityExist(obj) and GetEntityModel(obj) == hash and #(GetEntityCoords(obj) - at) <= PICK_RADIUS * 2 then return end
        despawn(entry)
    end
    local found = GetClosestObjectOfType(c.x, c.y, c.z, PICK_RADIUS, hash, false, false, false)
    if found and found ~= 0 and DoesEntityExist(found) and not entities[found] then
        FreezeEntityPosition(found, true) -- (a printer knocked off its table would stop being the one picked)
        attach(entry, found)
    end
end

---What makes a record a different thing to stand: its prop or its spot.
---@param a table record
---@param b table record
---@return boolean
local function differs(a, b)
    local ca, cb = a.coords, b.coords
    return a.prop ~= b.prop or (a.world == true) ~= (b.world == true) or ca.x ~= cb.x or ca.y ~= cb.y or ca.z ~= cb.z or ca.w ~= cb.w
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
---@param list table<string, table>|nil GlobalState payload, keyed by stringified printer id
local function sync(list)
    local seen = {}
    for _, rec in pairs(list or {}) do
        seen[rec.id] = true
        local old = tracked[rec.id]
        if old and differs(old.rec, rec) then forget(rec.id) end -- (changed: stood again as it is now)
        if not tracked[rec.id] then
            local entry = { rec = rec }
            local point = lib.points.new({ coords = vec3(rec.coords.x, rec.coords.y, rec.coords.z), distance = SPAWN_DISTANCE })
            function point:onEnter()
                entry.near = true
                if rec.world then find(entry) else spawn(entry) end
            end
            function point:onExit()
                entry.near = false
                despawn(entry)
            end
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

-- The picked printers around: keep hold of the game's prop for each.
CreateThread(function()
    while true do
        for _, entry in pairs(tracked) do
            if entry.near and entry.rec.world then find(entry) end
        end
        Wait(PICK_INTERVAL)
    end
end)

---Delete every prop (resource stop).
function printers.cleanupAll()
    local ids = {}
    for id in pairs(tracked) do ids[#ids + 1] = id end
    for _, id in ipairs(ids) do forget(id) end
end

return printers
