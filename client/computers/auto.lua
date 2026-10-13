---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table The prop models known as a computer (shared.props).
local props = require 'shared.props'

---@type string GlobalState key the server publishes the props that are a computer under.
local STATE_KEY = 'sd-computers:auto'
---@type string GlobalState key the server publishes the props added from the admin panel under.
local PROPS_KEY = 'sd-computers:props'

-- Which props in the world are a computer on their own, right now, and the style each opens in:
-- the model computers of configs/shared/computers.lua as the admin panel has them
-- (server/computers/auto.lua). The target option and the screens both ask here, so a prop switched
-- off in the panel stops offering a computer and goes back to its stock look at once, for everyone.
-- The props an admin added from the panel arrive here too, and are handed to shared.props.

---@type table Automatic-computer module; the table returned at end of file.
local auto = {}

---@type table<integer, { def: table, style: string|nil }> model hash -> what a prop of that model is.
local byHash = {}

---@param value table<string, table>|nil the server's list: computer id -> { [model] = style | true }
local function rebuild(value)
    local map = {}
    for _, def in ipairs(props.defs) do
        if type(value) == 'table' then
            for name, style in pairs(value[def.id] or {}) do
                -- (a list of names, from a server one version back, reads the same way)
                if type(name) == 'number' then name, style = style, true end
                if type(name) == 'string' then
                    local hash = joaat(name)
                    map[hash] = map[hash] or { def = def, style = type(style) == 'string' and style or nil }
                end
            end
        elseif (config.Admin or {}).Automatic == true then
            -- (nothing published yet: the file's own lists, which is what the server starts from
            -- where the file has them on at all)
            for _, name in ipairs(props.models(def)) do
                local hash = joaat(name)
                map[hash] = map[hash] or { def = def }
            end
        end
    end
    byHash = map
end

AddStateBagChangeHandler(STATE_KEY, 'global', function(_, _, value) rebuild(value) end)
AddStateBagChangeHandler(PROPS_KEY, 'global', function(_, _, value) props.setCustom(value) end)
props.setCustom(GlobalState[PROPS_KEY])
rebuild(GlobalState[STATE_KEY])

---The computers.lua entry a prop of this model is (nil when it is not a computer on its own).
---@param model integer model hash
---@return table|nil def
function auto.def(model)
    local e = byHash[model]
    return e and e.def or nil
end

---Whether a prop of this model is this model computer right now.
---@param def table computers.lua entry
---@param model integer model hash
---@return boolean
function auto.is(def, model)
    local e = byHash[model]
    return e ~= nil and e.def == def
end

---The style the admin panel gave a prop of this model, or its computer (nil = none: the entry's own).
---@param model integer model hash
---@return string|nil style
function auto.style(model)
    local e = byHash[model]
    return e and e.style or nil
end

return auto
