---@type table RPC registration (server.computers.rpc).
local rpc = require 'server.computers.rpc'
---@type table Optional sd-phone link (server.computers.phone).
local phone = require 'server.computers.phone'

-- Photos: the character's phone gallery, to look at on the big screen. Installed by session.lua
-- only while sd-phone is linked (configs/shared/phone.lua). The endpoint is guarded like every
-- other app (signed in, in reach, app installed) and then reads sd-phone's public getPhotos
-- export, which resolves the gallery's owner from the player's server id itself - so a desk can
-- only ever show the photos of whoever is sitting at it. Read-only: taking, importing, sorting
-- into albums and deleting stay on the phone. Phone data is personal, so none of this is written
-- to the System Logs.

---@type integer Most photos one list carries (sd-phone's own page size; its export clamps to it).
local MAX_PHOTOS = 200

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

---A gallery row, trimmed to what the desk draws. The phone keeps no caption or location on a
---photo: only where it is hosted, when it was taken and whether it is a favourite. Clips live in
---the same gallery, told apart by the phone from the URL's extension.
---@param p table sd-phone photo { id, url, isVideo, favorite, timestamp }
---@return table
local function photo(p)
    return {
        id = p.id, url = p.url, ts = math.floor(tonumber(p.timestamp) or 0),
        video = p.isVideo == true, favorite = p.favorite == true,
    }
end

---The gallery, newest first (the phone's own order), up to MAX_PHOTOS.
register('photos:list', 'photos', function(src)
    local rows = phone.export('getPhotos', src, { limit = MAX_PHOTOS })
    -- The export always answers with an array (empty when the player has no photos), so anything
    -- else means the call itself failed: sd-phone stopped between the link check and here.
    if type(rows) ~= 'table' then return rpc.fail('err.phone_unavailable') end
    local out = {}
    for _, p in ipairs(rows) do
        if type(p) == 'table' and type(p.url) == 'string' and p.url ~= '' then out[#out + 1] = photo(p) end
    end
    -- A full page means the phone may hold older ones the desk isn't showing.
    return rpc.ok({ photos = out, capped = #rows >= MAX_PHOTOS })
end)

return {}
