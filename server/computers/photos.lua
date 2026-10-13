---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table RPC registration (server.computers.rpc).
local rpc = require 'server.computers.rpc'
---@type table Optional sd-phone link (server.computers.phone).
local phone = require 'server.computers.phone'
---@type table Rate-limit helper (server.computers.ratelimit).
local ratelimit = require 'server.computers.ratelimit'
---@type table Rich documents (server.computers.richdoc): what an address has to look like.
local richdoc = require 'server.computers.richdoc'

---@type table Photos config (configs/shared/photos.lua).
local G = config.Photos or {}
---@type table Phone link config (configs/shared/phone.lua).
local P = config.Phone or {}

-- Photos: the character's pictures. Two places, in one list:
--   the computer's own - pictures added by their link, kept in computers_photos under the
--     character's citizenid, so they are there on every computer (like their documents);
--   the phone's gallery, while sd-phone is linked and the phone is linked to this machine - read
--     through sd-phone's public getPhotos export, which works out the owner from the player's
--     server id itself. Taking, sorting and deleting those stays on the phone.
-- Every query names the session's own citizenid: a row id from the NUI never reaches somebody
-- else's picture. Pictures are personal, so none of this is written to the System Logs.
--
-- This file also answers for Files: which pictures a document of this player may hold
-- (photos.allowed). A document can be printed and handed to anyone, whose game then fetches every
-- picture in it - so a document only takes pictures out of the gallery, and the gallery only takes
-- links from the hosts configs/shared/photos.lua lists.

---@type table Photos module; the table returned at end of file.
local photos = {}

---@type integer Pictures one character may keep.
local MAX_PHOTOS = math.max(1, math.floor(tonumber(G.MaxPhotos) or 200))
---@type integer Most photos one phone list carries (sd-phone's own page size; its export clamps to it).
local PHONE_PAGE = 200

---Create the table if it doesn't exist, so the resource stays drop-in. Run once at boot.
function photos.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS computers_photos (
            id         INT          NOT NULL AUTO_INCREMENT,
            citizenid  VARCHAR(64)  NOT NULL,
            url        VARCHAR(400) NOT NULL,
            created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_citizen (citizenid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
end

---Whether a link is on a host a picture may come from.
---@param url string an https address (richdoc.isUrl)
---@return boolean
local function hostAllowed(url)
    if G.Hosts == false then return true end
    local host = (url:match('^https://([^/%?#:]+)') or ''):lower()
    for _, h in ipairs(type(G.Hosts) == 'table' and G.Hosts or {}) do
        h = tostring(h):lower()
        if host == h or host:sub(-#h - 1) == '.' .. h then return true end
    end
    return false
end

---Whether this session shows the phone's gallery: sd-phone linked, Phone.Photos on, a computer that
---hasn't opted out of the phone, and the phone linked to this machine (the rule the phone apps and
---the Phone place in Files go by).
---@param src integer
---@param s ComputerSession
---@return boolean
local function phoneSide(src, s)
    if P.Photos == false or s.def.phone == false or not phone.linked() then return false end
    return phone.unlocked(src, s.citizenid, s.instance)
end

---The character's own pictures, newest first.
---@param citizenid string
---@return table[] rows { id, url, ts }
local function own(citizenid)
    return MySQL.query.await('SELECT id, url, UNIX_TIMESTAMP(created_at) AS ts FROM computers_photos WHERE citizenid = ? ORDER BY id DESC', { citizenid }) or {}
end

---The phone's gallery as sd-phone hands it over, or nil when the call itself failed.
---@param src integer
---@return table[]|nil rows sd-phone photos { id, url, isVideo, favorite, timestamp }
local function phoneRows(src)
    local rows = phone.export('getPhotos', src, { limit = PHONE_PAGE })
    return type(rows) == 'table' and rows or nil
end

---Every picture this session can look at: the character's own, then the phone's (the app sorts
---them by date). `phone` says whether the phone's place is there at all.
rpc.register('photos:list', 'photos', function(src, s)
    local out = {}
    for _, r in ipairs(own(s.citizenid)) do
        out[#out + 1] = { id = 'pc:' .. r.id, url = r.url, ts = math.floor(tonumber(r.ts) or 0), video = false, favorite = false, place = 'computer' }
    end
    local mine = #out

    local linked, capped = phoneSide(src, s), false
    if linked then
        local rows = phoneRows(src)
        -- (the link dropped between the check and the call: the computer's own pictures still show)
        if not rows then
            linked = false
        else
            for _, p in ipairs(rows) do
                if type(p) == 'table' and type(p.url) == 'string' and p.url ~= '' then
                    out[#out + 1] = {
                        id = tostring(p.id), url = p.url, ts = math.floor(tonumber(p.timestamp) or 0),
                        video = p.isVideo == true, favorite = p.favorite == true, place = 'phone',
                    }
                end
            end
            -- A full page means the phone may hold older ones the desk isn't showing.
            capped = #rows >= PHONE_PAGE
        end
    end
    return rpc.ok({ photos = out, capped = capped, phone = linked, count = mine, max = MAX_PHOTOS, anyHost = G.Hosts == false })
end)

---Add a picture by its link.
---@param p { url: string }
rpc.register('photos:add', 'photos', function(src, s, p)
    local url = type(p.url) == 'string' and p.url:gsub('^%s+', ''):gsub('%s+$', '') or ''
    if not richdoc.isUrl(url) then return rpc.fail('photos.err_link') end
    if not hostAllowed(url) then return rpc.fail('photos.err_host') end
    if not ratelimit.take(src, 'photos:add', 1) then return rpc.fail('err.slow_down') end

    local rows = own(s.citizenid)
    if #rows >= MAX_PHOTOS then return rpc.fail('photos.err_full', MAX_PHOTOS) end
    for _, r in ipairs(rows) do
        if r.url == url then return rpc.fail('photos.err_have') end
    end
    local id = MySQL.insert.await('INSERT INTO computers_photos (citizenid, url) VALUES (?, ?)', { s.citizenid, url })
    if not id then return rpc.fail('err.internal') end
    return rpc.ok({ id = 'pc:' .. id, url = url, ts = os.time(), video = false, favorite = false, place = 'computer' })
end)

---Take one of the character's own pictures out (a no-op for one that is already gone). A
---document that holds it keeps it.
---@param p { id: string }
rpc.register('photos:delete', 'photos', function(_, s, p)
    local id = type(p.id) == 'string' and math.tointeger(tonumber(p.id:match('^pc:(%d+)$'))) or nil
    if not id then return rpc.fail('err.invalid') end
    MySQL.query.await('DELETE FROM computers_photos WHERE id = ? AND citizenid = ?', { id, s.citizenid })
    return rpc.ok()
end)

---Whether a document of this player may hold these pictures: each one is in their gallery (the
---computer's, or the phone's while that is here), or was in the document already.
---@param src integer
---@param s ComputerSession
---@param urls string[] the pictures in the document being saved
---@param kept table<string, boolean>|nil the pictures the stored document has
---@return boolean ok
function photos.allowed(src, s, urls, kept)
    if #urls == 0 then return true end
    if not s.apps.photos then return false end
    local have = {}
    for url in pairs(kept or {}) do have[url] = true end
    for _, r in ipairs(own(s.citizenid)) do have[r.url] = true end

    local missing = false
    for _, url in ipairs(urls) do
        if not have[url] then missing = true break end
    end
    if missing and phoneSide(src, s) then
        for _, p in ipairs(phoneRows(src) or {}) do
            if type(p) == 'table' and type(p.url) == 'string' then have[p.url] = true end
        end
    end
    for _, url in ipairs(urls) do
        if not have[url] then return false end
    end
    return true
end

return photos
