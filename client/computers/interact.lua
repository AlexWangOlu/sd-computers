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
        -- (a prop an admin placed as a computer of its own is not ALSO this model computer)
        canInteract = function(entity) return not state.isOpen() and not placer.isActive() and not placed.isPlaced(entity) end,
        onSelect = function(data)
            if def.coords then
                state.open(def.id, def.coords, false)
                return
            end
            local entity = type(data) == 'table' and data.entity or data
            if type(entity) ~= 'number' or not DoesEntityExist(entity) then return end
            state.open(def.id, GetEntityCoords(entity), true)
        end,
    }
end

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
        target.addModel(def.model, { option(def) })
    else
        log.warn('computers', 'computer %s has neither coords nor model - skipped', tostring(def.id))
    end
end

---Export: open a computer from another resource (a laptop item, a phone app, a scripted scene).
---Location computers open at their config coords; for a model computer pass the prop's coords
---(or omit them to use the player's position - e.g. a held laptop). The server still enforces
---reach and the computer's job lock, so this grants nothing the player couldn't do at the desk.
---`opts.style` forces a look for this open ('modern' | 'retro' | 'mac' - any Desktop.Styles key).
---@param id string computers.lua id
---@param coords? vector3 prop coords for a model computer
---@param opts? { style?: string }
exports('OpenComputer', function(id, coords, opts)
    local style = type(opts) == 'table' and opts.style or nil
    for _, def in ipairs(config.Computers or {}) do
        if def.id == id then
            if def.coords then
                state.open(def.id, def.coords, false, style)
            else
                state.open(def.id, coords or GetEntityCoords(cache.ped), true, style)
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
