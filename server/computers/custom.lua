---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table The prop models known as a computer (shared.props).
local props = require 'shared.props'

---@type string GlobalState key the props added from the panel are published under.
local STATE_KEY = 'sd-computers:props'
---@type string Row of computers_settings this module keeps.
local SETTING = 'props'
---@type table Admin config (config.Admin): label length, how many props may be added.
local A = config.Admin or {}
---@type table<string, boolean> What a prop can be (it picks its icon in the panel).
local KINDS = { monitor = true, tower = true, laptop = true }

-- Props an admin added from the panel (/computeradmin): a model name, what to call it and what
-- kind of thing it is. From then on it is a prop like the ones in configs/shared/admin.lua: a
-- computer can be placed as it, a prop of it can be picked from the world, and the Automatic tab
-- offers it to every model computer. Kept in the database (computers_settings) and published, so
-- every client knows them. A prop added this way has a screen drawn on it once an admin has drawn
-- where it is (the panel's screen tool, server/computers/screens.lua) or configs/shared/screens.lua
-- has a rectangle for its model; until then it opens fullscreen.

---@type table Custom-prop module; the table returned at end of file.
local custom = {}

---@type table[] { model, label, kind }[]
local list = {}

-- custom.onChanged() hears the list change (the Automatic tab's props follow it), and
-- custom.inUse(model) says whether a placed or picked computer is that prop (it cannot go then).
-- Both are wired in server/admin/panel.lua, so this module depends on neither.
---@type fun()
custom.onChanged = function() end
---@type fun(model: string): boolean
custom.inUse = function() return false end

local function publish()
    props.setCustom(list)
    GlobalState[STATE_KEY] = list
end

local function save()
    MySQL.prepare.await('INSERT INTO computers_settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        { SETTING, json.encode(list) })
end

---A model name from the panel: lower case, letters digits and underscores (nil when it is not one).
---@param raw any
---@return string|nil
local function modelOf(raw)
    if type(raw) ~= 'string' then return nil end
    local name = raw:gsub('^%s+', ''):gsub('%s+$', ''):lower()
    if name == '' or #name > 64 or not name:match('^[%w_]+$') then return nil end
    return name
end

---A label from the panel, trimmed and cut to length (nil when nothing is left).
---@param raw any
---@return string|nil
local function labelOf(raw)
    if type(raw) ~= 'string' then return nil end
    local label = raw:gsub('%c', ' '):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, A.MaxLabel or 48)
    return label ~= '' and label or nil
end

---Load the props added from the panel and publish them. Run once at boot, after the settings
---table exists and before the Automatic tab's choices are read (they name these props).
function custom.load()
    local raw = MySQL.scalar.await('SELECT value FROM computers_settings WHERE name = ?', { SETTING })
    local saved = type(raw) == 'string' and json.decode(raw) or nil
    list = {}
    for _, p in ipairs(type(saved) == 'table' and saved or {}) do
        local model, label = modelOf(type(p) == 'table' and p.model), labelOf(type(p) == 'table' and p.label)
        if model and not props.placeable(model) then
            list[#list + 1] = { model = model, label = label or model, kind = KINDS[p.kind] and p.kind or 'monitor' }
            props.setCustom(list) -- (so a model saved twice is only taken once)
        end
    end
    publish()
end

---Add a prop. The client asked the game first whether the model exists; the server cannot.
---@param d table { model, label, kind }
---@return boolean ok
---@return string|nil why locale key
function custom.add(d)
    local model, label = modelOf(d.model), labelOf(d.label)
    if not model or not KINDS[d.kind] then return false, 'admin.bad_request' end
    if props.placeable(model) then return false, 'admin.prop_exists' end
    if #list >= (A.MaxCustomProps or 64) then return false, 'admin.prop_limit' end
    list[#list + 1] = { model = model, label = label or model, kind = d.kind }
    save()
    publish()
    custom.onChanged()
    return true
end

---Take a prop added from the panel away again. Not while a computer is placed (or picked) as it.
---@param model any
---@return boolean ok
---@return string|nil why locale key
function custom.remove(model)
    for i, p in ipairs(list) do
        if p.model == model then
            if custom.inUse(p.model) then return false, 'admin.prop_in_use' end
            table.remove(list, i)
            save()
            publish()
            custom.onChanged()
            return true
        end
    end
    return false, 'admin.gone'
end

return custom
