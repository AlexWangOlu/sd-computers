---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'

---@type table Screen settings (config.Screens).
local S = config.Screens or {}
---@type table The OS itself (config.Desktop): each style's default wallpaper, theme and accent.
local D = config.Desktop or {}

-- The browsers behind the screens. A DUI is an off-screen browser whose picture is a texture; every
-- screen in the world is one of these drawn on a prop (client/screens/world.lua). They all load the
-- same page (web/build/screen.html) and are all the same size, so one that is no longer needed is
-- kept and pointed at the next address instead of being torn down and built again.

---@type table DUI module; the table returned at end of file.
local dui = {}

---@type string Runtime texture dictionary every screen's texture lives in.
dui.TXD = 'sd_computers_screens'
---@type integer Texture width (px).
dui.W = math.floor((S.Resolution and S.Resolution.w) or 1024)
---@type integer Texture height (px).
dui.H = math.floor((S.Resolution and S.Resolution.h) or 576)

---@type integer Most browsers kept waiting for their next use.
local MAX_SPARE = 2
---@type number Width over height of every texture.
local TEX_ASPECT = dui.W / dui.H

---The part of a lock face texture a screen of this shape shows: the middle, cut to fit.
---@param aspect number the screen's width over its height
---@return number u0, number v0, number u1, number v1
function dui.cover(aspect)
    if aspect < TEX_ASPECT then
        local f = aspect / TEX_ASPECT
        return (1 - f) / 2, 0.0, (1 + f) / 2, 1.0
    end
    local f = TEX_ASPECT / aspect
    return 0.0, (1 - f) / 2, 1.0, (1 + f) / 2
end

---@type any Handle of the runtime texture dictionary (made with the first browser).
local txd
---@type table<table, boolean> Every browser there is.
local all = {}
---@type table[] Browsers nobody is using.
local spare = {}
---@type integer Counts browsers, so each texture gets a name of its own.
local made = 0

---@param v any
---@return string
local function encode(v)
    return (tostring(v):gsub('[^%w%-_%.~]', function(c) return ('%%%02X'):format(c:byte()) end))
end

-- A wallpaper may be an image address instead of a drawn one (configs/shared/desktop.lua). The
-- page refuses everything that is not its own, so the hosts those images come from are handed to it.
---@type string
local imageHosts = (function()
    local seen, list = {}, {}
    for _, style in pairs(D.Styles or {}) do
        local ids = { style.DefaultWallpaper }
        for _, w in ipairs(style.Wallpapers or {}) do ids[#ids + 1] = w.id end
        for _, id in ipairs(ids) do
            local host = type(id) == 'string' and id:match('^(https?://[^/%s]+)')
            if host and not seen[host] then
                seen[host] = true
                list[#list + 1] = host
            end
        end
    end
    return table.concat(list, ' ')
end)()

---The page's address for one screen.
---@param mode string 'idle' (the lock face) | 'live' (a session's copy; shows the lock face until it arrives)
---@param style string Desktop.Styles key
---@param extra? table<string, any> more query fields
---@return string url
function dui.url(mode, style, extra)
    local st = (D.Styles or {})[style] or {}
    local query = {
        mode = mode,
        style = style,
        theme = st.DefaultTheme or 'dark',
        wallpaper = st.DefaultWallpaper or '',
        accent = (st.Accents and st.Accents[1]) or '',
        clock24 = D.Clock24 and 1 or 0,
        img = imageHosts,
    }
    for k, v in pairs(extra or {}) do query[k] = v end
    local parts = {}
    for k, v in pairs(query) do parts[#parts + 1] = k .. '=' .. encode(v) end
    table.sort(parts)
    -- (https://cfx-nui-<resource>/, the origin the game serves a resource's pages from: the page's
    -- scripts are modules, which the older nui:// scheme does not load)
    return ('https://cfx-nui-%s/web/build/screen.html?%s'):format(GetCurrentResourceName(), table.concat(parts, '&'))
end

---A browser showing `url`: a spare one when there is one, else a new one.
---@param url string
---@return table browser { obj, txn }
function dui.acquire(url)
    local b = table.remove(spare)
    if b then
        SetDuiUrl(b.obj, url)
        return b
    end
    txd = txd or CreateRuntimeTxd(dui.TXD)
    made = made + 1
    local obj = CreateDui(url, dui.W, dui.H)
    b = { obj = obj, txn = 'screen_' .. made }
    CreateRuntimeTextureFromDuiHandle(txd, b.txn, GetDuiHandle(obj))
    all[b] = true
    return b
end

---Hand a browser back.
---@param b table browser
function dui.release(b)
    if not all[b] then return end
    if #spare >= MAX_SPARE then
        all[b] = nil
        DestroyDui(b.obj)
        return
    end
    SetDuiUrl(b.obj, 'about:blank') -- (an empty page costs nothing while it waits)
    spare[#spare + 1] = b
end

---Post a message to a browser's page (it arrives as a window 'message' event, like SendNUIMessage).
---@param b table browser
---@param message table
function dui.send(b, message)
    SendDuiMessage(b.obj, json.encode(message))
end

---Destroy every browser (resource stop).
function dui.destroyAll()
    for b in pairs(all) do DestroyDui(b.obj) end
    all, spare = {}, {}
end

return dui
