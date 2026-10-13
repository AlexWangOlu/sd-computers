---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'

---@type string GlobalState key the computers taken away in the panel are published under.
local STATE_KEY = 'sd-computers:removed'
---@type string Row of computers_settings this module keeps.
local SETTING = 'removed'

-- The location computers of configs/shared/computers.lua an admin took away in the panel
-- (/computeradmin > Computers). The file is never written to: the entry stays in it and is simply
-- not a computer any more - nobody can open it, its zone offers nothing and the prop standing in it
-- shows nothing - until the panel puts it back. Kept in the database (computers_settings) and
-- published, so every client follows at once.
--
-- Only the locations: a model computer ("every prop of these models") is switched off in the
-- Automatic tab (server/computers/auto.lua), and one made in the panel is simply deleted.

---@type table Removed-computer module; the table returned at end of file.
local removed = {}

---@type table<string, boolean> The config's location computers, by id: what can be taken away here.
local LOCATIONS = {}
for _, def in ipairs(config.Computers or {}) do
    if type(def.id) == 'string' and def.coords then LOCATIONS[def.id] = true end
end

---@type table<string, boolean> computer id -> true, for the ones taken away
local gone = {}

-- removed.onChanged(id) hears that a computer was taken away, so whoever sits at it can be stood up
-- (server/admin/panel.lua wires it to session.closeComputer).
---@type fun(id: string)
removed.onChanged = function() end

local function publish()
    GlobalState[STATE_KEY] = gone
end

local function save()
    local ids = {}
    for id in pairs(gone) do ids[#ids + 1] = id end
    table.sort(ids)
    MySQL.prepare.await('INSERT INTO computers_settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        { SETTING, json.encode(ids) })
end

---Load the computers taken away in the panel and publish them. Run once at boot, after the
---settings table exists. One the config no longer has is dropped.
function removed.load()
    local raw = MySQL.scalar.await('SELECT value FROM computers_settings WHERE name = ?', { SETTING })
    local saved = type(raw) == 'string' and json.decode(raw) or nil
    gone = {}
    for _, id in ipairs(type(saved) == 'table' and saved or {}) do
        if LOCATIONS[id] then gone[id] = true end
    end
    publish()
end

---Whether a computer was taken away in the panel.
---@param id any computer id
---@return boolean
function removed.is(id)
    return gone[id] == true
end

---How many are taken away right now.
---@return integer
function removed.count()
    local n = 0
    for _ in pairs(gone) do n = n + 1 end
    return n
end

---Take one of the config's location computers away, or put it back.
---@param id any computer id
---@param away boolean
---@return boolean ok
---@return string|nil why locale key
function removed.set(id, away)
    if type(id) ~= 'string' or not LOCATIONS[id] then return false, 'admin.gone' end
    away = away == true
    if removed.is(id) == away then return true end
    gone[id] = away or nil
    save()
    publish()
    if away then removed.onChanged(id) end
    return true
end

return removed
