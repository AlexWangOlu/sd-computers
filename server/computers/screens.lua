---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table The prop models known as a computer (shared.props).
local props = require 'shared.props'

---@type string GlobalState key the screens drawn in the panel are published under.
local STATE_KEY = 'sd-computers:screens'
---@type string Row of computers_settings this module keeps.
local SETTING = 'screens'
---@type table<string, table> The screens configs/shared/screens.lua lists, by model name.
local FILE = (config.Screens and config.Screens.Models) or {}

-- Where the screen is on a prop, as an admin drew it in the panel (/computeradmin > Props > Screen,
-- client/admin/screener.lua): the same flat rectangle configs/shared/screens.lua describes for the
-- props it knows, for a model it does not - a streamed monitor of the server's own - or one whose
-- listed rectangle is a little off. Kept in the database (computers_settings) and published, so every
-- client draws it at once; one drawn here wins over the file's for that model.

---@type table Drawn-screen module; the table returned at end of file.
local screens = {}

---@type table<string, table> model name -> { x, y, z, w, h, tilt, heading }
local drawn = {}

local function publish()
    GlobalState[STATE_KEY] = drawn
end

local function save()
    MySQL.prepare.await('INSERT INTO computers_settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        { SETTING, json.encode(drawn) })
end

---@param v any
---@param lo number
---@param hi number
---@param places integer decimals kept
---@return number|nil n nil when it is not a number in that range
local function numberIn(v, lo, hi, places)
    local n = tonumber(v)
    if not n or n ~= n or n < lo or n > hi then return nil end
    local f = 10 ^ places
    return math.floor(n * f + 0.5) / f
end

---A screen from the panel, cut down to what a screen can be: its middle within ten metres of the
---prop's origin, two centimetres to five metres a side, leaning less than upright to flat.
---@param d any { x, y, z, w, h, tilt?, heading? }
---@return table|nil spec
local function specOf(d)
    if type(d) ~= 'table' then return nil end
    local x, y, z = numberIn(d.x, -10.0, 10.0, 4), numberIn(d.y, -10.0, 10.0, 4), numberIn(d.z, -10.0, 10.0, 4)
    local w, h = numberIn(d.w, 0.02, 5.0, 4), numberIn(d.h, 0.02, 5.0, 4)
    local tilt = numberIn(d.tilt or 0.0, -89.0, 89.0, 2)
    local heading = numberIn((tonumber(d.heading) or 0.0) % 360.0, 0.0, 360.0, 2)
    if not (x and y and z and w and h and tilt and heading) then return nil end
    return { x = x, y = y, z = z, w = w, h = h, tilt = tilt, heading = heading }
end

---Load the screens drawn in the panel and publish them. Run once at boot, after the settings table
---exists.
function screens.load()
    local raw = MySQL.scalar.await('SELECT value FROM computers_settings WHERE name = ?', { SETTING })
    local saved = type(raw) == 'string' and json.decode(raw) or nil
    drawn = {}
    for model, d in pairs(type(saved) == 'table' and saved or {}) do
        local spec = type(model) == 'string' and specOf(d)
        if spec then drawn[model] = spec end
    end
    publish()
end

---Which props have a screen, and whose: 'custom' = drawn in the panel, 'config' = the file's.
---@return table<string, string> by model name
function screens.states()
    local out = {}
    for model, q in pairs(FILE) do
        if type(q) == 'table' and q.centre and q.size then out[model] = 'config' end
    end
    for model in pairs(drawn) do out[model] = 'custom' end
    return out
end

---Keep the screen an admin drew for a prop.
---@param model any model name (one the resource knows as a computer prop)
---@param d table { x, y, z, w, h, tilt?, heading? }
---@return boolean ok
---@return string|nil why locale key
function screens.set(model, d)
    local spec = specOf(d)
    if not props.known(model) or not spec then return false, 'admin.bad_request' end
    drawn[model] = spec
    save()
    publish()
    return true
end

---Forget the screen drawn for a prop: it is back to the file's, or to having none.
---@param model any
---@return boolean ok
---@return string|nil why locale key
function screens.reset(model)
    if type(model) ~= 'string' or not drawn[model] then return false, 'admin.gone' end
    drawn[model] = nil
    save()
    publish()
    return true
end

return screens
