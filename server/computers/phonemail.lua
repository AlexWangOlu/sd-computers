---@type table Optional sd-phone link (server.computers.phone).
local phone = require 'server.computers.phone'
---@type table UTF-8-safe clipping (shared.text).
local text = require 'shared.text'

-- Mail on the phone's accounts. When the link is live (phone.mailLinked) every mail:* rpc lands
-- here instead of the built-in mailstore: the same endpoints, payloads and reply shapes the Mail app
-- already speaks, translated to sd-phone's mail actions. The phone keeps a mailbox as one row of
-- messages with string ids and ISO timestamps; this file maps those onto the app's Message shape
-- (server/computers/mail.lua `shape`) so the NUI needs no second code path.

---@type table Phone-mail module; the table returned at end of file.
local phonemail = {}

---@type table Defaults for sd-phone's mail rules until its config answers.
local FALLBACK = { domain = 'lifeinvader.com', maxAccounts = 3, minPassword = 6, maxName = 40, maxRecipients = 20, maxSubject = 200, maxBody = 10000 }

---sd-phone's mail domain + limits (asks the link; FALLBACK when it can't).
---@param src integer any online player (the link needs a valid source)
---@return table
function phonemail.config(src)
    local res = phone.call(src, 'mail', 'config')
    local c = res.success and type(res.data) == 'table' and res.data or {}
    local out = {}
    for k, v in pairs(FALLBACK) do out[k] = c[k] ~= nil and c[k] or v end
    out.domain = tostring(out.domain):lower()
    return out
end

---Days since 1970-01-01 for a proleptic-Gregorian date (UTC, no os.time timezone games).
---@param y integer
---@param m integer
---@param d integer
---@return integer
local function daysFromCivil(y, m, d)
    if m <= 2 then y = y - 1 end
    local era = (y >= 0 and y or y - 399) // 400
    local yoe = y - era * 400
    local doy = (153 * (m + (m > 2 and -3 or 9)) + 2) // 5 + d - 1
    local doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
    return era * 146097 + doe - 719468
end

---The phone's sentAt ('YYYY-MM-DDTHH:MM:SS', UTC) as unix seconds.
---@param iso any
---@return integer
local function isoToUnix(iso)
    local y, mo, d, h, mi, s = tostring(iso or ''):match('^(%d+)%-(%d+)%-(%d+)T(%d+):(%d+):(%d+)')
    if not y then return os.time() end
    return daysFromCivil(tonumber(y) --[[@as integer]], tonumber(mo) --[[@as integer]], tonumber(d) --[[@as integer]]) * 86400
        + tonumber(h) * 3600 + tonumber(mi) * 60 + tonumber(s)
end

---Attachments the desk can show: photos, voice clips, notes and document names (document bodies
---stay on the phone - they can be large).
---@param list any
---@return table[]|nil
local function attachments(list)
    if type(list) ~= 'table' or #list == 0 then return nil end
    local out = {}
    for _, a in ipairs(list) do
        if type(a) == 'table' then
            if a.kind == 'photo' and type(a.url) == 'string' then
                out[#out + 1] = { kind = 'photo', url = a.url }
            elseif a.kind == 'audio' then
                out[#out + 1] = { kind = 'audio', name = a.name or locale('ui.mail.att_audio'), duration = a.duration }
            elseif a.kind == 'note' then
                out[#out + 1] = { kind = 'note', title = a.title or '', body = text.clip(a.body or '', 5000) }
            elseif a.kind == 'document' then
                out[#out + 1] = { kind = 'document', name = a.name or locale('ui.mail.att_document') }
            end
        end
    end
    return #out > 0 and out or nil
end

---A phone MailMessage as the app's Message.
---@param m table
---@param full boolean include the body (reading pane) rather than just the preview (lists)
---@return table
local function shape(m, full)
    local from = type(m.from) == 'table' and m.from or {}
    local body = type(m.body) == 'string' and m.body or ''
    return {
        id = m.id, folder = m.folder or 'inbox',
        from = { email = from.email or '', name = from.name or from.email or '' },
        to = type(m.to) == 'table' and m.to or {}, subject = m.subject or '',
        preview = text.clip((body:gsub('%s+', ' ')), 160), body = full and body or nil,
        read = m.read == true, flagged = m.flagged == true, ts = isoToUnix(m.sentAt),
        attachments = full and attachments(m.attachments) or nil, hasAttachments = type(m.attachments) == 'table' and #m.attachments > 0,
    }
end

---Folder counts for one account, the same keys mailstore.counts returns (+ spam).
---@param messages table[] that account's phone messages
---@return table
local function counts(messages)
    local c = { unread = 0, inbox = 0, sent = 0, drafts = 0, bin = 0, spam = 0, flagged = 0 }
    for _, m in ipairs(messages) do
        local f = m.folder or 'inbox'
        if c[f] then c[f] = c[f] + 1 end
        if f == 'inbox' and m.read ~= true then c.unread = c.unread + 1 end
        if m.flagged == true and f ~= 'bin' then c.flagged = c.flagged + 1 end
    end
    return c
end

---The caller's whole phone mail: signed-in accounts + their messages grouped by address.
---@param src integer
---@return table|nil snap { accounts = MailAccount[], byAccount = table<string, table[]> }
---@return table|nil err rpc reply when the phone refused
local function snapshot(src)
    local res = phone.call(src, 'mail', 'list')
    if not res.success then return nil, phone.reply(res) end
    local data = type(res.data) == 'table' and res.data or {}
    local byAccount = {}
    for _, a in ipairs(data.accounts or {}) do byAccount[a.email] = {} end
    for _, m in ipairs(data.messages or {}) do
        local list = byAccount[m.accountId]
        if list then list[#list + 1] = m end
    end
    return { accounts = data.accounts or {}, byAccount = byAccount }, nil
end

---One message of a signed-in account, or an rpc failure.
---@param src integer
---@param email any
---@param id any
---@return table|nil msg
---@return table|nil err rpc reply when it isn't there
local function find(src, email, id)
    local snap, err = snapshot(src)
    if not snap then return nil, err end
    local list = type(email) == 'string' and snap.byAccount[email:lower()]
    if not list then return nil, { ok = false, error = locale('mail.err_not_signed_in') } end
    id = tostring(id or '')
    for _, m in ipairs(list) do
        if m.id == id then return m, nil end
    end
    return nil, { ok = false, error = locale('mail.err_not_found') }
end

---Normalise a recipient: trim + lowercase; a bare username gets the phone's domain.
---@param raw any
---@param domain string
---@return string|nil
local function normalize(raw, domain)
    if type(raw) ~= 'string' then return nil end
    local a = raw:gsub('^%s+', ''):gsub('%s+$', ''):lower()
    if a == '' then return nil end
    if not a:find('@', 1, true) then a = a .. '@' .. domain end
    if #a > 64 or not a:match('^[^@%s]+@[^@%s]+$') then return nil end
    return a
end

---Recipient list (array or comma/semicolon string) -> unique normalised addresses; nil on a bad one.
---@param to any
---@param cfg table phonemail.config
---@return string[]|nil
local function recipients(to, cfg)
    local raw = {}
    if type(to) == 'string' then
        for part in to:gmatch('[^,;]+') do raw[#raw + 1] = part end
    elseif type(to) == 'table' then
        raw = to
    end
    local out, seen = {}, {}
    for _, r in ipairs(raw) do
        local a = normalize(r, cfg.domain)
        if not a then return nil end
        if not seen[a] then seen[a] = true; out[#out + 1] = a end
    end
    if #out == 0 or #out > cfg.maxRecipients then return nil end
    return out
end

---Where a message restored out of the bin goes: Sent when the account wrote it, else Inbox (the
---phone doesn't remember a binned message's old folder).
---@param m table
---@param email string
---@return string
local function restoreFolder(m, email)
    local from = type(m.from) == 'table' and m.from.email or ''
    return tostring(from):lower() == email and 'sent' or 'inbox'
end

-- ── rpc handlers: name -> fn(src, s, payload) -> { ok, data?, error? } ───────────────────────

---@type table<string, fun(src: integer, s: table, p: table): table>
phonemail.handlers = {}
local H = phonemail.handlers

H['mail:state'] = function(src)
    local snap, err = snapshot(src)
    if not snap then return err --[[@as table]] end
    local cfg = phonemail.config(src)
    local accounts = {}
    for _, a in ipairs(snap.accounts) do
        accounts[#accounts + 1] = { email = a.email, name = a.name or a.email, counts = counts(snap.byAccount[a.email] or {}) }
    end
    return { ok = true, data = {
        domain = cfg.domain, accounts = accounts, phone = true,
        canSignIn = #accounts < cfg.maxAccounts, canCreate = #accounts < cfg.maxAccounts,
    } }
end

H['mail:list'] = function(src, _, p)
    local snap, err = snapshot(src)
    if not snap then return err --[[@as table]] end
    local email = type(p.email) == 'string' and p.email:lower() or ''
    local list = snap.byAccount[email]
    if not list then return { ok = false, error = locale('mail.err_not_signed_in') } end
    local folder = type(p.folder) == 'string' and p.folder or 'inbox'
    local search = type(p.search) == 'string' and p.search ~= '' and text.clip(p.search, 64):lower() or nil
    local out = {}
    for _, m in ipairs(list) do
        local f = m.folder or 'inbox'
        local inView = folder == 'flagged' and (m.flagged == true and f ~= 'bin') or f == folder
        if inView and search then
            local from = type(m.from) == 'table' and m.from or {}
            local hay = table.concat({ m.subject or '', from.name or '', from.email or '', m.body or '' }, '\n'):lower()
            inView = hay:find(search, 1, true) ~= nil
        end
        if inView then out[#out + 1] = shape(m, false) end
    end
    table.sort(out, function(a, b) return a.ts > b.ts end)
    return { ok = true, data = { messages = out, counts = counts(list) } }
end

H['mail:read'] = function(src, _, p)
    local m, err = find(src, p.email, p.id)
    if not m then return err --[[@as table]] end
    if m.read ~= true then
        phone.call(src, 'mail', 'markRead', { accountEmail = p.email:lower(), messageId = m.id })
        m.read = true
    end
    return { ok = true, data = shape(m, true) }
end

H['mail:send'] = function(src, _, p)
    local cfg = phonemail.config(src)
    local from = type(p.from) == 'string' and p.from:lower() or ''
    local to = recipients(p.to, cfg)
    if not to then return { ok = false, error = locale('mail.err_recipients', cfg.maxRecipients) } end
    local subject, body = text.clip(p.subject, cfg.maxSubject), text.clip(p.body, cfg.maxBody)
    if subject == '' and body == '' then return { ok = false, error = locale('mail.err_empty') } end

    -- The phone drops unknown addresses silently; ask first so the desk can say which bounced.
    local delivered, failed = {}, {}
    for _, a in ipairs(to) do
        if phone.export('mailAddressExists', a) == true then delivered[#delivered + 1] = a else failed[#failed + 1] = a end
    end
    if #delivered > 0 then
        local res = phone.call(src, 'mail', 'send', { fromEmail = from, to = delivered, subject = subject, body = body })
        if not res.success then return phone.reply(res) end
    end
    if p.draftId ~= nil then phone.call(src, 'mail', 'discardDraft', { accountEmail = from, messageId = tostring(p.draftId) }) end
    return { ok = true, data = { delivered = delivered, failed = failed } }
end

---The phone's saveDraft always makes a new draft, so an edited draft replaces the old one.
H['mail:draft'] = function(src, _, p)
    local cfg = phonemail.config(src)
    local from = type(p.from) == 'string' and p.from:lower() or ''
    local to = {}
    if p.to and p.to ~= '' then to = recipients(p.to, cfg) or {} end
    local res = phone.call(src, 'mail', 'saveDraft', {
        fromEmail = from, to = to, subject = text.clip(p.subject, cfg.maxSubject), body = text.clip(p.body, cfg.maxBody),
    })
    if not res.success then return phone.reply(res) end
    if p.draftId ~= nil then phone.call(src, 'mail', 'discardDraft', { accountEmail = from, messageId = tostring(p.draftId) }) end
    local draft = type(res.data) == 'table' and res.data.draft or {}
    return { ok = true, data = { id = draft.id } }
end

---The phone only toggles; set the asked-for state.
H['mail:flag'] = function(src, _, p)
    local m, err = find(src, p.email, p.id)
    if not m then return err --[[@as table]] end
    if (m.flagged == true) ~= (p.flagged == true) then
        return phone.rpc(src, 'mail', 'toggleFlag', { accountEmail = p.email:lower(), messageId = m.id })
    end
    return { ok = true }
end

H['mail:markRead'] = function(src, _, p)
    local email = type(p.email) == 'string' and p.email:lower() or ''
    return phone.rpc(src, 'mail', p.read == true and 'markRead' or 'markUnread', { accountEmail = email, messageId = tostring(p.id or '') })
end

---Bin / restore. The phone hard-deletes a message binned twice, so only bin what isn't there yet.
H['mail:bin'] = function(src, _, p)
    local m, err = find(src, p.email, p.id)
    if not m then return err --[[@as table]] end
    local email = p.email:lower()
    if p.bin ~= false then
        if m.folder == 'bin' then return { ok = true } end
        return phone.rpc(src, 'mail', 'moveToBin', { accountEmail = email, messageId = m.id })
    end
    if m.folder ~= 'bin' then return { ok = true } end
    return phone.rpc(src, 'mail', 'move', { accountEmail = email, messageId = m.id, folder = restoreFolder(m, email) })
end

---Delete for good: bin (second moveToBin deletes) and drafts only, as the built-in Mail.
H['mail:delete'] = function(src, _, p)
    local m, err = find(src, p.email, p.id)
    if not m then return err --[[@as table]] end
    local email = p.email:lower()
    if m.folder == 'bin' then return phone.rpc(src, 'mail', 'moveToBin', { accountEmail = email, messageId = m.id }) end
    if m.folder == 'drafts' then return phone.rpc(src, 'mail', 'discardDraft', { accountEmail = email, messageId = m.id }) end
    return { ok = true }
end

H['mail:emptyBin'] = function(src, _, p)
    return phone.rpc(src, 'mail', 'emptyBin', { accountEmail = type(p.email) == 'string' and p.email:lower() or '' })
end

H['mail:signUp'] = function(src, _, p)
    local res = phone.call(src, 'mail', 'signUp', { email = p.username, password = p.password, displayName = p.name })
    return phone.reply(res, function(d) return { email = type(d) == 'table' and d.account and d.account.email or nil } end)
end

H['mail:signIn'] = function(src, _, p)
    local cfg = phonemail.config(src)
    local email = normalize(p.email, cfg.domain)
    if not email or type(p.password) ~= 'string' then return { ok = false, error = locale('mail.err_credentials') } end
    local res = phone.call(src, 'mail', 'signIn', { email = email, password = p.password })
    return phone.reply(res, function(d) return { email = type(d) == 'table' and d.account and d.account.email or email } end)
end

H['mail:signOut'] = function(src, _, p)
    return phone.rpc(src, 'mail', 'signOut', { email = type(p.email) == 'string' and p.email:lower() or '' })
end

-- ── exports / server modules ────────────────────────────────────────────────────────────────

---SendMail export on the phone: system mail into phone inboxes.
---@param data table { to, subject?, body?, from? }
---@return table { success, delivered: string[] }
function phonemail.sendSystem(data)
    local list = {}
    if type(data.to) == 'string' then
        for part in data.to:gmatch('[^,;]+') do list[#list + 1] = part end
    elseif type(data.to) == 'table' then
        list = data.to
    end
    local delivered = {}
    for _, a in ipairs(list) do
        if type(a) == 'string' and phone.export('mailAddressExists', a) == true then delivered[#delivered + 1] = a:lower() end
    end
    if #delivered == 0 then return { success = false, delivered = {} } end
    local res = phone.export('sendMail', { to = delivered, subject = data.subject, body = data.body, from = data.from })
    return { success = type(res) == 'table' and res.success == true, delivered = delivered }
end

---Whether a phone mail address exists.
---@param email any
---@return boolean
function phonemail.exists(email)
    return type(email) == 'string' and phone.export('mailAddressExists', email) == true
end

---Phone addresses a character is signed into.
---@param citizenid string
---@return string[]
function phonemail.addressesOf(citizenid)
    local out = {}
    for _, a in ipairs(phone.export('getMailAddresses', citizenid) or {}) do out[#out + 1] = a.email end
    return out
end

return phonemail
