---@type table RPC registration (server.computers.rpc).
local rpc = require 'server.computers.rpc'
---@type table Optional sd-phone link (server.computers.phone).
local phone = require 'server.computers.phone'
---@type table UTF-8-safe clipping (shared.text).
local text = require 'shared.text'

-- The phone apps: Messages (the character's texts) and Notes (their phone notes), installed by
-- session.lua only while sd-phone is linked (configs/shared/phone.lua). Each endpoint is guarded
-- like every other app (signed in, in reach, app installed) and then runs the phone's own action
-- through the link, so a text sent from a desk lands, notifies and threads exactly like one sent
-- from the phone. Phone data is personal, so none of this is written to the System Logs.

---@type integer Longest text the desk sends (the phone itself cuts at 1000).
local MAX_TEXT = 1000

---Register a phone-app endpoint: refused cleanly when the link dropped since the app was installed.
---@param name string endpoint
---@param app string app id the session must have
---@param fn fun(src: integer, s: ComputerSession, p: table): table
local function register(name, app, fn)
    rpc.register(name, app, function(src, s, p)
        if not phone.linked() then return rpc.fail('err.phone_unavailable') end
        return fn(src, s, p)
    end)
end

-- ── Messages ──────────────────────────────────────────────────────────────────────────────

---A thread's display title: the group name, else the other participants' names.
---@param c table phone Conversation
---@return string
local function titleOf(c)
    if type(c.groupName) == 'string' and c.groupName ~= '' then return c.groupName end
    local names = {}
    for _, p in ipairs(c.participants or {}) do names[#names + 1] = p.name or p.phone or '?' end
    return #names > 0 and table.concat(names, ', ') or tostring(c.id)
end

---A participant/contact, trimmed to what the desk draws.
---@param p table phone Contact
---@return table
local function contact(p)
    return { id = p.id, name = p.name or p.phone or '', initials = p.initials, color = p.color, avatar = p.avatar, phone = p.phone }
end

---A phone message, trimmed to what the desk draws (kind-specific extras kept for the labels).
---@param m table phone Message
---@return table
local function message(m)
    return {
        id = m.id, from = m.from, body = m.body or '', kind = m.kind or 'text', ts = m.ts, read = m.read == true, seenAt = m.seenAt,
        gifUrl = m.gifUrl, amount = m.amount, duration = m.duration, requested = m.requested == true, requestStatus = m.requestStatus,
    }
end

---A conversation for the list (latest message only) or the open thread (all of them).
---@param c table phone Conversation
---@param full boolean
---@return table
local function conversation(c, full)
    local parts = {}
    for _, p in ipairs(c.participants or {}) do parts[#parts + 1] = contact(p) end
    local out = {
        id = c.id, title = titleOf(c), participants = parts, group = c.groupName ~= nil,
        unread = tonumber(c.unread) or 0, muted = c.muted == true,
    }
    local msgs = c.messages or {}
    if full then
        local list = {}
        for _, m in ipairs(msgs) do list[#list + 1] = message(m) end
        out.messages = list
    elseif msgs[1] then
        out.last = message(msgs[1])
    end
    return out
end

---Every conversation (newest first), the phone's contacts and the player's own number.
register('messages:list', 'messages', function(src)
    return phone.rpc(src, 'messages', 'list', nil, function(d)
        d = type(d) == 'table' and d or {}
        local convs, contacts = {}, {}
        for _, c in ipairs(d.conversations or {}) do convs[#convs + 1] = conversation(c, false) end
        for _, p in ipairs(d.contacts or {}) do contacts[#contacts + 1] = contact(p) end
        return { conversations = convs, contacts = contacts, myNumber = d.myNumber, myName = d.myName }
    end)
end)

---One thread, oldest message first (up to the phone's 200).
---@param p { id: string }
register('messages:thread', 'messages', function(src, _, p)
    if type(p.id) ~= 'string' or p.id == '' then return rpc.fail('err.invalid') end
    return phone.rpc(src, 'messages', 'thread', { id = p.id }, function(d)
        return conversation(type(d) == 'table' and d.conversation or {}, true)
    end)
end)

---Send a text to a thread id (a number for 1:1, 'g-<id>' for a group) or to a new number.
---@param p { conversation: string, body: string }
register('messages:send', 'messages', function(src, _, p)
    local conv = type(p.conversation) == 'string' and p.conversation or tostring(p.conversation or '')
    if not conv:match('^g%-') then conv = conv:gsub('%D', '') end
    if conv == '' or conv == 'g-' then return rpc.fail('messages.err_number') end
    local body = text.trim(text.clip(p.body, MAX_TEXT))
    if body == '' then return rpc.fail('messages.err_empty') end
    return phone.rpc(src, 'messages', 'send', { conversation = conv, body = body }, function(d)
        return type(d) == 'table' and message(d) or nil
    end)
end)

---Mark a thread read (the phone tells a 1:1 peer it was seen).
---@param p { conversation: string }
register('messages:read', 'messages', function(src, _, p)
    if type(p.conversation) ~= 'string' then return rpc.fail('err.invalid') end
    return phone.rpc(src, 'messages', 'markRead', { conversation = p.conversation }, function() return nil end)
end)

---Delete a thread from this phone (leaves a group).
---@param p { conversation: string }
register('messages:delete', 'messages', function(src, _, p)
    if type(p.conversation) ~= 'string' then return rpc.fail('err.invalid') end
    return phone.rpc(src, 'messages', 'delete', { conversation = p.conversation }, function() return nil end)
end)

-- ── Notes ─────────────────────────────────────────────────────────────────────────────────
-- Endpoints are phonenotes:* - notes:* is the built-in Notepad's own storage (shell.lua).

---A note's title: its first non-empty line (the phone's rule - notes have no title field).
---@param body string
---@return string
local function noteTitle(body)
    for line in (body .. '\n'):gmatch('([^\n]*)\n') do
        local t = text.trim(line)
        if t ~= '' then return text.clip(t, 200) end -- the list truncates visually; search sees it all
    end
    return ''
end

---A note for the list: title + preview + media counts (sketches are big data URLs - fetched only
---when the note is opened).
---@param n table phone Note
---@return table
local function noteRow(n)
    local body = type(n.body) == 'string' and n.body or ''
    local title = noteTitle(body)
    local rest = body:gsub('^%s*[^\n]*\n?', '', 1)
    return {
        id = n.id, title = title, preview = text.clip(text.trim((rest:gsub('%s+', ' '))), 120),
        images = type(n.images) == 'table' and #n.images or 0, sketches = type(n.sketches) == 'table' and #n.sketches or 0,
        createdAt = n.createdAt, updatedAt = n.updatedAt,
    }
end

---Every phone note, newest-edited first.
register('phonenotes:list', 'notes', function(src)
    return phone.rpc(src, 'notes', 'list', nil, function(d)
        local out = {}
        for _, n in ipairs(type(d) == 'table' and d.notes or {}) do out[#out + 1] = noteRow(n) end
        return { notes = out }
    end)
end)

---One note in full: body, photo URLs and sketch images (shown read-only on the desk).
---@param p { id: string }
register('phonenotes:get', 'notes', function(src, _, p)
    if type(p.id) ~= 'string' then return rpc.fail('err.invalid') end
    local res = phone.call(src, 'notes', 'list')
    if not res.success then return phone.reply(res) end
    for _, n in ipairs(type(res.data) == 'table' and res.data.notes or {}) do
        if n.id == p.id then
            return rpc.ok({
                id = n.id, body = n.body or '', images = n.images or {}, sketches = n.sketches or {},
                createdAt = n.createdAt, updatedAt = n.updatedAt,
            })
        end
    end
    return rpc.fail('notes.err_missing')
end)

---Create (no id) or update a note's text; its photos and sketches are kept by the link.
---@param p { id?: string, body: string }
register('phonenotes:save', 'notes', function(src, _, p)
    local id = type(p.id) == 'string' and p.id ~= '' and p.id or nil
    return phone.rpc(src, 'notes', 'save', { id = id, body = text.clip(p.body, 20000) })
end)

---Delete a note.
---@param p { id: string }
register('phonenotes:delete', 'notes', function(src, _, p)
    if type(p.id) ~= 'string' then return rpc.fail('err.invalid') end
    return phone.rpc(src, 'notes', 'delete', { id = p.id }, function() return nil end)
end)

return {}
