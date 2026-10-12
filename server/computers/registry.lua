---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Optional sd-phone link (server.computers.phone): which app ids are the phone's.
local phone = require 'server.computers.phone'

---@type table Registry module; the table returned at end of file.
local registry = {}

---@type table<string, table> every computer keyed by id: the computers.lua entries, built once at
---load, plus the ones placed from the admin panel (registry.add - server/computers/placed.lua).
local byId = {}
---@type table[] the same computers as a list: computers.lua's in config order, then the placed ones.
local defs = {}
for _, def in ipairs(config.Computers or {}) do
    defs[#defs + 1] = def
    if type(def.id) == 'string' then byId[def.id] = def end
end

---Add a computer that is not in computers.lua (one placed from the admin panel). It is an entry
---like any other from here on: session.open finds it by id and checks it the same way.
---@param def table computers.lua-shaped entry
---@return boolean added false when the id is taken
function registry.add(def)
    if type(def.id) ~= 'string' or byId[def.id] then return false end
    byId[def.id] = def
    defs[#defs + 1] = def
    return true
end

---Take a computer added with registry.add away again.
---@param id string computer id
function registry.remove(id)
    if not byId[id] then return end
    byId[id] = nil
    for i, def in ipairs(defs) do
        if def.id == id then
            table.remove(defs, i)
            break
        end
    end
end

---A computers.lua entry by id (nil for an unknown id).
---@param id string computer id
---@return table|nil def
function registry.get(id)
    return type(id) == 'string' and byId[id] or nil
end

---Whether `def` is a model computer (every prop instance) rather than one fixed location.
---@param def table computers.lua entry
---@return boolean
function registry.isModel(def)
    return def.coords == nil and def.model ~= nil
end

---Integer hash of rounded coords - stable per prop, so a desk keeps its identity across restarts.
---@param c vector3|table coords
---@return integer
local function coordHash(c)
    local x, y, z = math.floor(c.x + 0.5), math.floor(c.y + 0.5), math.floor(c.z + 0.5)
    return ((x * 73856093) ~ (y * 19349663) ~ (z * 83492791)) & 0x7FFFFFFF
end

---The per-instance key a computer's System Logs, busy-lock and hack cooldowns hang off. A
---location computer is one machine (its id); a model computer is one machine PER PROP, keyed by
---the prop's rounded coords - '<id>@x,y,z'.
---@param def table computers.lua entry
---@param coords vector3|table the prop's coords (ignored for location computers)
---@return string instance
function registry.instanceId(def, coords)
    if not registry.isModel(def) then return def.id end
    return ('%s@%d,%d,%d'):format(def.id, math.floor(coords.x + 0.5), math.floor(coords.y + 0.5), math.floor(coords.z + 0.5))
end

---The machine's hostname: the configured one for a location computer; for a model computer the
---configured base plus a short per-prop suffix, so two desks show different names in CMD/logs.
---@param def table computers.lua entry
---@param coords vector3|table the computer's coords
---@return string hostname
function registry.hostname(def, coords)
    local base = def.hostname or def.id:upper()
    if not registry.isModel(def) then return base end
    return ('%s-%04X'):format(base, coordHash(coords) & 0xFFFF)
end

---A private-range IPv4 for the machine, derived from its coords so `ipconfig` is stable per desk.
---@param coords vector3|table the computer's coords
---@return string ip
function registry.ip(coords)
    local h = coordHash(coords)
    return ('10.%d.%d.%d'):format((h >> 16) & 0xFF, (h >> 8) & 0xFF, math.max(2, h & 0xFE))
end

---The apps installed on a computer: its own `apps` list or Desktop.DefaultApps, filtered to apps
---the Desktop registry actually knows. 'boss' and the phone apps are never returned here -
---session.lua adds them per player, because whether you SEE the Business Manager depends on who
---signed in, and the phone apps on whether sd-phone is linked (and the player carries a phone).
---@param def table computers.lua entry
---@return table<string, boolean> set of app ids
function registry.apps(def)
    local list = def.apps or (config.Desktop and config.Desktop.DefaultApps) or {}
    local known = (config.Desktop and config.Desktop.Apps) or {}
    local out = {}
    for _, app in ipairs(list) do
        if known[app] and app ~= 'boss' and not phone.isPhoneApp(app) then out[app] = true end
    end
    return out
end

---The style a computer opens in: a valid `override` (OpenComputer export) wins, then the entry's
---own `style`, then Desktop.DefaultStyle. Unknown names fall through, so a typo never breaks a
---computer - it just opens in the default look.
---@param def table computers.lua entry
---@param override any requested style (client-supplied; only accepted when Desktop.Styles has it)
---@return string style
function registry.style(def, override)
    local styles = (config.Desktop and config.Desktop.Styles) or {}
    if type(override) == 'string' and styles[override] then return override end
    if type(def.style) == 'string' and styles[def.style] then return def.style end
    local default = config.Desktop and config.Desktop.DefaultStyle
    if type(default) == 'string' and styles[default] then return default end
    return next(styles) or 'modern'
end

---A style's settings block (Desktop.Styles[style]), never nil.
---@param style string
---@return table
function registry.styleDef(style)
    return (config.Desktop.Styles or {})[style] or {}
end

---Every computer, configured and placed (read-only view for exports and the admin panel).
---@return table[] defs
function registry.all()
    return defs
end

return registry
