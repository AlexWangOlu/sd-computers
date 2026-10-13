---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table RPC registration (server.computers.rpc).
local rpc = require 'server.computers.rpc'
---@type table Session gate (server.computers.session): the desktop's lists after a link or an unlink.
local session = require 'server.computers.session'
---@type table Optional sd-phone link (server.computers.phone): who has linked which machine.
local phone = require 'server.computers.phone'

-- Phone Link: the app that links a character's phone to the machine they are sitting at. Until it
-- is linked the phone's apps (Messages, Notes, Photos, Contacts, the Phone place in Files) are not
-- on that machine at all. Linking takes a code: the app asks for one, it arrives on the phone as a
-- notification - sd-phone only shows those to a player carrying a phone, so reading the code is
-- having the phone - and typing it in here writes the link. The phone's apps are then installed in
-- the session there and then, and the reply carries the desktop's new lists for the page to redraw.
--
-- The app is only installed where phone.linkApp says so (session.lua), so every endpoint is behind
-- "sd-phone is linked and asks for the code" already. A code belongs to one character on one
-- machine, lives in memory only, and is gone once used, guessed at too often or left too long.

---@type table Phone config (configs/shared/phone.lua).
local P = config.Phone or {}

---@type integer Seconds a code works for.
local CODE_TTL = math.max(1, math.floor(tonumber(P.LinkCodeMinutes) or 5)) * 60
---@type integer Digits in a code.
local DIGITS = 6
---@type integer Wrong codes before a new one has to be asked for.
local MAX_TRIES = 5
---@type integer Seconds between two codes.
local RESEND = 30

---@type table<string, string> What a link unlocks -> the Phone config switch that enables it.
local UNLOCKS = { messages = 'Messages', notes = 'Notes', photos = 'Photos', contacts = 'Contacts', files = 'Files' }
---@type string[] The same, in the order the app lists them.
local UNLOCK_ORDER = { 'messages', 'notes', 'photos', 'contacts', 'files' }

---@class PendingCode
---@field code string
---@field expires integer unix seconds it stops working at
---@field sentAt integer unix seconds it went to the phone at
---@field tries integer wrong codes typed against it

---@type table<string, PendingCode> 'citizenid|instance' -> the code waiting to be typed in there
local pending = {}

---@param s ComputerSession
---@return string
local function keyOf(s)
    return s.citizenid .. '|' .. s.instance
end

---The code waiting on a session's machine, if it still works.
---@param s ComputerSession
---@return PendingCode|nil
local function waiting(s)
    local p = pending[keyOf(s)]
    if p and p.expires <= os.time() then
        pending[keyOf(s)] = nil
        return nil
    end
    return p
end

---What the app draws: linked or not (and since when), whether the phone is on the player, what a
---link unlocks here, and the code that is out, if one is.
---@param src integer
---@param s ComputerSession
---@return table
local function stateOf(src, s)
    local at = phone.pairedAt(s.citizenid, s.instance)
    local unlocks = {}
    for _, id in ipairs(UNLOCK_ORDER) do
        if P[UNLOCKS[id]] ~= false then unlocks[#unlocks + 1] = id end
    end
    local p, now = waiting(s), os.time()
    return {
        linked = at ~= nil, since = at, carrying = phone.carries(src), requirePhone = P.RequirePhone ~= false,
        unlocks = unlocks, digits = DIGITS, minutes = CODE_TTL // 60,
        code = (not at and p) and { expiresIn = p.expires - now, resendIn = math.max(0, p.sentAt + RESEND - now) } or nil,
    }
end

---The app's page.
rpc.register('phonelink:state', 'phonelink', function(src, s)
    return rpc.ok(stateOf(src, s))
end)

---Send a code to the phone. A new code replaces the one before it.
rpc.register('phonelink:send', 'phonelink', function(src, s)
    if phone.pairedAt(s.citizenid, s.instance) then return rpc.ok(stateOf(src, s)) end
    if not phone.carries(src) then return rpc.fail('phonelink.err_no_phone') end

    local now, old = os.time(), waiting(s)
    if old and old.sentAt + RESEND > now then return rpc.fail('phonelink.err_wait', old.sentAt + RESEND - now) end
    -- (codes nobody typed in are swept here, where new ones are made)
    for k, p in pairs(pending) do
        if p.expires <= now then pending[k] = nil end
    end

    local code = ('%0' .. DIGITS .. 'd'):format(math.random(0, math.tointeger(10 ^ DIGITS) - 1))
    local sent = phone.notify(src, {
        -- (one id: a second code takes the first one's place on the phone instead of stacking)
        id = 'sd-computers-link', app = 'settings', appId = 'settings', time = 'now',
        title = locale('phonelink.notify_title'),
        body = locale('phonelink.notify_body', code:sub(1, 3) .. ' ' .. code:sub(4), s.hostname, CODE_TTL // 60),
    })
    if not sent then return rpc.fail('phonelink.err_send') end

    pending[keyOf(s)] = { code = code, expires = now + CODE_TTL, sentAt = now, tries = 0 }
    return rpc.ok(stateOf(src, s))
end)

---Type the code in. The right one links the phone to this machine and installs its apps.
---@param p { code: string }
rpc.register('phonelink:confirm', 'phonelink', function(src, s, p)
    local typed = type(p.code) == 'string' and #p.code <= 32 and p.code:gsub('%D', '') or ''
    if #typed ~= DIGITS then return rpc.fail('phonelink.err_digits', DIGITS) end

    local w = waiting(s)
    if not w then return rpc.fail('phonelink.err_no_code') end
    if typed ~= w.code then
        w.tries = w.tries + 1
        if w.tries >= MAX_TRIES then
            pending[keyOf(s)] = nil
            return rpc.fail('phonelink.err_too_many')
        end
        return rpc.fail('phonelink.err_wrong', MAX_TRIES - w.tries)
    end

    pending[keyOf(s)] = nil
    phone.pair(s.citizenid, s.instance)
    local state = stateOf(src, s)
    state.computer = session.refreshPhone(src)
    return rpc.ok(state)
end)

---Take the phone off this machine: its apps go from the desktop with it.
rpc.register('phonelink:unlink', 'phonelink', function(src, s)
    pending[keyOf(s)] = nil
    phone.unpair(s.citizenid, s.instance)
    local state = stateOf(src, s)
    state.computer = session.refreshPhone(src)
    return rpc.ok(state)
end)

return {}
