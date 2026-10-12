---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table RPC registration (server.computers.rpc).
local rpc = require 'server.computers.rpc'
---@type table Session helpers (server.computers.session).
local session = require 'server.computers.session'
---@type table System Logs writer (server.computers.logs).
local logs = require 'server.computers.logs'
---@type table Mail persistence (server.computers.mailstore).
local mailstore = require 'server.computers.mailstore'
---@type table Rate limiter (server.computers.ratelimit).
local ratelimit = require 'server.computers.ratelimit'
---@type table Player resolution helpers (bridge.server.player).
local player = require 'bridge.server.player'
---@type table Server -> client notify (bridge.server.notify).
local notify = require 'bridge.server.notify'
---@type table UTF-8-safe clipping (shared.text).
local text = require 'shared.text'
---@type table Optional sd-phone link (server.computers.phone).
local phone = require 'server.computers.phone'
---@type table Mail on the phone's accounts (server.computers.phonemail), used while linked.
local phonemail = require 'server.computers.phonemail'

-- Mail: shared, password-protected addresses @config.Mail.Domain (sd-phone's model: an address
-- isn't owned by a character - whoever knows the password can sign in). Passwords are hashed with
-- the server's bcrypt natives (GetPasswordHash / VerifyPasswordHash) and never leave the server.

---@type table Mail config (config.Mail).
local M = config.Mail
---@type string The domain, lowercased once.
local DOMAIN = tostring(M.Domain or 'lsmail.com'):lower()

---@type table<string, boolean> Folders a client may list.
local FOLDERS = { inbox = true, sent = true, drafts = true, bin = true, flagged = true }

---@type table Mail module (exports + deliver for other server modules); returned at end of file.
local mail = {}

---Normalise an address: trim + lowercase, and a bare username gets @DOMAIN. nil when malformed.
---@param raw any
---@return string|nil
local function normalize(raw)
    if type(raw) ~= 'string' then return nil end
    local a = raw:gsub('^%s+', ''):gsub('%s+$', ''):lower()
    if a == '' then return nil end
    if not a:find('@', 1, true) then a = a .. '@' .. DOMAIN end
    if #a > 64 or not a:match('^[%w][%w%._%-]*@[%w%.%-]+$') then return nil end
    return a
end

---A username is valid for sign-up: 2-32 chars, starts alphanumeric, then [a-z0-9._-].
---@param u any
---@return string|nil cleaned
local function validUsername(u)
    if type(u) ~= 'string' then return nil end
    u = u:lower()
    if #u < 2 or #u > 32 or not u:match('^[%w][%w%._%-]*$') then return nil end
    return u
end

---Parse a recipient list (array, or a comma/semicolon separated string) into unique normalised
---addresses. Returns nil when any entry is malformed or the list is empty/too long.
---@param to any
---@return string[]|nil
local function recipients(to)
    local raw = {}
    if type(to) == 'string' then
        for part in to:gmatch('[^,;]+') do raw[#raw + 1] = part end
    elseif type(to) == 'table' then
        raw = to
    end
    local out, seen = {}, {}
    for _, r in ipairs(raw) do
        local a = normalize(r)
        if not a then return nil end
        if not seen[a] then seen[a] = true; out[#out + 1] = a end
    end
    if #out == 0 or #out > (M.MaxRecipients or 20) then return nil end
    return out
end

---Clip subject/body to the configured limits.
---@param subject any
---@param body any
---@return string subject, string body
local function clip(subject, body)
    return text.clip(subject, M.MaxSubject or 200), text.clip(body, M.MaxBody or 10000)
end

---Online server id of a character (nil when offline). Linear scan - only runs per delivery.
---@param cid string
---@return integer|nil
local function sourceOfCid(cid)
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        if src and player.getIdentifier(src) == cid then return src end
    end
    return nil
end

---Tell everyone signed into `email` that a message landed: an in-OS toast for anyone sitting at a
---computer, an ordinary notification for the rest (when NotifyOffComputer).
---@param email string recipient mailbox
---@param msg table { id, senderName, senderEmail, subject, preview }
local function push(email, msg)
    for _, cid in ipairs(mailstore.citizensOf(email)) do
        local src = sourceOfCid(cid)
        if src then
            local s = session.get(src)
            if s and s.signedIn and s.apps.mail then
                TriggerClientEvent('sd-computers:client:mailReceived', src, { mailbox = email, message = msg })
            elseif M.NotifyOffComputer then
                notify.to(src, { title = locale('mail.notify_title', email), description = locale('mail.notify_body', msg.senderName, msg.subject ~= '' and msg.subject or locale('mail.no_subject')), type = 'inform' })
            end
        end
    end
end

---Deliver a message: a copy into every existing recipient's inbox (+ a push), a 'sent' copy for a
---real sending account, and - when Bounce is on - one Mail Delivery Subsystem bounce listing every
---address that doesn't exist. The core of player sends, the SendMail export and hack rewards.
---@param from { email: string, name: string, account: boolean } sender (account=true keeps a sent copy)
---@param to string[] normalised recipients
---@param subject string
---@param body string
---@return string[] delivered, string[] failed
function mail.deliver(from, to, subject, body)
    local delivered, failed = {}, {}
    local copy = { senderEmail = from.email, senderName = from.name, recipients = to, subject = subject, body = body, read = false }
    for _, addr in ipairs(to) do
        if mailstore.account(addr) then
            local id = mailstore.insert(addr, 'inbox', copy)
            mailstore.trim(addr, 'inbox', config.Mail.MaxMailbox or 500)
            delivered[#delivered + 1] = addr
            push(addr, { id = id, senderName = from.name, senderEmail = from.email, subject = subject, preview = text.clip(body, 160) })
        else
            failed[#failed + 1] = addr
        end
    end
    if from.account then
        mailstore.insert(from.email, 'sent', { senderEmail = from.email, senderName = from.name, recipients = to, subject = subject, body = body, read = true })
        mailstore.trim(from.email, 'sent', config.Mail.MaxMailbox or 500)
        if #failed > 0 and M.Bounce ~= false then
            local bf = config.Mail.BounceFrom or {}
            local bounce = {
                senderEmail = ('%s@%s'):format(bf.email or 'mailer-daemon', DOMAIN), senderName = bf.name or 'Mail Delivery Subsystem',
                recipients = { from.email }, subject = locale('mail.bounce_subject'),
                body = locale('mail.bounce_body', table.concat(failed, '\n'), subject), read = false,
            }
            local id = mailstore.insert(from.email, 'inbox', bounce)
            push(from.email, { id = id, senderName = bounce.senderName, senderEmail = bounce.senderEmail, subject = bounce.subject, preview = text.clip(bounce.body, 160) })
        end
    end
    return delivered, failed
end

---The caller's signed-in address `email`, validated (nil when they aren't signed into it).
---@param s ComputerSession
---@param email any
---@return string|nil
local function mine(s, email)
    local a = normalize(email)
    if not a or not mailstore.isSignedIn(s.citizenid, a) then return nil end
    return a
end

---Normalise a DB message row for the NUI.
---@param r table
---@return table
local function shape(r)
    return {
        id = r.id, folder = r.folder, from = { email = r.sender_email, name = r.sender_name },
        to = json.decode(r.recipients or '[]') or {}, subject = r.subject, preview = r.preview, body = r.body,
        read = r.is_read == 1 or r.is_read == true, flagged = r.flagged == 1 or r.flagged == true, ts = r.ts,
    }
end

-- ── RPC (app 'mail') ──────────────────────────────────────────────────────────────────────

---System Logs for phone-mail actions (the built-in handlers write their own below).
---@param name string endpoint
---@param s ComputerSession
---@param p table payload
---@param res table rpc reply
local function phoneLog(name, s, p, res)
    local actor = session.actor(s)
    if name == 'mail:send' and res.ok and config.Logs and config.Logs.MailSent ~= false then
        local to = res.data and res.data.delivered or {}
        logs.write(s.instance, {
            level = 'information', source = 'Mail', eventId = logs.EVENT.MAIL_SENT,
            message = locale('logs.mail_sent', tostring(p.from), table.concat(to, ', '), text.clip(p.subject, 200) ~= '' and text.clip(p.subject, 200) or locale('mail.no_subject')),
            data = { from = p.from, to = to, failed = res.data and res.data.failed, phone = true },
        }, actor)
    elseif name == 'mail:signIn' then
        local email = res.ok and res.data and res.data.email or tostring(p.email)
        logs.write(s.instance, {
            level = res.ok and 'success' or 'failure', source = 'Mail', eventId = logs.EVENT.MAIL_SIGNIN,
            message = locale(res.ok and 'logs.mail_signin' or 'logs.mail_signin_failed', email, s.name),
        }, actor)
    elseif name == 'mail:signUp' and res.ok then
        logs.write(s.instance, { level = 'information', source = 'Mail', eventId = logs.EVENT.MAIL_CREATED, message = locale('logs.mail_created', res.data and res.data.email or '?', s.name) }, actor)
    elseif name == 'mail:signOut' and res.ok then
        logs.write(s.instance, { level = 'information', source = 'Mail', eventId = logs.EVENT.MAIL_SIGNOUT, message = locale('logs.mail_signout', tostring(p.email), s.name) }, actor)
    end
end

---Register a mail endpoint. While sd-phone's mail is linked (configs/shared/phone.lua) the same
---endpoint runs server.computers.phonemail's handler instead - decided per call, so starting or
---stopping sd-phone switches every open Mail app on its next request.
---@param name string endpoint
---@param fn fun(src: integer, s: ComputerSession, payload: table): table built-in handler
local function register(name, fn)
    rpc.register(name, 'mail', function(src, s, payload)
        local alt = phonemail.handlers[name]
        if alt and phone.mailLinked() then
            local res = alt(src, s, payload)
            local ok, err = pcall(phoneLog, name, s, payload, res)
            if not ok then log.error('mail', 'phone log failed: %s', tostring(err)) end
            return res
        end
        return fn(src, s, payload)
    end)
end

---Mail home: the domain, every signed-in address with its folder counts, and whether the
---character may still create / sign into more.
register('mail:state', function(_, s)
    local accounts = {}
    for _, a in ipairs(mailstore.signedIn(s.citizenid)) do
        accounts[#accounts + 1] = { email = a.email, name = a.display_name, counts = mailstore.counts(a.email) }
    end
    return rpc.ok({
        domain = DOMAIN, accounts = accounts,
        canSignIn = #accounts < (M.MaxSignedIn or 5),
        canCreate = mailstore.createdBy(s.citizenid) < (M.MaxCreatedPerCharacter or 3),
    })
end)

---One folder of one signed-in address.
---@param payload { email: string, folder: string, search?: string }
register('mail:list', function(_, s, payload)
    local email = mine(s, payload.email)
    if not email then return rpc.fail('mail.err_not_signed_in') end
    local folder = FOLDERS[payload.folder] and payload.folder or 'inbox'
    local search = type(payload.search) == 'string' and payload.search ~= '' and text.clip(payload.search, 64) or nil
    local out = {}
    for _, r in ipairs(mailstore.list(email, folder, search, 200)) do out[#out + 1] = shape(r) end
    return rpc.ok({ messages = out, counts = mailstore.counts(email) })
end)

---Open a message (marks it read).
---@param payload { email: string, id: integer }
register('mail:read', function(_, s, payload)
    local email = mine(s, payload.email)
    local id = math.tointeger(tonumber(payload.id))
    if not email or not id then return rpc.fail('mail.err_not_signed_in') end
    local r = mailstore.get(email, id)
    if not r then return rpc.fail('mail.err_not_found') end
    if r.is_read ~= 1 and r.is_read ~= true then mailstore.setRead(email, id, true); r.is_read = 1 end
    return rpc.ok(shape(r))
end)

---Send from a signed-in address. A sent draft (draftId) is removed once delivered.
---@param payload { from: string, to: string|string[], subject: string, body: string, draftId?: integer }
register('mail:send', function(src, s, payload)
    local from = mine(s, payload.from)
    if not from then return rpc.fail('mail.err_not_signed_in') end
    if not ratelimit.take(src, 'mail:send', (M.RateLimit and M.RateLimit.Send) or 2) then return rpc.fail('err.slow_down') end
    local to = recipients(payload.to)
    if not to then return rpc.fail('mail.err_recipients', M.MaxRecipients or 20) end
    local subject, body = clip(payload.subject, payload.body)
    if body == '' and subject == '' then return rpc.fail('mail.err_empty') end

    local account = mailstore.account(from)
    local delivered, failed = mail.deliver({ email = from, name = account and account.display_name or from, account = true }, to, subject, body)
    local draftId = math.tointeger(tonumber(payload.draftId))
    if draftId then mailstore.delete(from, draftId) end

    if config.Logs and config.Logs.MailSent ~= false then
        logs.write(s.instance, {
            level = 'information', source = 'Mail', eventId = logs.EVENT.MAIL_SENT,
            message = locale('logs.mail_sent', from, table.concat(to, ', '), subject ~= '' and subject or locale('mail.no_subject')),
            data = { from = from, to = to, subject = subject, failed = failed },
        }, session.actor(s))
    end
    return rpc.ok({ delivered = delivered, failed = failed })
end)

---Save (create or update) a draft.
---@param payload { from: string, to: string|string[], subject: string, body: string, draftId?: integer }
register('mail:draft', function(_, s, payload)
    local from = mine(s, payload.from)
    if not from then return rpc.fail('mail.err_not_signed_in') end
    local to = {}
    if payload.to and payload.to ~= '' then to = recipients(payload.to) or {} end
    local subject, body = clip(payload.subject, payload.body)
    local account = mailstore.account(from)
    local m = { senderEmail = from, senderName = account and account.display_name or from, recipients = to, subject = subject, body = body, read = true }
    local id = math.tointeger(tonumber(payload.draftId))
    if id and mailstore.updateDraft(from, id, m) then return rpc.ok({ id = id }) end
    return rpc.ok({ id = mailstore.insert(from, 'drafts', m) })
end)

---Flag / unflag.
---@param payload { email: string, id: integer, flagged: boolean }
register('mail:flag', function(_, s, payload)
    local email, id = mine(s, payload.email), math.tointeger(tonumber(payload.id))
    if not email or not id then return rpc.fail('mail.err_not_signed_in') end
    mailstore.setFlagged(email, id, payload.flagged == true)
    return rpc.ok()
end)

---Mark read / unread.
---@param payload { email: string, id: integer, read: boolean }
register('mail:markRead', function(_, s, payload)
    local email, id = mine(s, payload.email), math.tointeger(tonumber(payload.id))
    if not email or not id then return rpc.fail('mail.err_not_signed_in') end
    mailstore.setRead(email, id, payload.read == true)
    return rpc.ok()
end)

---Move to the bin, or restore out of it to wherever it came from.
---@param payload { email: string, id: integer, bin: boolean }
register('mail:bin', function(_, s, payload)
    local email, id = mine(s, payload.email), math.tointeger(tonumber(payload.id))
    if not email or not id then return rpc.fail('mail.err_not_signed_in') end
    mailstore.bin(email, id, payload.bin ~= false)
    return rpc.ok()
end)

---Delete for good (bin/drafts only - anything else must go to the bin first).
---@param payload { email: string, id: integer }
register('mail:delete', function(_, s, payload)
    local email, id = mine(s, payload.email), math.tointeger(tonumber(payload.id))
    if not email or not id then return rpc.fail('mail.err_not_signed_in') end
    mailstore.delete(email, id)
    return rpc.ok()
end)

---Empty the bin.
---@param payload { email: string }
register('mail:emptyBin', function(_, s, payload)
    local email = mine(s, payload.email)
    if not email then return rpc.fail('mail.err_not_signed_in') end
    mailstore.emptyBin(email)
    return rpc.ok()
end)

---Create an address and sign straight into it.
---@param payload { username: string, password: string, name: string }
register('mail:signUp', function(src, s, payload)
    local user = validUsername(payload.username)
    if not user then return rpc.fail('mail.err_username') end
    local pw = payload.password
    if type(pw) ~= 'string' or #pw < (M.MinPassword or 6) or #pw > 64 then return rpc.fail('mail.err_password', M.MinPassword or 6) end
    local name = type(payload.name) == 'string' and payload.name:gsub('^%s+', ''):gsub('%s+$', '') or ''
    if name == '' or #name > (M.MaxDisplayName or 40) then return rpc.fail('mail.err_name', M.MaxDisplayName or 40) end
    if mailstore.createdBy(s.citizenid) >= (M.MaxCreatedPerCharacter or 3) then return rpc.fail('mail.err_create_cap', M.MaxCreatedPerCharacter or 3) end
    if #mailstore.signedIn(s.citizenid) >= (M.MaxSignedIn or 5) then return rpc.fail('mail.err_signin_cap', M.MaxSignedIn or 5) end
    if not ratelimit.take(src, 'mail:signUp', (M.RateLimit and M.RateLimit.SignUp) or 30) then
        return rpc.fail('err.wait', ratelimit.remaining(src, 'mail:signUp'))
    end

    local email = ('%s@%s'):format(user, DOMAIN)
    if not mailstore.createAccount(email, GetPasswordHash(pw), name, s.citizenid) then return rpc.fail('mail.err_taken') end
    mailstore.signIn(s.citizenid, email)
    logs.write(s.instance, { level = 'information', source = 'Mail', eventId = logs.EVENT.MAIL_CREATED, message = locale('logs.mail_created', email, s.name) }, session.actor(s))
    log.debug('mail', 'account %s created by %s', email, s.citizenid)
    return rpc.ok({ email = email })
end)

---Sign into an existing address with its password.
---@param payload { email: string, password: string }
register('mail:signIn', function(src, s, payload)
    local email = normalize(payload.email)
    if not email or type(payload.password) ~= 'string' then return rpc.fail('mail.err_credentials') end
    if not ratelimit.take(src, 'mail:signIn', (M.RateLimit and M.RateLimit.SignIn) or 2) then return rpc.fail('err.slow_down') end
    if #mailstore.signedIn(s.citizenid) >= (M.MaxSignedIn or 5) then return rpc.fail('mail.err_signin_cap', M.MaxSignedIn or 5) end

    local account = mailstore.account(email)
    if not account or not VerifyPasswordHash(payload.password, account.password_hash) then
        logs.write(s.instance, { level = 'failure', source = 'Mail', eventId = logs.EVENT.MAIL_SIGNIN, message = locale('logs.mail_signin_failed', email, s.name) }, session.actor(s))
        return rpc.fail('mail.err_credentials')
    end
    mailstore.signIn(s.citizenid, email)
    logs.write(s.instance, { level = 'success', source = 'Mail', eventId = logs.EVENT.MAIL_SIGNIN, message = locale('logs.mail_signin', email, s.name) }, session.actor(s))
    return rpc.ok({ email = email })
end)

---Sign out of an address (the account itself stays).
---@param payload { email: string }
register('mail:signOut', function(_, s, payload)
    local email = mine(s, payload.email)
    if not email then return rpc.ok() end
    mailstore.signOut(s.citizenid, email)
    logs.write(s.instance, { level = 'information', source = 'Mail', eventId = logs.EVENT.MAIL_SIGNOUT, message = locale('logs.mail_signout', email, s.name) }, session.actor(s))
    return rpc.ok()
end)

-- ── Exports ───────────────────────────────────────────────────────────────────────────────

---Send a system/NPC mail (no sent copy, no bounce). Backs the SendMail export and hack rewards.
---@param data { to: string|string[], subject?: string, body?: string, from?: { name?: string, email?: string } }
---@return table result { success: boolean, delivered: string[] }
function mail.sendSystem(data)
    if type(data) ~= 'table' then return { success = false, delivered = {} } end
    if phone.mailLinked() then return phonemail.sendSystem(data) end
    local to = recipients(data.to)
    if not to then return { success = false, delivered = {} } end
    local subject, body = clip(data.subject, data.body)
    local f = type(data.from) == 'table' and data.from or {}
    local fromEmail = normalize(f.email or 'no-reply') or ('no-reply@' .. DOMAIN)
    local delivered = mail.deliver({ email = fromEmail, name = text.clip(f.name or 'System', 64), account = false }, to, subject, body)
    return { success = #delivered > 0, delivered = delivered }
end

---Export: send a system/NPC mail from any server script (job offers, bank statements, heist
---intel). No sent copy is kept and nothing bounces. See mail.sendSystem. While sd-phone's mail is
---linked it lands in the phone's inboxes instead (the addresses players actually read).
exports('SendMail', mail.sendSystem)

---Export: does an address exist?
---@param email string
---@return boolean
exports('MailAddressExists', function(email)
    if phone.mailLinked() then return phonemail.exists(email) end
    local a = normalize(email)
    return a ~= nil and mailstore.account(a) ~= nil
end)

---Export: the addresses a character is signed into (e.g. to mail them a reward).
---@param citizenid string
---@return string[]
exports('GetMailAddresses', function(citizenid)
    if phone.mailLinked() then return phonemail.addressesOf(citizenid) end
    local out = {}
    for _, a in ipairs(mailstore.signedIn(citizenid)) do out[#out + 1] = a.email end
    return out
end)

---Every address a character is signed into (server modules: hack rewards).
---@param citizenid string
---@return string[]
function mail.addressesOf(citizenid)
    if phone.mailLinked() then return phonemail.addressesOf(citizenid) end
    local out = {}
    for _, a in ipairs(mailstore.signedIn(citizenid)) do out[#out + 1] = a.email end
    return out
end

return mail
