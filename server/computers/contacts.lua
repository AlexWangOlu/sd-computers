---@type table RPC registration (server.computers.rpc).
local rpc = require 'server.computers.rpc'
---@type table Optional sd-phone link (server.computers.phone).
local phone = require 'server.computers.phone'
---@type table UTF-8-safe clipping (shared.text).
local text = require 'shared.text'

-- Contacts: the character's phone address book on the big screen. Installed by session.lua only
-- while sd-phone is linked (configs/shared/phone.lua). Each endpoint is guarded like every other
-- app (signed in, in reach, app installed) and then goes through sd-phone's public contact exports
-- (getContacts, addContact, removeContactByNumber). Those resolve the owner from the player's
-- server id and run the phone's own checks, hooks and live pushes, so the phone and the desk are
-- one address book: a contact added here is on the phone at once, and the phone's rules (the
-- number must be in service, not your own, not saved twice) are the ones that apply. Phone data
-- is personal, so none of this is written to the System Logs.

---@type integer Longest name the desk sends (the phone's own cap is its Contacts.MaxNameLength).
local MAX_NAME = 60
---@type integer Fewest digits the desk takes for a phone number.
local MIN_DIGITS = 3
---@type integer Most digits the desk takes for a phone number.
local MAX_DIGITS = 15
---@type integer Longest number, as typed, either endpoint reads (the phone's own column is this wide).
local MAX_TYPED = 32

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

---The bare digits of a phone number typed any way ("(555) 123-4567" -> "5551234567"). nil when
---it isn't a number at all: the wrong type, too long, or holding anything but digits and the
---usual separators.
---@param v any
---@return string|nil
local function digits(v)
    -- A whole number that arrived as a float is written out first, so 5551234.0 gains no digit.
    if math.type(v) == 'float' and v % 1 == 0 then v = ('%.0f'):format(v) end
    if type(v) == 'number' then v = tostring(v) end
    if type(v) ~= 'string' or #v > MAX_TYPED or v:find('[^%d%s%(%)%+%-%.]') then return nil end
    return (v:gsub('%D', ''))
end

---A contact, trimmed to what the desk draws. A contact saved without a name shows its number.
---@param c table sd-phone Contact { id, name, phone, email, address, color, avatar, initials, favorite }
---@return table
local function contact(c)
    local number = (tostring(c.phone or ''):gsub('%D', ''))
    local name = type(c.name) == 'string' and c.name or ''
    return {
        id = c.id, name = name ~= '' and name or number, number = number,
        initials = c.initials, color = c.color, avatar = c.avatar, favorite = c.favorite == true,
        email = c.email, address = c.address,
    }
end

---List order: by name whatever its case, then by number and id so equal names never swap places.
---@param a table
---@param b table
---@return boolean
local function byName(a, b)
    local x, y = a.name:lower(), b.name:lower()
    if x ~= y then return x < y end
    if a.number ~= b.number then return a.number < b.number end
    return tostring(a.id) < tostring(b.id)
end

---The address book, sorted by name.
register('contacts:list', 'contacts', function(src)
    local rows = phone.export('getContacts', src)
    -- An empty book is an empty array. nil is the phone not knowing this player, or the call
    -- itself failing (sd-phone stopped between the link check and here).
    if type(rows) ~= 'table' then return rpc.fail('err.phone_unavailable') end
    local out = {}
    for _, c in ipairs(rows) do
        if type(c) == 'table' then out[#out + 1] = contact(c) end
    end
    table.sort(out, byName)
    return rpc.ok({ contacts = out })
end)

---Save a new contact. The desk checks only that there is a name and a number to send; whether
---the number is in service, the player's own or already saved is the phone's call, and its
---refusal comes back as the error.
---@param p { name: string, number: string }
register('contacts:add', 'contacts', function(src, _, p)
    -- Clipped before trimming: the trim is only ever run on a short string.
    local name = type(p.name) == 'string' and text.trim(text.clip(p.name, MAX_NAME)) or ''
    if name == '' then return rpc.fail('contacts.err_name') end
    local number = digits(p.number)
    if not number or #number < MIN_DIGITS or #number > MAX_DIGITS then
        return rpc.fail('contacts.err_number', MIN_DIGITS, MAX_DIGITS)
    end
    local res = phone.export('addContact', src, { name = name, phone = number })
    if type(res) ~= 'table' then return rpc.fail('err.phone_unavailable') end
    return phone.reply(res, function(d) return type(d) == 'table' and contact(d) or nil end)
end)

---Remove a contact by its number. The phone removes every card saved under that number, and a
---number that matches nothing still succeeds (it was already deleted on the phone).
---@param p { number: string }
register('contacts:remove', 'contacts', function(src, _, p)
    local number = digits(p.number)
    if not number or number == '' then return rpc.fail('err.invalid') end
    local res = phone.export('removeContactByNumber', src, number)
    if type(res) ~= 'table' then return rpc.fail('err.phone_unavailable') end
    return phone.reply(res, function(d) return { removed = type(d) == 'table' and tonumber(d.removed) or 0 } end)
end)

return {}
