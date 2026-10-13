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
phone.APPS = { 'messages', 'notes', 'photos', 'contacts' }

---@type table<string, string> App id -> the Phone config switch that enables it.
local SWITCH = { messages = 'Messages', notes = 'Notes', photos = 'Photos', contacts = 'Contacts' }

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

-- ── Phone Link: which machines a character has linked their phone to ─────────────────────────
-- One row per character per machine (the machine's instance key, as its System Logs use), written
-- when the code from the Phone Link app is typed in and removed when they unlink it there.

---@type table<string, integer|false> 'citizenid|instance' -> unix time it was linked (false = looked up, not linked)
local paired = {}

---Create the table if it doesn't exist, so the resource stays drop-in. Run once at boot.
function phone.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS computers_phone_links (
            citizenid VARCHAR(64) NOT NULL,
            computer  VARCHAR(96) NOT NULL,
            linked_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (citizenid, computer)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
end

---Whether the phone's apps wait for the Phone Link code (configs/shared/phone.lua > RequireLink).
---@return boolean
function phone.requiresLink()
    return P.RequireLink ~= false
end

---When a character linked their phone to a machine (nil = they have not).
---@param citizenid string
---@param instance string the machine's instance key
---@return integer|nil unix seconds
function phone.pairedAt(citizenid, instance)
    local key = citizenid .. '|' .. instance
    local at = paired[key]
    if at == nil then
        at = MySQL.scalar.await('SELECT UNIX_TIMESTAMP(linked_at) FROM computers_phone_links WHERE citizenid = ? AND computer = ?', { citizenid, instance }) or false
        paired[key] = at
    end
    return at or nil
end

---Link a character's phone to a machine.
---@param citizenid string
---@param instance string the machine's instance key
---@return integer at unix seconds
function phone.pair(citizenid, instance)
    MySQL.query.await('INSERT INTO computers_phone_links (citizenid, computer) VALUES (?, ?) ON DUPLICATE KEY UPDATE linked_at = CURRENT_TIMESTAMP', { citizenid, instance })
    local at = os.time()
    paired[citizenid .. '|' .. instance] = at
    return at
end

---Take a character's phone off a machine again.
---@param citizenid string
---@param instance string the machine's instance key
function phone.unpair(citizenid, instance)
    MySQL.query.await('DELETE FROM computers_phone_links WHERE citizenid = ? AND computer = ?', { citizenid, instance })
    paired[citizenid .. '|' .. instance] = false
end

---Whether anything on a computer comes from the phone at all (an app, or the Phone place in Files).
---@return boolean
local function anyPhoneSide()
    if P.Files ~= false then return true end
    for _, id in ipairs(phone.APPS) do
        if P[SWITCH[id]] ~= false then return true end
    end
    return false
end

---Whether a computer has the Phone Link app: sd-phone is linked, the computer has not opted out,
---the code is asked for, and there is something for it to unlock.
---@param def table computers.lua entry
---@return boolean
function phone.linkApp(def)
    return def.phone ~= false and phone.requiresLink() and phone.linked() and anyPhoneSide()
end

---Whether this character may see the phone's side on this machine: the phone is linked to it
---(when RequireLink asks for that) and - with RequirePhone - they carry a phone.
---@param src integer
---@param citizenid string|nil
---@param instance string|nil the machine's instance key
---@return boolean
function phone.unlocked(src, citizenid, instance)
    if phone.requiresLink() and not (citizenid and instance and phone.pairedAt(citizenid, instance)) then return false end
    return phone.carries(src)
end

---Put a notification on the player's phone (sd-phone's notify export). sd-phone drops it for a
---player who is not carrying a phone.
---@param src integer
---@param data { title: string, body?: string, app?: string, appId?: string, id?: string, time?: string }
---@return boolean sent
function phone.notify(src, data)
    return phone.export('notify', src, data) == true
end

---The phone apps this player gets on this computer (none unless sd-phone is linked, the computer
---allows it, they have linked their phone to this machine and - with RequirePhone - carry it).
---@param src integer
---@param def table computers.lua entry
---@param citizenid? string
---@param instance? string the machine's instance key
---@return table<string, boolean> set of app ids
function phone.apps(src, def, citizenid, instance)
    local out = {}
    if def.phone == false or not phone.linked() then return out end
    local any = false
    for _, id in ipairs(phone.APPS) do
        if P[SWITCH[id]] ~= false then out[id] = true; any = true end
    end
    if any and not phone.unlocked(src, citizenid, instance) then return {} end
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
