---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table Target bridge (bridge.client.target): zones + model options across ox/qb/qtarget.
local target = require 'bridge.client.target'
---@type table Client computer state (client.computers.state).
local state = require 'client.computers.state'
---@type table Computers placed from the admin panel (client.computers.placed): their props answer as themselves.
local placed = require 'client.computers.placed'
---@type table Placement gizmo (client.admin.placer): nothing is used while an admin is placing.
local placer = require 'client.admin.placer'
---@type table Prop picker (client.admin.picker): nothing is used while an admin is picking either.
local picker = require 'client.admin.picker'
---@type table Which props are a computer on their own right now (client.computers.auto).
local auto = require 'client.computers.auto'
---@type table The prop models known as a computer (shared.props).
local props = require 'shared.props'

---@type table Target option look (config.Interact.Target).
local T = (config.Interact and config.Interact.Target) or {}

---The "Use Computer" option for one computers.lua entry. Location computers open at their config
---coords; model computers at the coords of the exact prop that was targeted (ox_target hands
---onSelect a data table, qb-target/qtarget hand the entity itself - both are handled).
---@param def table computers.lua entry
---@return table option ox_target-shaped option
local function option(def)
    return {
        name = 'sd_computers_' .. def.id,
        label = T.label or 'Use Computer',
        icon = T.icon or 'fas fa-desktop',
        distance = T.distance or 1.8,
        groups = def.groups, -- ox_target hides the option from everyone else (the server enforces it regardless)
        canInteract = function(entity)
            -- (a prop an admin made a computer of its own is not ALSO this model computer)
            if state.isOpen() or placer.isActive() or picker.isActive() or placed.isPlaced(entity) then return false end
            -- (a model computer is the props the admin panel has it on for, which can change at any time)
            return def.coords ~= nil or auto.is(def, GetEntityModel(entity))
        end,
        onSelect = function(data)
            if def.coords then
                state.open(def.id, def.coords, false)
                return
            end
            local entity = type(data) == 'table' and data.entity or data
            if type(entity) ~= 'number' or not DoesEntityExist(entity) then return end
            -- (in the style the admin panel gave this prop, or its computer, when it gave one)
            state.open(def.id, GetEntityCoords(entity), true, auto.style(GetEntityModel(entity)), entity)
        end,
    }
end

---@type table<string, table<string, boolean>> computer id -> the models its option is on already.
local onModels = {}

---Put a model computer's option on every prop it COULD be (its own models, and the spare ones the
---panel can give it) that does not have it yet. The option itself says whether a prop is one right
---now, so nothing is ever taken off; this runs again when an admin adds a prop from the panel.
---@param def table computers.lua entry that is a prop model
local function addModels(def)
    local have = onModels[def.id] or {}
    onModels[def.id] = have
    local new = {}
    for _, name in ipairs((props.candidates(def))) do
        if not have[name] then
            have[name] = true
            new[#new + 1] = name
        end
    end
    if #new > 0 then target.addModel(new, { option(def) }) end
end

props.onCustom(function()
    for _, def in ipairs(props.defs) do addModels(def) end
end)

for _, def in ipairs(config.Computers or {}) do
    if def.coords then
        target.addBoxZone({
            name = 'sd_computers_' .. def.id,
            coords = def.coords,
            size = def.size or vec3(0.8, 0.8, 0.8),
            rotation = def.rotation or 0.0,
            debug = config.Debug,
            options = { option(def) },
        })
    elseif def.model then
        addModels(def)
    else
        log.warn('computers', 'computer %s has neither coords nor model - skipped', tostring(def.id))
    end
end

---Export: open a computer from another resource (a laptop item, a phone app, a scripted scene).
---Location computers open at their config coords; for a model computer pass the prop's coords
---(or omit them to use the player's position - e.g. a held laptop). The server still enforces
---reach and the computer's job lock, so this grants nothing the player couldn't do at the desk.
---`opts.style` forces a look for this open ('modern' | 'retro' | 'mac' - any Desktop.Styles key).
---The camera goes up to the prop's screen as it does from the target option; with no coords
---there is no prop to go to, and the desktop is fullscreen.
---@param id string computers.lua id
---@param coords? vector3 prop coords for a model computer
---@param opts? { style?: string }
exports('OpenComputer', function(id, coords, opts)
    local style = type(opts) == 'table' and opts.style or nil
    for _, def in ipairs(config.Computers or {}) do
        if def.id == id then
            if def.coords then
                state.open(def.id, def.coords, false, style)
            elseif coords then
                state.open(def.id, coords, true, style)
            else
                state.open(def.id, GetEntityCoords(cache.ped), true, style, false)
            end
            return true
        end
    end
    return false
end)

-- Debug-only placement helper: aim at a monitor/keyboard and run the command - the hit point is
-- copied as a ready-to-paste `coords = vec3(...)` line (plus the model hash when you hit a prop).
if config.Debug and config.Interact and config.Interact.PosCommand then
    RegisterCommand(config.Interact.PosCommand, function()
        local hit, entity, coords = lib.raycast.fromCamera(511, 4, 15.0)
        if not hit then
            lib.notify({ description = 'Nothing under the crosshair', type = 'error' })
            return
        end
        local line = ('coords = vec3(%.2f, %.2f, %.2f),'):format(coords.x, coords.y, coords.z)
        if entity and entity ~= 0 and GetEntityType(entity) == 3 then
            line = line .. (' -- prop model hash %d'):format(GetEntityModel(entity))
        end
        lib.setClipboard(line)
        lib.notify({ description = line, type = 'success' })
    end, false)
end
