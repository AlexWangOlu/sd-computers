---@type table RPC registration (server.computers.rpc).
local rpc = require 'server.computers.rpc'
---@type table Optional sd-phone link (server.computers.phone).
local phone = require 'server.computers.phone'
---@type table The Browser's network (server.computers.browser): which live sites it has.
local browser = require 'server.computers.browser'
---@type table UTF-8-safe clipping (shared.text).
local text = require 'shared.text'

-- The Browser's live sites: sd-phone's public apps, shown as pages. Weazel News, the Marketplace
-- and the Yellow Pages (Pages), the company directory, Squawk (Birdy), the penal code and the
-- stock market. An address and a name for each are in configs/shared/browser.lua; what is on them
-- is read here, from the phone, every time a page is opened - so a desk shows what a phone shows.
--
-- Reading is for anyone at a computer with the Browser: these are the city's public pages, not a
-- character's phone, and need no phone on them and no Phone Link. Writing - an ad of your own, a
-- story from the newsroom, a message to a company - is done as the player at the desk, through the
-- phone's own action for it: its limits, its owner checks and its staff rules are the ones that
-- hold. The one thing a desk cannot give a post is a picture of its own: the phone only takes
-- photos out of the poster's gallery, so a picture is picked from there (the Photos app's list),
-- which a computer has only while that player's phone is linked to it.
--
-- Every picture address that comes back goes through the same https test the rest of the Browser
-- uses before the page sees it.

---@type integer Longest message a desk sends a company (the phone itself cuts at 300).
local MAX_MESSAGE = 300
---@type integer Most pictures on an ad (the phone keeps three at most).
local MAX_IMAGES = 3

local https = browser.https

---Register a live site's endpoint: refused cleanly when that site is not on the network (taken
---out of the config, sd-phone stopped, or its app switched off there).
---@param name string endpoint
---@param kind string the live site it belongs to (browser.LIVE key)
---@param fn fun(src: integer, s: ComputerSession, p: table): table
local function register(name, kind, fn)
    rpc.register(name, 'browser', function(src, s, p)
        if not browser.has(src, kind) then return rpc.fail('err.phone_unavailable') end
        return fn(src, s, type(p) == 'table' and p or {})
    end)
end

---@param v any
---@return string|nil
local function str(v)
    return type(v) == 'string' and v ~= '' and v or nil
end

---A list of picture addresses, the ones that pass.
---@param list any
---@return string[]|nil
local function pictures(list)
    if type(list) ~= 'table' then return nil end
    local out = {}
    for _, v in ipairs(list) do
        local u = https(v)
        if u then out[#out + 1] = u end
    end
    return #out > 0 and out or nil
end

-- ── Marketplace and Yellow Pages (one app twice: the second has no prices) ─────────────────

---@type table<string, string> Which board an endpoint is asked for -> its live site.
local BOARDS = { market = 'market', pages = 'pages' }

---An ad, trimmed to what the page draws.
---@param a table sd-phone Post / Listing
---@return table
local function ad(a)
    local imgs = pictures(a.images) or pictures({ a.image })
    return {
        id = tostring(a.id), title = a.title or '', body = a.body or '', price = tonumber(a.price),
        images = imgs, number = str(a.number), email = str(a.email), date = a.date or '',
        mine = a.mine == true, publishAt = tonumber(a.publishAt),
    }
end

---One board's endpoint: the board comes in the payload, and is one this network has.
---@param name string endpoint
---@param fn fun(src: integer, app: string, p: table): table
local function board(name, fn)
    rpc.register(name, 'browser', function(src, _, p)
        p = type(p) == 'table' and p or {}
        local kind = BOARDS[p.board]
        if not kind or not browser.has(src, kind) then return rpc.fail('err.phone_unavailable') end
        return fn(src, browser.LIVE[kind], p)
    end)
end

---Every live ad, newest first, with the player's own queued ones (made on the phone) after them.
---Comes with the form's limits and the number a new ad's contact field starts as.
---@param p { board: string }
board('web:ads', function(src, app)
    local res = phone.call(src, app, 'list')
    if not res.success then return phone.reply(res) end
    local d = type(res.data) == 'table' and res.data or {}
    local out = {}
    for _, a in ipairs(d.posts or d.listings or {}) do out[#out + 1] = ad(a) end
    local mine = phone.call(src, 'phone', 'number')
    return rpc.ok({ items = out, limits = d.limits, number = mine.success and type(mine.data) == 'table' and str(mine.data.number) or nil })
end)

---Put an ad up, or change one of the player's own. Pictures are addresses out of their phone's
---gallery (anything else the phone drops without a word).
---@param p { board: string, id?: string, title: string, body: string, price?: number, images?: string[], number?: string, email?: string }
board('web:ads:save', function(src, app, p)
    local images = {}
    for _, v in ipairs(type(p.images) == 'table' and p.images or {}) do
        local u = https(v)
        if u and #images < MAX_IMAGES then images[#images + 1] = u end
    end
    local payload = {
        id = p.id, title = str(p.title) or '', body = str(p.body) or '', images = images,
        price = app == 'marketplace' and type(p.price) == 'number' and p.price or nil,
        number = str(p.number) or '', email = str(p.email),
    }
    local res = phone.call(src, app, p.id ~= nil and 'update' or 'create', payload)
    return phone.reply(res, function(d)
        local item = type(d) == 'table' and (d.post or d.listing)
        return { item = item and ad(item) or nil }
    end)
end)

---Take one of the player's own ads down.
---@param p { board: string, id: string }
board('web:ads:delete', function(src, app, p)
    return phone.rpc(src, app, 'delete', { id = p.id })
end)

-- ── Weazel News ───────────────────────────────────────────────────────────────────────────

---A story, trimmed to what the page draws.
---@param a table sd-phone Article
---@return table
local function article(a)
    local body = {}
    for _, para in ipairs(type(a.body) == 'table' and a.body or {}) do
        if type(para) == 'string' and para ~= '' then body[#body + 1] = para end
    end
    return {
        id = tostring(a.id), category = a.category or '', headline = a.headline or '', dek = a.dek or '', body = body,
        author = a.author or '', time = a.time or '', views = tonumber(a.views) or 0, image = https(a.image),
        featured = a.featured == true, publishAt = tonumber(a.publishAt),
    }
end

---@param list any
---@return table[]
local function articles(list)
    local out = {}
    for _, a in ipairs(type(list) == 'table' and list or {}) do out[#out + 1] = article(a) end
    return out
end

---The paper: its stories and the breaking line. For its staff also the newsroom's side: the
---stories waiting to go out, and the sections and lengths a story is written to.
register('web:news', 'news', function(src)
    return phone.rpc(src, 'weazelnews', 'feed', nil, function(d)
        d = type(d) == 'table' and d or {}
        local ticker = {}
        for _, line in ipairs(type(d.ticker) == 'table' and d.ticker or {}) do
            if type(line) == 'string' and line ~= '' then ticker[#ticker + 1] = line end
        end
        local staff = d.canManage == true
        return {
            articles = articles(d.articles), ticker = ticker, canManage = staff,
            scheduled = staff and articles(d.scheduled) or {},
            categories = staff and d.categories or nil, limits = staff and d.limits or nil,
        }
    end)
end)

---A story was opened (the phone counts one reader once).
---@param p { id: string }
register('web:news:view', 'news', function(src, _, p)
    return phone.rpc(src, 'weazelnews', 'view', { id = p.id })
end)

---Newsroom: file a story, or change one. The picture, when there is one, is out of the writer's
---own phone gallery. `publishAt` (unix seconds) holds it back until then.
---@param p { id?: string, category: string, headline: string, dek?: string, body: string, image?: string, featured?: boolean, publishAt?: integer }
register('web:news:save', 'news', function(src, _, p)
    local payload = {
        id = p.id, category = p.category, headline = p.headline, dek = p.dek,
        body = type(p.body) == 'string' and p.body or '', image = https(p.image) or '', featured = p.featured == true,
        publishAt = type(p.publishAt) == 'number' and math.floor(p.publishAt) or nil,
    }
    return phone.rpc(src, 'weazelnews', 'save', payload, function(d)
        return { article = type(d) == 'table' and d.article and article(d.article) or nil }
    end)
end)

---Newsroom: send a waiting story out now.
---@param p { id: string }
register('web:news:publish', 'news', function(src, _, p)
    return phone.rpc(src, 'weazelnews', 'publishNow', { id = p.id }, function(d)
        return { article = type(d) == 'table' and d.article and article(d.article) or nil }
    end)
end)

---Newsroom: take a story down.
---@param p { id: string }
register('web:news:delete', 'news', function(src, _, p)
    return phone.rpc(src, 'weazelnews', 'delete', { id = p.id })
end)

---Newsroom: replace the breaking line (its headlines, in order; none = no line).
---@param p { lines: string[] }
register('web:news:ticker', 'news', function(src, _, p)
    local lines = {}
    for _, line in ipairs(type(p.lines) == 'table' and p.lines or {}) do
        if type(line) == 'string' then lines[#lines + 1] = line end
    end
    return phone.rpc(src, 'weazelnews', 'setBreaking', { lines = lines })
end)

-- ── Company directory ─────────────────────────────────────────────────────────────────────

---Every company the phone lists, and whether anybody is in.
register('web:directory', 'directory', function(src)
    return phone.rpc(src, 'services', 'directory', nil, function(d)
        local out = {}
        for _, c in ipairs(type(d) == 'table' and type(d.companies) == 'table' and d.companies or {}) do
            out[#out + 1] = {
                id = tostring(c.id), name = c.name or tostring(c.id), location = str(c.location), color = str(c.color), emoji = str(c.emoji),
                callNumber = c.canCall and str(c.callNumber) or nil, onDuty = c.onDuty == true,
            }
        end
        return { companies = out }
    end)
end)

---Write to a company. Whoever is on duty there hears of it; what they answer comes to the
---sender's phone.
---@param p { job: string, body: string }
register('web:directory:message', 'directory', function(src, _, p)
    local body = str(p.body) and text.clip(p.body, MAX_MESSAGE) or ''
    if body:match('^%s*$') then return rpc.fail('err.invalid') end
    return phone.rpc(src, 'services', 'message', { job = p.job, body = body })
end)

-- ── Squawk (Birdy) ────────────────────────────────────────────────────────────────────────

---A post, trimmed to what the page draws. Whose likes these are is nobody's: the feed is read
---as a visitor.
---@param p table sd-phone BirdyPost
---@return table
local function squawk(p)
    local a = type(p.author) == 'table' and p.author or {}
    local by = type(p.repostedBy) == 'table' and p.repostedBy or nil
    local poll
    if type(p.poll) == 'table' and type(p.poll.options) == 'table' then
        poll = { total = tonumber(p.poll.total) or 0, ended = p.poll.ended == true, options = {} }
        for _, o in ipairs(p.poll.options) do
            poll.options[#poll.options + 1] = { label = tostring(o.label or ''), votes = tonumber(o.votes) or 0 }
        end
    end
    return {
        id = tostring(p.id),
        author = { name = a.name or a.handle or '', handle = a.handle or '', verified = a.verified == true, badge = str(a.verifiedType), avatar = https(a.avatar) },
        body = p.body or '', images = pictures(p.images), at = tonumber(p.createdAt) or 0,
        replies = tonumber(p.replies) or 0, reposts = tonumber(p.reposts) or 0, likes = tonumber(p.likes) or 0, views = tonumber(p.views) or 0,
        poll = poll, repostedBy = by and { name = by.name or by.handle or '', handle = by.handle or '' } or nil,
    }
end

---@param d any reply data with a `posts` list
---@return table[]
local function squawks(d)
    local out = {}
    for _, p in ipairs(type(d) == 'table' and type(d.posts) == 'table' and d.posts or {}) do out[#out + 1] = squawk(p) end
    return out
end

---The public feed with what is trending, the posts under one hashtag, or one account's page.
---@param p { view?: 'feed'|'tag'|'profile', tag?: string, handle?: string }
register('web:squawk', 'squawk', function(src, _, p)
    if p.view == 'tag' then
        return phone.rpc(src, 'birdy', 'hashtag', { tag = str(p.tag) or '' }, function(d) return { posts = squawks(d) } end)
    end
    if p.view == 'profile' then
        local res = phone.call(src, 'birdy', 'profile', { handle = str(p.handle) or '' })
        if not res.success then return phone.reply(res) end
        local pr = type(res.data) == 'table' and type(res.data.profile) == 'table' and res.data.profile or {}
        local posts = phone.call(src, 'birdy', 'profilePosts', { handle = pr.handle })
        return rpc.ok({
            profile = {
                name = pr.name or pr.handle or '', handle = pr.handle or '', verified = pr.verified == true, badge = str(pr.verifiedType),
                bio = pr.bio or '', joined = pr.joined or '', protected = pr.protected == true,
                avatar = https(pr.avatar), banner = https(pr.banner),
                following = tonumber(pr.following) or 0, followers = tonumber(pr.followers) or 0,
            },
            posts = posts.success and squawks(posts.data) or {},
        })
    end
    local res = phone.call(src, 'birdy', 'feed')
    if not res.success then return phone.reply(res) end
    local trending = phone.call(src, 'birdy', 'trending')
    local tags = {}
    for _, tag in ipairs(trending.success and type(trending.data) == 'table' and type(trending.data.tags) == 'table' and trending.data.tags or {}) do
        if type(tag) == 'table' and type(tag.tag) == 'string' then tags[#tags + 1] = { tag = tag.tag, count = tonumber(tag.count) or 0 } end
    end
    return rpc.ok({ posts = squawks(res.data), tags = tags })
end)

-- ── Laws and fines ────────────────────────────────────────────────────────────────────────

---The penal code as it stands: every charge, what it costs and what it carries.
register('web:laws', 'laws', function(src)
    return phone.rpc(src, 'laws', 'list', nil, function(d)
        local out = {}
        for _, o in ipairs(type(d) == 'table' and type(d.offences) == 'table' and d.offences or {}) do
            out[#out + 1] = {
                code = tostring(o.code or ''), label = o.label or '', class = o.class or '',
                months = tonumber(o.months) or 0, fine = tonumber(o.fine) or 0, description = o.description or '',
            }
        end
        return { offences = out }
    end)
end)

-- ── Stock market ──────────────────────────────────────────────────────────────────────────

---Every asset on the market: its price now and where it has been.
register('web:stocks', 'stocks', function(src)
    return phone.rpc(src, 'stocks', 'market', nil, function(d)
        local out = {}
        for _, a in ipairs(type(d) == 'table' and type(d.assets) == 'table' and d.assets or {}) do
            local history = {}
            for _, v in ipairs(type(a.history) == 'table' and a.history or {}) do
                if type(v) == 'number' then history[#history + 1] = v end
            end
            out[#out + 1] = {
                symbol = tostring(a.symbol or ''), name = a.name or '', kind = a.kind == 'crypto' and 'crypto' or 'stock', color = str(a.color),
                price = tonumber(a.price) or 0, change = tonumber(a.changePct) or 0, history = history,
            }
        end
        return { assets = out }
    end)
end)

return {}
