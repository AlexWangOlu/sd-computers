---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table RPC registration (server.computers.rpc).
local rpc = require 'server.computers.rpc'
---@type table Optional sd-phone link (server.computers.phone): where the live sites' pages come from.
local phone = require 'server.computers.phone'

-- Browser. The network is the list in configs/shared/browser.lua and nothing else. It is checked
-- once, here, when the resource starts, and the UI gets the whole of it in one read: it looks an
-- address up in that list and never asks the server for a page. Nothing a player types is fetched -
-- the only real URLs that ever reach an <iframe> or an <img> are the https ones written in that
-- file, passed through below.
--
-- A `live` site is the exception to "never asks": its address and name are in the list like any
-- other, but what is on it is one of sd-phone's public apps, read as it is now
-- (server/computers/web.lua). Such a site is only on the network while the phone can serve it.

---@type table Browser module; the table returned at end of file.
local browser = {}

---@type table<string, string> A live site's kind (config `live`) -> sd-phone's name for the app behind it.
browser.LIVE = {
    news = 'weazelnews', market = 'marketplace', pages = 'pages',
    directory = 'services', squawk = 'birdy', laws = 'laws', stocks = 'stocks',
}

---@type string The built-in start page's address. No site may take it.
local HOME = 'home'

---@type table<string, boolean> What a notice box can be (the UI kit's InfoBar severities).
local NOTICE = { info = true, success = true, warning = true, error = true }

---A piece of text as the UI shows it: trimmed and never empty. A number is fine ({ 'Fee', 250 }).
---@param v any
---@return string|nil
local function text(v)
    if type(v) == 'number' then v = tostring(v) end
    if type(v) ~= 'string' then return nil end
    v = v:match('^%s*(.-)%s*$')
    return v ~= '' and v or nil
end

---An address the way the address bar compares them: lower case, no scheme, no 'www.', no trailing
---slash. The UI does the same to whatever a player types (web/src/apps/browser/model.ts) - change
---one, change both.
---@param v any
---@return string|nil address nil when nothing is left of it, or it has a space in it
local function address(v)
    if type(v) ~= 'string' then return nil end
    local a = v:lower():match('^%s*(.-)%s*$')
    a = a:gsub('^%a[%w+.%-]*://', '')
    a = a:gsub('^www%.', '')
    a = a:gsub('/+$', '')
    if a == '' or a:find('%s') then return nil end
    return a
end

---A real URL the UI may hand to an <iframe> or an <img>: https and nothing else.
---@param v any
---@return string|nil
local function https(v)
    if type(v) ~= 'string' then return nil end
    v = v:match('^%s*(.-)%s*$')
    if #v > 2048 or v:find('[%s%c]') then return nil end
    if not v:lower():match('^https://[%w%-]') then return nil end
    return v
end

---One row of a `links` block: a bare address, or { address, label, small print }.
---@param v any
---@return table|nil link { to, label?, note? }
local function link(v)
    if type(v) == 'string' then v = { v } end
    if type(v) ~= 'table' then return nil end
    local to = address(v[1])
    if not to then return nil end
    return { to = to, label = text(v[2]), note = text(v[3]) }
end

---One piece of a page as the UI draws it: { type = ..., ... }. In the config a block names itself
---with its one key ({ heading = '...' }); anything else in it is an option of that block.
---@param b any an entry of a site's `blocks`
---@return table|nil block nil = not a block the browser knows, or nothing in it to show
local function block(b)
    if type(b) ~= 'table' then return nil end

    for _, kind in ipairs({ 'heading', 'subheading', 'text' }) do
        if b[kind] ~= nil then
            local s = text(b[kind])
            return s and { type = kind, text = s } or nil
        end
    end

    if b.list ~= nil then
        local items = {}
        for _, v in ipairs(type(b.list) == 'table' and b.list or {}) do
            items[#items + 1] = text(v)
        end
        return #items > 0 and { type = 'list', items = items } or nil
    end

    if b.notice ~= nil then
        local s = text(b.notice)
        if not s then return nil end
        return { type = 'notice', kind = NOTICE[b.kind] and b.kind or 'info', title = text(b.title), text = s }
    end

    if b.facts ~= nil then
        local rows = {}
        for _, row in ipairs(type(b.facts) == 'table' and b.facts or {}) do
            local label = type(row) == 'table' and text(row[1])
            local value = type(row) == 'table' and text(row[2])
            if label and value then rows[#rows + 1] = { label = label, value = value } end
        end
        return #rows > 0 and { type = 'facts', rows = rows } or nil
    end

    if b.links ~= nil then
        local items = {}
        for _, v in ipairs(type(b.links) == 'table' and b.links or {}) do
            items[#items + 1] = link(v)
        end
        return #items > 0 and { type = 'links', items = items } or nil
    end

    if b.image ~= nil then
        local src = https(b.image)
        return src and { type = 'image', src = src, caption = text(b.caption) } or nil
    end

    return nil
end

---One entry of config.Browser.Sites as the UI gets it: only the fields it uses.
---@param def any
---@return table|nil site { address, title, bookmark } with one of url, blocks or live
---@return string|nil why what is wrong with the entry, when it is not a site
local function site(def)
    if type(def) ~= 'table' then return nil, 'it is not a table' end

    local addr = address(def.address)
    if not addr then return nil, 'it has no usable address' end
    if addr == HOME then return nil, ("'%s' is the start page's own address"):format(HOME) end

    local title = text(def.title)
    if not title then return nil, 'it has no title' end

    local out = { address = addr, title = title, bookmark = def.bookmark == true }

    -- A live site has nothing written here at all: its pages are the phone's.
    if def.live ~= nil then
        if type(def.live) ~= 'string' or not browser.LIVE[def.live] then return nil, 'its live is not a site the browser knows' end
        out.live = def.live
        return out
    end

    -- A url wins over blocks: the entry is the owner's real page, shown in a frame.
    if def.url ~= nil then
        out.url = https(def.url)
        if not out.url then return nil, 'its url is not an https:// address' end
        return out
    end

    if type(def.blocks) ~= 'table' then return nil, 'it has neither blocks, a url nor a live' end
    out.blocks = {}
    for i = 1, #def.blocks do
        local b = block(def.blocks[i])
        if b then
            out.blocks[#out.blocks + 1] = b
        else
            log.warn('browser', '%s: block #%d left out (not a block the browser knows, or nothing in it)', addr, i)
        end
    end
    return out
end

---Check the whole config once. A bad entry costs only itself: it is named in the console and the
---rest of the network still loads.
---@return { home: string, sites: table[] }
local function build()
    local B = config.Browser or {}
    local sites, taken = {}, {}

    for i, def in ipairs(type(B.Sites) == 'table' and B.Sites or {}) do
        local s, why = site(def)
        if s and taken[s.address] then s, why = nil, 'its address is already taken' end
        if s then
            taken[s.address] = true
            sites[#sites + 1] = s
        else
            log.warn('browser', 'site #%d (%s) left out: %s', i, type(def) == 'table' and tostring(def.address) or '?', why)
        end
    end

    local home = address(B.Home) or HOME
    if home ~= HOME and not taken[home] then
        log.warn('browser', "Home = '%s' is not one of the sites, so the start page is used instead", home)
        home = HOME
    end

    return { home = home, sites = sites }
end

---@type { home: string, sites: table[] } The network, checked. The config is only read when the
---resource starts, so this is built once.
local network = build()

---@type table<string, boolean> The kinds of live site the config has an address for.
local listed = {}
for _, s in ipairs(network.sites) do
    if s.live then listed[s.live] = true end
end

---Whether a kind of live site is on the network right now: the config lists it and the phone
---runs the app behind it.
---@param src integer
---@param kind string
---@return boolean
function browser.has(src, kind)
    return listed[kind] == true and phone.sites(src)[browser.LIVE[kind]] == true
end

browser.https = https

---Where a new window opens, and every site there is. Read-only and the same for everyone - the
---live sites among them for as long as the phone can serve them.
rpc.register('browser:sites', 'browser', function(src)
    if next(listed) == nil then return rpc.ok(network) end
    local have = phone.sites(src)
    local sites, home = {}, network.home
    for _, s in ipairs(network.sites) do
        if not s.live or have[browser.LIVE[s.live]] then
            sites[#sites + 1] = s
        elseif s.address == home then
            home = HOME -- (a Home that is not there today)
        end
    end
    return rpc.ok({ home = home, sites = sites })
end)

return browser
