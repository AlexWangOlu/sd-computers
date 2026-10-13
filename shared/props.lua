---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'

-- The prop models the resource knows as a computer: the ones a computer can be placed as
-- (configs/shared/admin.lua > Props, plus the ones an admin added from the panel) and the ones
-- computers.lua makes a computer wherever the game has one. Shared, so the client offering a prop
-- and the server checking it read the same lists.

---@type table Props module; the table returned at end of file.
local props = {}

---A computers.lua entry's `model` as a list (empty for a location computer).
---@param def table computers.lua entry
---@return string[]
function props.models(def)
    if def.coords ~= nil or def.model == nil then return {} end
    return type(def.model) == 'table' and def.model or { def.model }
end

---@type table[] The computers.lua entries that are a prop model, in config order.
props.defs = {}
---@type table<string, boolean> Every model a computers.lua entry lists.
local listed = {}
for _, def in ipairs(config.Computers or {}) do
    local models = props.models(def)
    if #models > 0 and type(def.id) == 'string' then
        props.defs[#props.defs + 1] = def
        for _, name in ipairs(models) do listed[name] = true end
    end
end

---@type table[] The props from configs/shared/admin.lua, as { model, label, kind, image? }.
local base = {}
for _, p in ipairs((config.Admin and config.Admin.Props) or {}) do
    if type(p.model) == 'string' then base[#base + 1] = p end
end

---@type table[] The props an admin added from the panel, as { model, label, kind, custom = true }.
local custom = {}
---@type table<string, table> model name -> its entry, for every prop a computer can be placed as.
local byName = {}
---@type string[] Placeable props no computers.lua entry lists: any model computer may take one on.
props.spare = {}
---@type table<integer, string> model hash -> model name, for every model known.
props.byHash = {}
---@type fun()[] Run whenever the props added from the panel change.
local listeners = {}

local function rebuild()
    byName, props.spare, props.byHash = {}, {}, {}
    for _, list in ipairs({ base, custom }) do
        for _, p in ipairs(list) do
            if not byName[p.model] then
                byName[p.model] = p
                props.byHash[joaat(p.model)] = p.model
                if not listed[p.model] then props.spare[#props.spare + 1] = p.model end
            end
        end
    end
    for name in pairs(listed) do props.byHash[joaat(name)] = name end
end
rebuild()

---Replace the props added from the panel (the server's list, or what it published).
---@param list table[]|nil { model, label, kind }[]
function props.setCustom(list)
    custom = {}
    for _, p in ipairs(type(list) == 'table' and list or {}) do
        if type(p) == 'table' and type(p.model) == 'string' then
            custom[#custom + 1] = { model = p.model, label = type(p.label) == 'string' and p.label or p.model, kind = p.kind, custom = true }
        end
    end
    rebuild()
    for _, fn in ipairs(listeners) do fn() end
end

---Hear about the props added from the panel changing.
---@param fn fun()
function props.onCustom(fn)
    listeners[#listeners + 1] = fn
end

---Every prop a computer can be placed as: the config's, then the ones added from the panel.
---@return table[] { model, label, kind, image?, custom? }[]
function props.list()
    local out = {}
    for _, p in ipairs(base) do out[#out + 1] = p end
    for _, p in ipairs(custom) do
        if byName[p.model] == p then out[#out + 1] = p end
    end
    return out
end

---The props added from the panel.
---@return table[]
function props.custom() return custom end

---The entry of a prop a computer can be placed as (nil for any other model).
---@param name any
---@return table|nil prop { model, label, kind }
function props.placeable(name)
    return type(name) == 'string' and byName[name] or nil
end

---Whether a model name is one the resource knows as a computer prop.
---@param name any
---@return boolean
function props.known(name)
    return type(name) == 'string' and (byName[name] ~= nil or listed[name] == true)
end

---What a model is called (its label; the model name when it has none).
---@param name string
---@return string
function props.label(name)
    return byName[name] and byName[name].label or name
end

---The models a model computer can be made of: its own from computers.lua, then the spare ones.
---@param def table computers.lua entry
---@return string[] names
---@return table<string, boolean> own the ones computers.lua lists for it
function props.candidates(def)
    local out, own, seen = {}, {}, {}
    for _, name in ipairs(props.models(def)) do
        if not seen[name] then
            seen[name], own[name] = true, true
            out[#out + 1] = name
        end
    end
    for _, name in ipairs(props.spare) do
        if not seen[name] then
            seen[name] = true
            out[#out + 1] = name
        end
    end
    return out, own
end

return props
