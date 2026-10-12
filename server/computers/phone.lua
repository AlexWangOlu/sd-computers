---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'

-- The optional sd-phone link. Everything sd-computers knows about sd-phone goes through here, and
-- everything here degrades to "not linked": no sd-phone, sd-phone stopped, an sd-phone without the
-- link file, or Phone.Enabled = false all leave the computer on its built-in Mail with no phone
-- apps. sd-phone's side is ONE export, computerLink(src, app, action, payload), defined by its
-- server/compat/computers.lua - it runs the phone's own handlers, so a reply from the desk behaves
-- exactly like one typed on the phone (same checks, same notifications, same rows).

---@type table Phone config (configs/shared/phone.lua).
local P = config.Phone or {}
---@type string sd-phone's resource name.
local RES = P.Resource or 'sd-phone'

---@type table Phone link module; the table returned at end of file.
local phone = {}

---@type string[] App ids that come from the phone, in the order they're appended to a computer.
phone.APPS = { 'messages', 'notes' }

---@type table<string, string> App id -> the Phone config switch that enables it.
local SWITCH = { messages = 'Messages', notes = 'Notes' }

---@type boolean|nil Cached link state; nil = re-probe. Cleared whenever sd-phone starts or stops.
local cached
---@type integer|nil The link file's protocol version (computerLinkVersion), when linked.
local version

---@type integer Oldest link protocol this build understands.
local MIN_VERSION = 1

---Probe sd-phone: started, and shipping the link export at a version we speak.
---@return boolean
local function probe()
    if P.Enabled == false then return false end
    if GetResourceState(RES) ~= 'started' then return false end
    local ok, v = pcall(function() return exports[RES]:computerLinkVersion() end)
    if not ok or type(v) ~= 'number' then
        log.warn('phone', '%s is running but has no computer link (server/compat/computers.lua) - using built-in Mail', RES)
        return false
    end
    if v < MIN_VERSION then
        log.warn('phone', '%s computer link is v%d, need v%d+ - using built-in Mail', RES, v, MIN_VERSION)
        return false
    end
    version = v
    return true
end

---Whether the phone link is live right now (cached between sd-phone starts/stops).
---@return boolean
function phone.linked()
    if cached == nil then
        cached = probe()
        if cached then log.info('phone', 'linked to %s (link v%d)', RES, version) end
    end
    return cached
end

AddEventHandler('onResourceStart', function(name)
    if name == RES then cached = nil end
end)

AddEventHandler('onResourceStop', function(name)
    if name == RES then
        if cached then log.info('phone', '%s stopped - computers fall back to built-in Mail', RES) end
        cached = false
    end
end)

---Whether Mail runs on the phone's mail right now.
---@return boolean
function phone.mailLinked()
    return P.Mail ~= false and phone.linked()
end

---Whether the player is carrying a phone, by sd-phone's own rule (a server with no phone items
---configured counts everyone as carrying one). True when RequirePhone is off.
---@param src integer
---@return boolean
function phone.carries(src)
    if P.RequirePhone == false then return true end
    local res = phone.call(src, 'phone', 'carries')
    return res.success == true and res.data == true
end

---The phone apps this player gets on this computer (none unless linked, the computer allows it,
---and - with RequirePhone - they carry a phone).
---@param src integer
---@param def table computers.lua entry
---@return table<string, boolean> set of app ids
function phone.apps(src, def)
    local out = {}
    if def.phone == false or not phone.linked() then return out end
    local any = false
    for _, id in ipairs(phone.APPS) do
        if P[SWITCH[id]] ~= false then out[id] = true; any = true end
    end
    if any and not phone.carries(src) then return {} end
    return out
end

---Whether an app id belongs to the phone (only the link may install it).
---@param id string
---@return boolean
function phone.isPhoneApp(id)
    return SWITCH[id] ~= nil
end

---Fill sd-phone's {placeholder} spans (messageVars) into its English message.
---@param msg string
---@param vars table|nil
---@return string
local function fill(msg, vars)
    if type(vars) ~= 'table' then return msg end
    return (msg:gsub('{([%w_]+)}', function(k) return vars[k] ~= nil and tostring(vars[k]) or nil end))
end

---Run one of the phone's actions as `src`. Returns sd-phone's own envelope
---({ success, data?, message? }) or, when the call itself failed (sd-phone stopped mid-call, a
---link error), a failure envelope in the same shape.
---@param src integer
---@param app 'mail'|'messages'|'notes'|'phone'
---@param action string
---@param payload table|nil
---@return { success: boolean, data?: any, message?: string, messageKey?: string, messageVars?: table }
function phone.call(src, app, action, payload)
    local ok, res = pcall(function() return exports[RES]:computerLink(src, app, action, payload or {}) end)
    if not ok then
        log.error('phone', '%s.%s failed for src=%s: %s', app, action, src, tostring(res))
        return { success = false, message = locale('err.phone_unavailable') }
    end
    if type(res) ~= 'table' then return { success = false, message = locale('err.phone_unavailable') } end
    return res
end

---Convert a phone envelope to an rpc reply ({ ok, data?, error? }). `map` reshapes data on success.
---@param res table sd-phone envelope
---@param map? fun(data: any): any
---@return table
function phone.reply(res, map)
    if not res.success then
        return { ok = false, error = fill(tostring(res.message or locale('err.internal')), res.messageVars) }
    end
    if map then return { ok = true, data = map(res.data) } end
    return { ok = true, data = res.data }
end

---Call + convert in one go (the common case for the rpc handlers).
---@param src integer
---@param app 'mail'|'messages'|'notes'|'phone'
---@param action string
---@param payload table|nil
---@param map? fun(data: any): any
---@return table rpc reply
function phone.rpc(src, app, action, payload, map)
    return phone.reply(phone.call(src, app, action, payload), map)
end

---Call a plain sd-phone export (sendMail, getMailAccounts ...), nil when it isn't there.
---@param name string
---@param ... any
---@return any
function phone.export(name, ...)
    local args = table.pack(...)
    local ok, res = pcall(function() return exports[RES][name](exports[RES], table.unpack(args, 1, args.n)) end)
    if not ok then
        log.error('phone', 'export %s failed: %s', name, tostring(res))
        return nil
    end
    return res
end

return phone
