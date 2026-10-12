---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table Computer definitions (server.computers.registry).
local registry = require 'server.computers.registry'
---@type table Computers placed from this panel (server.computers.placed).
local placed = require 'server.computers.placed'
---@type table Session module (server.computers.session): who sits where.
local session = require 'server.computers.session'
---@type table Player bridge (bridge.server.player): names, for who placed a computer.
local player = require 'bridge.server.player'

---@type table Admin config (config.Admin): command, groups, edit ace, props.
local A = config.Admin

-- The /computeradmin panel's server side, built the way sd-bombs builds its own: every panel
-- action is one lib.callback under sd-computers:server:admin:<verb>; every reply has the same
-- shape - { success, message?, data? } - and every reply carries a fresh snapshot, so the panel
-- re-renders from one source of truth.

-- A computer that moves or goes stands up whoever is sitting at it.
placed.onChanged = function(key, reason) session.closeComputer(key, reason) end

---May this player open the panel at all?
---@param source integer player server id
---@return boolean
local function canView(source)
    local src = tostring(source)
    return IsPlayerAceAllowed(src, 'command.' .. A.Command) or IsPlayerAceAllowed(src, A.EditAce)
end

---May this player change anything?
---@param source integer player server id
---@return boolean
local function canEdit(source)
    return IsPlayerAceAllowed(tostring(source), A.EditAce)
end

---Everything the panel shows, in one table: every computer (placed from here, or from
---configs/shared/computers.lua - those are listed read-only), the props and the styles on offer.
---@param source integer player server id
---@return table snapshot
local function snapshot(source)
    -- Who is sitting where: by computer id (a model computer can have several users, one per prop).
    local users = {}
    for _, h in ipairs(session.holders()) do
        users[h.id] = users[h.id] or {}
        users[h.id][#users[h.id] + 1] = h.name
    end

    local pins = (config.Security and config.Security.Pins) or {}
    local computers = {}
    for index, def in ipairs(registry.all()) do
        local row = {
            key = def.id, order = index, label = def.label or def.id, hostname = def.hostname or tostring(def.id):upper(),
            style = registry.style(def), styleSet = def.style ~= nil, groups = def.groups, users = users[def.id] or {},
            boss = def.boss == true and '*' or def.boss or nil, pin = pins[def.id] ~= nil,
        }
        if def.placed then
            local r = placed.get(def.placed)
            row.source, row.id, row.prop = 'placed', def.placed, def.prop
            row.x, row.y, row.z, row.heading = r.coords.x, r.coords.y, r.coords.z, r.coords.w
        elseif def.coords then
            row.source = 'config'
            row.x, row.y, row.z, row.heading = def.coords.x, def.coords.y, def.coords.z, def.rotation or 0.0
        else
            row.source = 'model'
            row.models = type(def.model) == 'table' and def.model or { def.model }
        end
        computers[#computers + 1] = row
    end

    local D = config.Desktop
    local styles = {}
    for key, s in pairs(D.Styles or {}) do
        local wallpapers = {}
        for _, w in ipairs(s.Wallpapers or {}) do wallpapers[#wallpapers + 1] = w.label or w.id end
        styles[#styles + 1] = {
            key = key, name = s.OsName or key, build = s.OsBuild or '', wallpaper = s.DefaultWallpaper, accent = (s.Accents or {})[1],
            theme = s.DefaultTheme or 'dark', wallpapers = wallpapers, default = key == registry.style({}),
        }
    end
    table.sort(styles, function(a, b) return a.default ~= b.default and a.default or (a.default == b.default and a.name < b.name) end)

    return {
        canEdit = canEdit(source),
        computers = computers,
        props = A.Props or {},
        styles = styles,
        defaultStyle = registry.style({}),
        rules = { boot = D.Boot ~= false, reach = (config.Interact and config.Interact.MaxDistance) or 2.5, maxLabel = A.MaxLabel or 48 },
        refreshMs = A.RefreshMs or 5000,
    }
end

---Register one panel verb. View verbs need the panel's view right, everything else the edit ace;
---a handler returns ok (and optionally a message or extra data), and the reply always carries a
---fresh snapshot.
---@param name string the verb
---@param edit boolean whether it changes anything
---@param handler fun(source: integer, data: table): boolean, string|nil, table|nil
local function verb(name, edit, handler)
    lib.callback.register('sd-computers:server:admin:' .. name, function(source, data)
        if not canView(source) or (edit and not canEdit(source)) then
            log.warn('admin', 'player %d was refused admin verb %s', source, name)
            return { success = false, message = locale('admin.no_permission') }
        end
        local ok, message, extra = handler(source, type(data) == 'table' and data or {})
        local reply = { success = ok == true, message = message, data = extra or {} }
        reply.data.snapshot = snapshot(source)
        if edit then log.debug('admin', 'player %d ran %s: %s', source, name, ok and 'ok' or tostring(message)) end
        return reply
    end)
end

verb('snapshot', false, function() return true end)

-- ---- Computers ----------------------------------------------------------------------------

-- d = { x, y, z, heading (from the gizmo), label, prop, style?, jobs? }
verb('createComputer', true, function(source, d)
    local id, why = placed.create(d, player.getName(source))
    return id ~= nil, why and locale(why), { computerId = id }
end)

verb('updateComputer', true, function(_, d)
    local ok, why = placed.update(tonumber(d.id), d)
    return ok, why and locale(why)
end)

verb('moveComputer', true, function(_, d)
    local ok, why = placed.move(tonumber(d.id), d)
    return ok, why and locale(why)
end)

verb('deleteComputer', true, function(_, d)
    local ok, why = placed.remove(tonumber(d.id))
    return ok, why and locale(why)
end)

-- Every placed computer goes; the ones in configs/shared/computers.lua belong to the config.
verb('deleteAllComputers', true, function()
    return true, nil, { count = placed.clear() }
end)

-- ---- Getting around -----------------------------------------------------------------------

-- d.key = a computer id (placed, or a location from the config; a model computer is everywhere).
verb('teleport', true, function(source, d)
    local def = registry.get(d.key)
    local ped = GetPlayerPed(source)
    if not def or not def.coords or not ped or ped == 0 then return false, locale('admin.gone') end
    -- Land a step in front of it, looking at it, rather than on the desk (at the desk's height: the
    -- floor under a computer is anywhere from nothing to a metre below it, so the last bit is a drop).
    local heading = def.heading or def.rotation or 0.0
    local r = math.rad(heading)
    SetEntityCoords(ped, def.coords.x + math.sin(r) * 1.2, def.coords.y - math.cos(r) * 1.2, def.coords.z, false, false, false, false)
    SetEntityHeading(ped, heading)
    return true
end)

-- ---- Opening it ---------------------------------------------------------------------------

---Open the admin panel. The ace this command grants (command.<name>) is the panel's view right.
---@param source integer player server id
lib.addCommand(A.Command, { help = 'Open the computers admin panel', restricted = A.Group }, function(source)
    TriggerClientEvent('sd-computers:client:openAdmin', source)
end)

-- Group edits; ViewGroup (optional) may open the panel and look. Granted through ox_lib: a resource
-- running add_ace itself is refused ("Access denied for command add_ace") unless the server gives
-- it that command, and ox_lib is the one resource a standard permissions.cfg already gives it to.
lib.addAce(A.Group, A.EditAce)
if A.ViewGroup then lib.addAce(A.ViewGroup, 'command.' .. A.Command) end
