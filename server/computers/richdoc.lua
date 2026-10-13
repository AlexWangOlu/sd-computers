---@type table UTF-8-safe clipping (shared.text).
local text = require 'shared.text'

-- A written document, as Files keeps one and a printer prints it: not HTML, but a short list of
-- blocks - paragraphs, headings, lists, pictures, lines to sign on - each a few runs of text with
-- their marks. The NUI builds it from what was typed and draws it back from it
-- (web/src/lib/richdoc.tsx); nothing that arrives is ever put on a page as markup, and this file
-- cuts whatever arrives down to exactly what a document can be. That matters more here than it
-- would for a note: a printed page is handed to other players, and it is their game that draws it.
--
-- A line to sign on is only ever empty in a document. A signature is put on a printed page, by the
-- server, for the player holding it (server/computers/printing.lua): nothing that is sent here can
-- carry one.

---@type table Rich document module; the table returned at end of file.
local richdoc = {}

---@class RichRun
---@field s string the text (a "\n" in it is a line break inside the block)
---@field b boolean|nil bold
---@field i boolean|nil italic
---@field u boolean|nil underlined
---@field x boolean|nil struck through
---@field f string|nil a typeface of its own (one of FONTS), where it is not the document's
---@field z string|nil a size of its own: 's' | 'l' | 'xl'
---@field c string|nil an ink of its own (one of INKS)

---@class RichSignature
---@field name string who signed: the character's name, as the server had it
---@field at integer unix seconds
---@field img string the signature itself: a PNG, as a data address

---@class RichBlock
---@field t string 'p' | 'h1' | 'h2' | 'h3' | 'quote' | 'ul' | 'ol' | 'img' | 'hr' | 'sign'
---@field a string|nil 'left' | 'center' | 'right' | 'justify' (a picture: not 'justify')
---@field r RichRun[]|nil the text of a paragraph, heading or quote
---@field items RichRun[][]|nil the entries of a list
---@field src string|nil a picture's address (https)
---@field w integer|nil a picture's width, as a share of the page: 25, 50, 75 or 100
---@field cap string|nil a picture's caption
---@field label string|nil what is printed under a line to sign on (whose it is)
---@field sig RichSignature|nil the signature on that line: on a printed page only

---@class RichDoc
---@field v integer the format's version (1)
---@field font string one of FONTS
---@field blocks RichBlock[]

---@type table<string, boolean> The typefaces a document can be set in (the NUI knows what each is).
local FONTS = { serif = true, sans = true, mono = true, typewriter = true, classic = true, hand = true }
---@type table<string, boolean> The sizes a run can be set in, other than the usual one.
local SIZES = { s = true, l = true, xl = true }
---@type table<string, boolean> The inks a run can be set in, other than black (the NUI knows what each is).
local INKS = { blue = true, red = true, green = true, purple = true, grey = true }
---@type table<string, boolean> Blocks that are runs of text.
local TEXT = { p = true, h1 = true, h2 = true, h3 = true, quote = true }
---@type table<string, boolean>
local ALIGN = { left = true, center = true, right = true, justify = true }
---@type table<integer, boolean>
local WIDTHS = { [25] = true, [50] = true, [75] = true, [100] = true }

---@type integer Most blocks, runs in one block, entries in one list, and pictures a document holds.
local MAX_BLOCKS, MAX_RUNS, MAX_ITEMS, MAX_IMAGES = 400, 120, 80, 12
---@type integer Most lines to sign on in one document.
local MAX_SIGNS = 8

---The runs of one block, cut down to what a run can be. Counts its characters into `count`.
---@param raw any
---@param count { n: integer, max: integer }
---@return RichRun[]
local function runsOf(raw, count)
    local out = {}
    if type(raw) ~= 'table' then return out end
    for _, r in ipairs(raw) do
        if #out >= MAX_RUNS then break end
        if type(r) == 'table' and type(r.s) == 'string' and r.s ~= '' then
            local s = r.s:gsub('\r\n', '\n'):gsub('[\0-\9\11-\31]', '')
            local left = count.max - count.n
            if left <= 0 then break end
            s = text.clip(s, left)
            if s ~= '' then
                count.n = count.n + (utf8.len(s) or #s)
                out[#out + 1] = {
                    s = s, b = r.b == true or nil, i = r.i == true or nil, u = r.u == true or nil, x = r.x == true or nil,
                    f = type(r.f) == 'string' and FONTS[r.f] and r.f or nil,
                    z = type(r.z) == 'string' and SIZES[r.z] and r.z or nil,
                    c = type(r.c) == 'string' and INKS[r.c] and r.c or nil,
                }
            end
        end
    end
    return out
end

---Whether an address is one a picture can be drawn from: https, and nothing but the characters a URL has.
---@param url any
---@return boolean
function richdoc.isUrl(url)
    return type(url) == 'string' and #url <= 400 and url:match('^https://[%w%-%._~:/%?#%[%]@!%$&\'%(%)%*%+,;=%%]+$') ~= nil
end

---A document as it is kept: whatever arrived, cut down to what a document can be.
---@param raw any a RichDoc, or anything at all
---@param maxChars integer most characters of text it may hold
---@return RichDoc|nil doc nil when it is not a document
---@return { chars: integer, images: string[] } stats its length, and the pictures in it
function richdoc.clean(raw, maxChars)
    local stats = { chars = 0, images = {} }
    if type(raw) ~= 'table' or type(raw.blocks) ~= 'table' then return nil, stats end
    local count = { n = 0, max = maxChars }
    local blocks, signs = {}, 0
    for _, b in ipairs(raw.blocks) do
        if #blocks >= MAX_BLOCKS then break end
        local t = type(b) == 'table' and b.t or nil
        if TEXT[t] then
            blocks[#blocks + 1] = { t = t, a = ALIGN[b.a] and b.a ~= 'left' and b.a or nil, r = runsOf(b.r, count) }
        elseif t == 'ul' or t == 'ol' then
            local items = {}
            for _, it in ipairs(type(b.items) == 'table' and b.items or {}) do
                if #items >= MAX_ITEMS then break end
                items[#items + 1] = runsOf(it, count)
            end
            if #items > 0 then blocks[#blocks + 1] = { t = t, items = items } end
        elseif t == 'img' then
            if richdoc.isUrl(b.src) and #stats.images < MAX_IMAGES then
                stats.images[#stats.images + 1] = b.src
                local cap = type(b.cap) == 'string' and text.trim(text.clip((b.cap:gsub('%c', ' ')), 120)) or ''
                local w = math.tointeger(tonumber(b.w))
                blocks[#blocks + 1] = {
                    t = 'img', src = b.src, w = w and WIDTHS[w] and w or 50,
                    a = (b.a == 'left' or b.a == 'right') and b.a or nil, cap = cap ~= '' and cap or nil,
                }
            end
        elseif t == 'hr' then
            blocks[#blocks + 1] = { t = 'hr' }
        elseif t == 'sign' then
            -- (the line and whose it is: a signature is never taken from what was sent)
            if signs < MAX_SIGNS then
                signs = signs + 1
                local label = type(b.label) == 'string' and text.trim(text.clip((b.label:gsub('%c', ' ')), 60)) or ''
                blocks[#blocks + 1] = { t = 'sign', label = label ~= '' and label or nil }
            end
        end
    end
    stats.chars = count.n
    return { v = 1, font = FONTS[raw.font] and raw.font or 'serif', blocks = blocks }, stats
end

---The text of some runs, marks dropped.
---@param runs RichRun[]|nil
---@return string
local function plain(runs)
    local out = {}
    for i, r in ipairs(runs or {}) do out[i] = r.s end
    return table.concat(out)
end

---A document as plain text: what goes to the phone, and what an item's tooltip quotes.
---@param doc RichDoc
---@return string
function richdoc.text(doc)
    local lines = {}
    for _, b in ipairs(doc.blocks or {}) do
        if TEXT[b.t] then
            lines[#lines + 1] = plain(b.r)
        elseif b.t == 'ul' or b.t == 'ol' then
            for n, it in ipairs(b.items or {}) do
                lines[#lines + 1] = (b.t == 'ol' and (n .. '. ') or '- ') .. plain(it)
            end
        elseif b.t == 'img' and b.cap then
            lines[#lines + 1] = '[' .. b.cap .. ']'
        elseif b.t == 'hr' then
            lines[#lines + 1] = '----------'
        elseif b.t == 'sign' then
            lines[#lines + 1] = (b.label and (b.label .. ': ') or '') .. (b.sig and b.sig.name or '____________________')
        end
    end
    return table.concat(lines, '\n')
end

---The lines to sign on in a document, in the order they read (the blocks themselves, to write on).
---@param doc RichDoc
---@return RichBlock[]
function richdoc.signs(doc)
    local out = {}
    for _, b in ipairs(type(doc) == 'table' and type(doc.blocks) == 'table' and doc.blocks or {}) do
        if type(b) == 'table' and b.t == 'sign' then out[#out + 1] = b end
    end
    return out
end

---Whether a document has anything on it at all.
---@param doc RichDoc
---@return boolean
function richdoc.blank(doc)
    for _, b in ipairs(doc.blocks or {}) do
        if b.t == 'img' or b.t == 'hr' or b.t == 'sign' then return false end
        if b.r and plain(b.r):match('%S') then return false end
        for _, it in ipairs(b.items or {}) do
            if plain(it):match('%S') then return false end
        end
    end
    return true
end

return richdoc
