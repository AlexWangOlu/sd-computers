---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table Computer definitions + instance ids (server.computers.registry).
local registry = require 'server.computers.registry'
---@type table System Logs writer (server.computers.logs).
local logs = require 'server.computers.logs'
---@type table Roaming per-character settings (server.computers.profile).
local profile = require 'server.computers.profile'
---@type table Job roster adapter, used here only for the Business Manager visibility check.
local employees = require 'server.computers.employees'
---@type table Player resolution helpers (bridge.server.player).
local player = require 'bridge.server.player'
---@type table Job predicates (bridge.server.job).
local job = require 'bridge.server.job'
---@type table Gang predicates (bridge.server.gang).
local gang = require 'bridge.server.gang'
---@type table Optional sd-phone link (server.computers.phone): the phone apps a player gets.
local phone = require 'server.computers.phone'
---@type table Mail on the phone's accounts (server.computers.phonemail): its domain + limits.
local phonemail = require 'server.computers.phonemail'

---@type table Session module; the table returned at end of file.
local session = {}

---@class ComputerSession
---@field def table the computers.lua entry
---@field instance string per-machine key (logs, busy-lock, cooldowns)
---@field hostname string machine name
---@field ip string machine IPv4
---@field coords vector3 where the machine is (distance checks run against this)
---@field apps table<string, boolean> apps this player may use here (boss included only for bosses)
---@field bossJob string|nil job the Business Manager manages, when the player is its boss
---@field signedIn boolean past the lock screen?
---@field citizenid string
---@field name string character "First Last"
---@field openedAt integer os.time() the session opened
---@field style string look this session runs in (Desktop.Styles key)

---@type table<integer, ComputerSession> Open sessions by player server id.
local sessions = {}

---@type table<string, integer> instance id -> server id of the player using it (one user per machine).
local busy = {}

---@type table<string, { fails: integer, lockedUntil: integer }> '<citizenid>|<computer id>' -> PIN failures.
local pinState = {}

---@type fun(src: integer, s: ComputerSession)[] Run when a session ends (hacks.lua abandons a
---breach in progress) - a hook list instead of a require, so session.lua never depends on its users.
local closeHooks = {}

---@type fun(src: integer, s: ComputerSession)[] Run when a session starts (mirror.lua lights the
---computer's screen for the players around it).
local openHooks = {}

---@type number Server-side reach: the client's walk-away distance plus slack for latency + desync.
local REACH = ((config.Interact and config.Interact.MaxDistance) or 2.5) + 2.0

---"FL" initials for the sign-in avatar.
---@param name string
---@return string
local function initials(name)
    local out = {}
    for word in tostring(name):gmatch('%S+') do
        out[#out + 1] = (word:match(utf8.charpattern) or ''):upper()
        if #out == 2 then break end
    end
    return table.concat(out)
end

---The player's job label for the Start menu user tile (framework-specific; '' when unknown).
---@param src integer
---@return string label
local function jobLabel(src)
    local p = player.get(src)
    if not p then return '' end
    if p.PlayerData and p.PlayerData.job then return p.PlayerData.job.label or p.PlayerData.job.name or '' end
    if p.job then return p.job.label or p.job.name or '' end
    return ''
end

---Does the player satisfy a computers.lua `groups` lock (any listed job/gang at its min grade)?
---nil/empty groups = open to everyone.
---@param src integer
---@param groups table|nil { name = minGrade }
---@return boolean
local function inGroups(src, groups)
    if type(groups) ~= 'table' or next(groups) == nil then return true end
    for name, minGrade in pairs(groups) do
        local g = tonumber(minGrade) or 0
        if job.has(src, name, g) or gang.has(src, name, g) then return true end
    end
    return false
end
session.inGroups = inGroups

---Within reach of the machine? (server-side position, never the client's word)
---@param src integer
---@param coords vector3
---@return boolean
local function inReach(src, coords)
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return false end
    return #(GetEntityCoords(ped) - coords) <= REACH
end

---Coerce a client-sent coords table to a vector3 (nil when malformed).
---@param c any
---@return vector3|nil
local function toVec(c)
    if type(c) ~= 'table' and type(c) ~= 'vector3' then return nil end
    local x, y, z = tonumber(c.x), tonumber(c.y), tonumber(c.z)
    if not (x and y and z) then return nil end
    return vec3(x, y, z)
end

---The job the Business Manager manages for this player at this computer, or nil when they don't
---get the app here (no `boss` on the computer, feature off, unsupported framework, or not boss).
---@param src integer
---@param def table computers.lua entry
---@return string|nil jobName
local function resolveBossJob(src, def)
    if not def.boss or not (config.Boss and config.Boss.Enabled) then return nil end
    if not employees.supported() then return nil end
    local jobName = def.boss == true and job.getName(src) or def.boss
    if type(jobName) ~= 'string' then return nil end
    if not employees.isBoss(src, jobName) then return nil end
    return jobName
end

---Ordered app list for the NUI: the computer's configured order, the phone apps after Mail when
---linked, and the Business Manager slotted in second when this player gets it.
---@param def table computers.lua entry
---@param apps table<string, boolean>
---@return table[] list { id, label, w, h }
local function appList(def, apps)
    local known = config.Desktop.Apps
    local order = {}
    local placed = {}
    for _, id in ipairs(def.apps or config.Desktop.DefaultApps) do
        if apps[id] and id ~= 'boss' and not placed[id] then order[#order + 1] = id; placed[id] = true end
    end
    -- Phone apps the computer's own list didn't place go right after Mail (or at the end).
    local at = 1
    for i, id in ipairs(order) do if id == 'mail' then at = i + 1 end end
    if at == 1 then at = #order + 1 end
    for _, id in ipairs(phone.APPS) do
        if apps[id] and not placed[id] then table.insert(order, at, id); at = at + 1; placed[id] = true end
    end
    if apps.boss then table.insert(order, math.min(2, #order + 1), 'boss') end
    local out = {}
    for _, id in ipairs(order) do
        local a = known[id]
        out[#out + 1] = { id = id, label = a.label, w = a.size and a.size.w or 900, h = a.size and a.size.h or 600 }
    end
    return out
end

---Filter one of the Desktop id lists (Pinned/DesktopIcons) down to the apps this session has.
---@param list string[]|nil
---@param apps table<string, boolean>
---@return string[]
local function filterIds(list, apps)
    local out = {}
    for _, id in ipairs(list or {}) do
        if apps[id] then out[#out + 1] = id end
    end
    return out
end

---The Mail app's domain + compose limits: sd-phone's while its mail is linked, else configs/shared/mail.lua.
---`phone` tells the NUI which mail it is (the phone has a Spam folder and phone pushes).
---@param src integer
---@return table
local function mailInfo(src)
    if phone.mailLinked() then
        local c = phonemail.config(src)
        return {
            domain = c.domain, maxRecipients = c.maxRecipients, maxSubject = c.maxSubject, maxBody = c.maxBody,
            minPassword = c.minPassword, maxDisplayName = c.maxName, phone = true,
        }
    end
    local M = config.Mail
    return {
        domain = M.Domain, maxRecipients = M.MaxRecipients, maxSubject = M.MaxSubject,
        maxBody = M.MaxBody, minPassword = M.MinPassword, maxDisplayName = M.MaxDisplayName, phone = false,
    }
end

---The current session of a player (nil when they have no computer open).
---@param src integer
---@return ComputerSession|nil
function session.get(src)
    return sessions[src]
end

---The actor stamp for logs: { cid, name } of the session's player.
---@param s ComputerSession
---@return table actor
function session.actor(s)
    return { cid = s.citizenid, name = s.name }
end

---Seconds left on a player's PIN lockout for a computer (0 = not locked out).
---@param citizenid string
---@param id string computer id
---@return integer
local function lockoutLeft(citizenid, id)
    local st = pinState[citizenid .. '|' .. id]
    if not st or not st.lockedUntil then return 0 end
    return math.max(0, st.lockedUntil - os.time())
end

---Open a computer: validate the machine, the player's reach and the group lock, claim the
---machine, and build the boot payload for the NUI (the session starts at the LOCK SCREEN -
---nothing is usable until signIn succeeds).
---@param src integer
---@param id string computer id
---@param coords table|nil the prop's coords (model computers only; location computers use config)
---@param styleOverride any a Desktop.Styles key from the OpenComputer export (ignored when unknown)
---@return table result { ok, data?, error? }
function session.open(src, id, coords, styleOverride)
    local def = registry.get(id)
    if not def then return { ok = false, error = locale('err.unknown_computer') } end

    local at = registry.isModel(def) and toVec(coords) or def.coords
    if not at then return { ok = false, error = locale('err.unknown_computer') } end
    if not inReach(src, at) then return { ok = false, error = locale('err.too_far') } end
    if not inGroups(src, def.groups) then return { ok = false, error = locale('err.no_access') } end

    local citizenid = player.getIdentifier(src)
    if not citizenid then return { ok = false, error = locale('err.no_character') } end

    local instance = registry.instanceId(def, at)
    local holder = busy[instance]
    if holder and holder ~= src and sessions[holder] and sessions[holder].instance == instance then
        return { ok = false, error = locale('err.in_use') }
    end
    if sessions[src] then session.close(src) end

    local apps = registry.apps(def)
    local bossJob = resolveBossJob(src, def)
    if bossJob then apps.boss = true end
    for app in pairs(phone.apps(src, def)) do apps[app] = true end

    local style = registry.style(def, styleOverride)
    local s = {
        def = def, instance = instance, hostname = registry.hostname(def, at), ip = registry.ip(at),
        coords = at, apps = apps, bossJob = bossJob, signedIn = false,
        citizenid = citizenid, name = player.getName(src), openedAt = os.time(), style = style,
    }
    sessions[src] = s
    busy[instance] = src
    for _, fn in ipairs(openHooks) do
        local ok, err = pcall(fn, src, s)
        if not ok then log.error('session', 'open hook failed: %s', tostring(err)) end
    end
    log.debug('session', 'open src=%s computer=%s instance=%s style=%s boss=%s', src, id, instance, style, tostring(bossJob))

    local pins = config.Security and config.Security.Pins or {}
    local D = config.Desktop
    local S = registry.styleDef(style)
    return {
        ok = true,
        data = {
            computer = {
                id = def.id, label = def.label or def.id, hostname = s.hostname, ip = s.ip, instance = instance, style = style,
                requiresPin = pins[def.id] ~= nil, lockedFor = lockoutLeft(citizenid, def.id),
                apps = appList(def, apps), pinned = filterIds(D.Pinned, apps), desktopIcons = filterIds(D.DesktopIcons, apps),
            },
            user = { name = s.name, initials = initials(s.name), job = jobLabel(src) },
            desktop = {
                style = style, osName = S.OsName or style, osBuild = S.OsBuild or '1.0',
                boot = D.Boot ~= false, clock24 = D.Clock24 == true,
                wallpapers = S.Wallpapers or {}, accents = S.Accents or {}, defaultWallpaper = S.DefaultWallpaper, defaultTheme = S.DefaultTheme or 'dark',
                monitor = S.Monitor == true, sounds = S.Sounds ~= false,
            },
            settings = profile.settings(citizenid, style),
            hacks = {
                practice = config.Hacks.Practice ~= false, defaultDifficulty = config.Hacks.DefaultDifficulty or 'medium',
                games = config.Hacks.Games,
            },
            mail = mailInfo(src),
        },
    }
end

---Sign in past the lock screen. Computers with a PIN (configs/server/security.lua) check it here -
---server-side only - with a per-character lockout after too many misses; every attempt, good or
---bad, is written to that computer's System Logs (4624 / 4625 / 4740).
---@param src integer
---@param pin any the PIN typed (ignored when the computer has none)
---@return table result { ok, error?, lockedFor? }
function session.signIn(src, pin)
    local s = sessions[src]
    if not s then return { ok = false, error = locale('err.no_session') } end
    if s.signedIn then return { ok = true } end
    if not inReach(src, s.coords) then session.close(src); return { ok = false, error = locale('err.too_far') } end

    local sec = config.Security or {}
    local expected = sec.Pins and sec.Pins[s.def.id]
    if expected ~= nil then
        local key = s.citizenid .. '|' .. s.def.id
        local left = lockoutLeft(s.citizenid, s.def.id)
        if left > 0 then return { ok = false, error = locale('err.locked_out', left), lockedFor = left } end

        if tostring(pin or '') ~= tostring(expected) then
            local st = pinState[key] or { fails = 0 }
            st.fails = st.fails + 1
            pinState[key] = st
            logs.write(s.instance, {
                level = 'failure', source = 'Security', eventId = logs.EVENT.LOGON_FAILED,
                message = locale('logs.logon_failed', s.name),
            }, session.actor(s))
            if st.fails >= (sec.MaxAttempts or 3) then
                st.fails, st.lockedUntil = 0, os.time() + (sec.Lockout or 60)
                logs.write(s.instance, {
                    level = 'failure', source = 'Security', eventId = logs.EVENT.LOCKED_OUT,
                    message = locale('logs.locked_out', s.name, sec.Lockout or 60),
                }, session.actor(s))
                return { ok = false, error = locale('err.locked_out', sec.Lockout or 60), lockedFor = sec.Lockout or 60 }
            end
            return { ok = false, error = locale('err.bad_pin') }
        end
        pinState[key] = nil
    end

    s.signedIn = true
    logs.write(s.instance, {
        level = 'success', source = 'Security', eventId = logs.EVENT.LOGON,
        message = locale('logs.logon', s.name),
    }, session.actor(s))
    return { ok = true }
end

---Back to the lock screen (Win+L / Start > Lock): the session stays open (machine still claimed)
---but every app call is refused until the next sign-in.
---@param src integer
function session.lock(src)
    local s = sessions[src]
    if not s or not s.signedIn then return end
    s.signedIn = false
    logs.write(s.instance, {
        level = 'success', source = 'Security', eventId = logs.EVENT.LOGOFF,
        message = locale('logs.logoff', s.name),
    }, session.actor(s))
end

---Register a function to run whenever a session ends (any reason).
---@param fn fun(src: integer, s: ComputerSession)
function session.onClose(fn)
    closeHooks[#closeHooks + 1] = fn
end

---Register a function to run whenever a session starts (the computer is at its lock screen).
---@param fn fun(src: integer, s: ComputerSession)
function session.onOpen(fn)
    openHooks[#openHooks + 1] = fn
end

---End a player's session (shut down / walked away / dropped): log the logoff if they were signed
---in, release the machine. Idempotent.
---@param src integer
---@param force? string locale key: when set, also tells the client to close its NUI with this reason
function session.close(src, force)
    local s = sessions[src]
    if not s then return end
    session.lock(src)
    sessions[src] = nil
    if busy[s.instance] == src then busy[s.instance] = nil end
    for _, fn in ipairs(closeHooks) do
        local ok, err = pcall(fn, src, s)
        if not ok then log.error('session', 'close hook failed: %s', tostring(err)) end
    end
    if force then TriggerClientEvent('sd-computers:client:forceClose', src, locale(force)) end
    log.debug('session', 'close src=%s instance=%s force=%s', src, s.instance, tostring(force))
end

---The gate every app action passes: an open, signed-in session, still in reach, still allowed by
---the group lock, with `app` installed for this player. A failed reach/group check also ends the
---session and closes the client's NUI.
---@param src integer
---@param app string|nil required app id (nil = any signed-in session, e.g. shell/profile calls)
---@return ComputerSession|nil s, string|nil err
function session.guard(src, app)
    local s = sessions[src]
    if not s or not s.signedIn then return nil, locale('err.no_session') end
    if not inReach(src, s.coords) then
        session.close(src, 'err.too_far')
        return nil, locale('err.too_far')
    end
    if not inGroups(src, s.def.groups) then
        session.close(src, 'err.no_access')
        return nil, locale('err.no_access')
    end
    if app and not s.apps[app] then return nil, locale('err.app_missing') end
    if app == 'boss' and not (s.bossJob and employees.isBoss(src, s.bossJob)) then
        return nil, locale('err.not_boss')
    end
    return s, nil
end

---Who is sitting at a computer right now (signed in or still at its lock screen), for the admin
---panel's "in use" column.
---@return { src: integer, name: string, id: string, instance: string, signedIn: boolean }[]
function session.holders()
    local out = {}
    for src, s in pairs(sessions) do
        out[#out + 1] = { src = src, name = s.name, id = s.def.id, instance = s.instance, signedIn = s.signedIn == true }
    end
    return out
end

---End every session on one computer: it was moved or taken away from the admin panel.
---@param id string computer id
---@param reason string locale key shown to whoever was using it
function session.closeComputer(id, reason)
    for src, s in pairs(sessions) do
        if s.def.id == id then session.close(src, reason) end
    end
end

---Every open session whose player is signed in, as (src, session) pairs - for pushing live events
---(new mail) only to players actually sitting at a computer.
---@return fun(): integer?, ComputerSession?
function session.active()
    local src, s
    return function()
        repeat src, s = next(sessions, src) until src == nil or (s and s.signedIn)
        return src, s
    end
end

---Box: the computer opens (lock screen). See session.open.
---@param src integer
---@param id string computer id
---@param coords table|nil prop coords (model computers)
lib.callback.register('sd-computers:server:open', function(src, id, coords, style)
    return session.open(src, id, coords, style)
end)

---Lock screen -> desktop. See session.signIn.
---@param src integer
---@param pin any
lib.callback.register('sd-computers:server:signIn', function(src, pin)
    return session.signIn(src, pin)
end)

---Desktop -> lock screen. See session.lock.
RegisterNetEvent('sd-computers:server:lock', function()
    session.lock(source)
end)

---The NUI closed (shut down / ESC / walked away client-side). See session.close.
RegisterNetEvent('sd-computers:server:close', function()
    session.close(source)
end)

AddEventHandler('playerDropped', function()
    session.close(source)
end)

return session
