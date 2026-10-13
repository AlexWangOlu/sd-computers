---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table RPC registration (server.computers.rpc).
local rpc = require 'server.computers.rpc'
---@type table Session module (server.computers.session): who is printing, and from which machine.
local session = require 'server.computers.session'
---@type table System Logs (server.computers.logs): a print is written to the computer's log.
local logs = require 'server.computers.logs'
---@type table Rate-limit helper (server.computers.ratelimit).
local ratelimit = require 'server.computers.ratelimit'
---@type table The printers (server.computers.printers): where they stand.
local printers = require 'server.computers.printers'
---@type table Inventory helpers (bridge.server.inventory): a printout is an item.
local inventory = require 'bridge.server.inventory'
---@type table Player bridge (bridge.server.player): whose pages are whose.
local player = require 'bridge.server.player'
---@type table UTF-8-safe clipping (shared.text).
local text = require 'shared.text'

---@type table Printers config (config.Printers).
local P = config.Printers or {}
---@type boolean Whether anything prints at all.
local ENABLED = P.Enabled ~= false
---@type string The inventory item a printout is.
local ITEM = type(P.Item) == 'string' and P.Item ~= '' and P.Item or 'printed_document'
---@type number Metres from a computer a printer may stand.
local RANGE = math.max(1.0, tonumber(P.Range) or 30.0)
---@type integer Most copies in one go.
local MAX_COPIES = math.max(1, math.floor(tonumber(P.MaxCopies) or 5))
---@type number Seconds a copy takes to come out.
local PAGE_SECONDS = math.max(0.0, tonumber(P.PageSeconds) or 2.5)
---@type integer Copies a tray holds.
local TRAY_LIMIT = math.max(1, math.floor(tonumber(P.TrayLimit) or 25))
---@type integer Minutes an uncollected copy waits (0 = for ever).
local TRAY_MINUTES = math.max(0, math.floor(tonumber(P.TrayMinutes) or 60))
---@type integer Days a page can still be read (0 = for ever).
local KEEP_DAYS = math.max(0, math.floor(tonumber(P.KeepDays) or 0))
---@type integer Longest text a page holds.
local MAX_CHARS = math.max(100, math.floor(tonumber(P.MaxChars) or 20000))
---@type number Metres from a printer its tray can be reached from.
local REACH = (tonumber((P.Target or {}).distance) or 1.8) + 2.0

-- Printing. A page is a small document - a title, an optional letterhead, labelled fields, a body
-- of text, a table, a picture - kept in computers_prints. An app never sends one: it names a
-- SOURCE ('text', 'mail', 'statement', 'logs' ...) and what in it to print, and that source's
-- function, which lives with the app, builds the page from the server's own data. So a page with
-- a bank's letterhead on it came from the bank's rows, whatever the NUI asked for; the one source
-- that prints what the player typed ('text') can only make a plain typed page.
--
-- A printed page waits in the tray of the printer it was sent to (server/computers/printers.lua)
-- until somebody standing at that printer takes it. What they are handed is the item
-- config.Printers.Item, whose metadata names the page: using it opens the page
-- (client/computers/paper.lua).

---@type table Printing module; the table returned at end of file.
local printing = {}

---@class PrintDoc
---@field kind string what made it: 'text', 'mail', 'statement', 'logs', or a name of another resource's own
---@field title string
---@field letterhead string|nil the line across the top: a bank, a department, a business
---@field subhead string|nil the smaller line under it
---@field fields { label: string, value: string }[]|nil
---@field body string|nil
---@field table { head: string[], rows: string[][] }|nil
---@field image string|nil an https address
---@field footer string|nil

---@class TrayEntry
---@field id integer the page's row id
---@field copies integer
---@field readyAt integer unix seconds the last copy is out
---@field at integer unix seconds it was printed
---@field by string|nil citizenid of who printed it
---@field name string|nil their name
---@field computer string|nil the machine it was printed from
---@field title string
---@field snippet string what the item's tooltip says it is

---@type table<integer, TrayEntry[]> printer id -> what waits in its tray, oldest first.
local trays = {}

---Create the table if it doesn't exist, so the resource stays drop-in. Run once at boot.
function printing.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS computers_prints (
            id         INT          NOT NULL AUTO_INCREMENT,
            title      VARCHAR(160) NOT NULL,
            kind       VARCHAR(24)  NOT NULL,
            snippet    VARCHAR(200) NOT NULL DEFAULT '',
            doc        LONGTEXT     NOT NULL,
            by_cid     VARCHAR(64)  NULL,
            by_name    VARCHAR(96)  NULL,
            computer   VARCHAR(96)  NULL,
            printer    INT          NULL,
            copies     INT          NOT NULL DEFAULT 0,
            ready_at   INT          NOT NULL DEFAULT 0,
            created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_printer (printer)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
end

-- ── What a page may hold ──────────────────────────────────────────────────────────────────

---One line of text, trimmed and cut to length (nil when nothing is left).
---@param v any
---@param max integer
---@return string|nil
local function line(v, max)
    if type(v) ~= 'string' and type(v) ~= 'number' then return nil end
    local s = text.clip(text.trim((tostring(v):gsub('%c', ' '))), max)
    return s ~= '' and s or nil
end

---Text that keeps its line breaks, cut to length (nil when it is all white space).
---@param v any
---@param max integer
---@return string|nil
local function block(v, max)
    if type(v) ~= 'string' then return nil end
    local s = v:gsub('\r\n', '\n'):gsub('\r', '\n'):gsub('[\0-\8\11\12\14-\31]', '')
    s = text.clip(s, max)
    return s:match('%S') and s or nil
end

---A page as it is kept: whatever a source (or another resource) handed over, cut down to what a
---page can be. nil when it has no title, or nothing under it.
---@param raw any
---@return PrintDoc|nil
function printing.doc(raw)
    if type(raw) ~= 'table' then return nil end
    local title = line(raw.title, 120)
    if not title then return nil end
    local doc = {
        kind = line(raw.kind, 24) or 'custom', title = title,
        letterhead = line(raw.letterhead, 80), subhead = line(raw.subhead, 120),
        body = block(raw.body, MAX_CHARS), footer = line(raw.footer, 160),
    }

    if type(raw.fields) == 'table' then
        local fields = {}
        for _, f in ipairs(raw.fields) do
            local label, value = type(f) == 'table' and line(f.label, 40), type(f) == 'table' and line(f.value, 240)
            if label and value then fields[#fields + 1] = { label = label, value = value } end
            if #fields >= 24 then break end
        end
        if #fields > 0 then doc.fields = fields end
    end

    local t = raw.table
    if type(t) == 'table' and type(t.head) == 'table' and type(t.rows) == 'table' then
        local head = {}
        for _, h in ipairs(t.head) do
            head[#head + 1] = line(h, 40) or ''
            if #head >= 8 then break end
        end
        local rows = {}
        for _, r in ipairs(t.rows) do
            if type(r) == 'table' then
                local row = {}
                for i = 1, #head do row[i] = line(r[i], 200) or '' end
                rows[#rows + 1] = row
            end
            if #rows >= 200 then break end
        end
        if #head > 0 and #rows > 0 then doc.table = { head = head, rows = rows } end
    end

    if type(raw.image) == 'string' and #raw.image <= 400 and raw.image:match('^https?://[%w%-%._~:/%?#%[%]@!%$&\'%(%)%*%+,;=%%]+$') then doc.image = raw.image end

    if not (doc.body or doc.fields or doc.table or doc.image) then return nil end
    return doc
end

---What an item's tooltip says the page is: the start of its text, else what kind of page it is.
---@param doc PrintDoc
---@return string
local function snippetOf(doc)
    if doc.kind == 'text' and doc.body then
        return text.clip(text.trim((doc.body:gsub('%s+', ' '))), 120)
    end
    local key = 'print.kind_' .. doc.kind
    local label = locale(key)
    return label ~= key and label or (doc.letterhead or locale('print.kind_text'))
end

-- ── Sources ───────────────────────────────────────────────────────────────────────────────

---@type table<string, { app: string|nil, fn: function }> source name -> who may use it, and what builds its page.
local sources = {}

---Register something that can be printed. `fn` builds the page from the server's own data and
---returns it (printing.doc cuts it to size), or nil and a message saying why not.
---@param name string what the NUI names in print:submit
---@param app string|nil the app the session must have here (nil = any signed-in session)
---@param fn fun(src: integer, s: ComputerSession, data: table): table|nil, string|nil
function printing.source(name, app, fn)
    sources[name] = { app = app, fn = fn }
end

-- What the player typed: Notepad's text, a document from Files. It is theirs to write, so it is
-- taken as sent - and it can only ever be a plain typed page.
printing.source('text', nil, function(_, s, d)
    if not (s.apps.notepad or s.apps.files) then return nil, locale('err.app_missing') end
    return { kind = 'text', title = line(d.title, 120) or locale('print.untitled'), body = type(d.body) == 'string' and d.body or '' }
end)

-- ── Trays ─────────────────────────────────────────────────────────────────────────────────

---Copies waiting in a printer's tray.
---@param printerId integer
---@return integer
function printing.waiting(printerId)
    local n = 0
    for _, e in ipairs(trays[printerId] or {}) do n = n + e.copies end
    return n
end

---Load what was waiting in the trays when the resource last stopped. Run once at boot, after the
---printers: a page whose printer is gone is not waiting anywhere.
function printing.load()
    trays = {}
    local rows = MySQL.query.await('SELECT id, title, snippet, by_cid, by_name, computer, printer, copies, ready_at, UNIX_TIMESTAMP(created_at) AS at FROM computers_prints WHERE printer IS NOT NULL AND copies > 0 ORDER BY id') or {}
    local lost = 0
    for _, r in ipairs(rows) do
        if printers.get(r.printer) then
            trays[r.printer] = trays[r.printer] or {}
            table.insert(trays[r.printer], {
                id = r.id, copies = tonumber(r.copies) or 1, readyAt = tonumber(r.ready_at) or 0, at = tonumber(r.at) or os.time(),
                by = r.by_cid, name = r.by_name, computer = r.computer, title = r.title, snippet = r.snippet or '',
            })
        else
            lost = lost + 1
        end
    end
    if lost > 0 then MySQL.query('DELETE FROM computers_prints WHERE printer IS NOT NULL AND printer NOT IN (SELECT id FROM computers_printers)') end
end

---Keep a page and, when it is sent to a printer, put it in that printer's tray.
---@param doc PrintDoc
---@param copies integer
---@param by { cid?: string, name?: string, computer?: string } who printed it, and from which machine
---@param printer Printer|nil nil = it is handed over straight away, and waits nowhere
---@return TrayEntry|nil entry
local function keep(doc, copies, by, printer)
    local now = os.time()
    local entry = {
        copies = copies, at = now, readyAt = printer and (now + math.ceil(copies * PAGE_SECONDS)) or now,
        by = by.cid, name = by.name, computer = by.computer, title = doc.title, snippet = snippetOf(doc),
    }
    entry.id = MySQL.insert.await(
        'INSERT INTO computers_prints (title, kind, snippet, doc, by_cid, by_name, computer, printer, copies, ready_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        { doc.title, doc.kind, entry.snippet, json.encode(doc), by.cid, by.name and text.clip(by.name, 96), by.computer and text.clip(by.computer, 96),
            printer and printer.id or nil, printer and copies or 0, entry.readyAt })
    if not entry.id then return nil end
    if printer then
        trays[printer.id] = trays[printer.id] or {}
        table.insert(trays[printer.id], entry)
    end
    return entry
end

---What an item made from a tray entry carries: the page's id, its title as the item's name, and
---who printed it, when and from where for the tooltip. Copies of one page are the same item, so
---they stack.
---@param e TrayEntry
---@return table metadata
local function metadataOf(e)
    return {
        label = text.clip(e.title, 60), description = e.snippet ~= '' and e.snippet or nil, print_id = e.id,
        printed_by = e.name, printed_at = os.date('%d/%m/%Y %H:%M', e.at), printed_from = e.computer,
    }
end

---Whether the inventory knows the item a printout is. Only ox_inventory can be asked; any other
---is taken on trust.
---@return boolean
function printing.itemReady()
    if inventory.system ~= 'ox_inventory' then return true end
    local ok, item = pcall(function() return exports.ox_inventory:Items(ITEM) end)
    return not ok or item ~= nil
end

-- A printer taken away takes what waited in its tray with it: nobody ever held those pages.
printers.onRemoved = function(id)
    local tray = trays[id]
    trays[id] = nil
    for _, e in ipairs(tray or {}) do MySQL.query('DELETE FROM computers_prints WHERE id = ?', { e.id }) end
end

-- ── The apps (any signed-in session) ──────────────────────────────────────────────────────

---The printers this computer can print to: the ones within reach of it, nearest first.
rpc.register('print:printers', nil, function(_, s)
    if not ENABLED then return rpc.ok({ enabled = false, printers = {}, maxCopies = MAX_COPIES, pageSeconds = PAGE_SECONDS }) end
    local out = {}
    for _, n in ipairs(printers.near(s.coords, RANGE)) do
        local waiting = printing.waiting(n.printer.id)
        out[#out + 1] = { id = n.printer.id, label = n.printer.label, distance = math.floor(n.distance + 0.5), waiting = waiting, full = waiting >= TRAY_LIMIT }
    end
    return rpc.ok({ enabled = true, printers = out, maxCopies = MAX_COPIES, pageSeconds = PAGE_SECONDS })
end)

---Print something. The NUI names a source and what in it; the page is built here.
---@param p { printer: integer, copies?: integer, source: string, data?: table }
rpc.register('print:submit', nil, function(src, s, p)
    if not ENABLED then return rpc.fail('print.err_disabled') end
    local source = type(p.source) == 'string' and sources[p.source] or nil
    if not source then return rpc.fail('err.invalid') end
    if source.app and not s.apps[source.app] then return rpc.fail('err.app_missing') end

    local printer = printers.get(math.tointeger(tonumber(p.printer)))
    if not printer or #(vec3(printer.coords.x, printer.coords.y, printer.coords.z) - s.coords) > RANGE then return rpc.fail('print.err_no_printer') end
    local copies = math.max(1, math.min(MAX_COPIES, math.tointeger(tonumber(p.copies)) or 1))
    if printing.waiting(printer.id) + copies > TRAY_LIMIT then return rpc.fail('print.err_tray_full', printer.label) end
    if not ratelimit.take(src, 'print:submit', 2) then return rpc.fail('err.slow_down') end

    local raw, why = source.fn(src, s, type(p.data) == 'table' and p.data or {})
    local doc = raw and printing.doc(raw)
    if not doc then return { ok = false, error = why or locale('print.err_empty') } end

    local entry = keep(doc, copies, { cid = s.citizenid, name = s.name, computer = s.hostname }, printer)
    if not entry then return rpc.fail('err.internal') end

    logs.write(s.instance, {
        level = 'information', source = 'Print Spooler', eventId = logs.EVENT.PRINT,
        message = locale('logs.print', doc.title, copies, printer.label),
        data = { title = doc.title, kind = doc.kind, copies = copies, printer = printer.label },
    }, session.actor(s))
    return rpc.ok({ printer = printer.label, copies = copies, seconds = math.ceil(copies * PAGE_SECONDS) })
end)

-- ── At the printer ────────────────────────────────────────────────────────────────────────

---Take what is ready from a printer's tray. Where the player stands is read here, never taken
---from the client; so is whether they can carry it.
---@param src integer
---@param printerId any
---@return { ok: boolean, message: string }
lib.callback.register('sd-computers:server:printer:collect', function(src, printerId)
    local function say(ok, key, ...) return { ok = ok, message = locale(key, ...) } end
    if not ENABLED then return say(false, 'print.err_disabled') end
    local printer = printers.get(math.tointeger(tonumber(printerId)))
    local ped = GetPlayerPed(src)
    if not printer or not ped or ped == 0 then return say(false, 'print.err_gone') end
    if #(GetEntityCoords(ped) - vec3(printer.coords.x, printer.coords.y, printer.coords.z)) > REACH then return say(false, 'print.err_too_far') end
    if not ratelimit.take(src, 'print:collect', 1) then return say(false, 'err.slow_down') end
    -- (said plainly: with no such item every page would read as "too much to carry")
    if not printing.itemReady() then return say(false, 'print.err_no_item') end

    local tray = trays[printer.id] or {}
    local cid = P.OwnOnly == true and player.getIdentifier(src) or nil
    local now = os.time()
    local taken, coming, others, full = 0, 0, 0, false
    local i = 1
    while i <= #tray do
        local e = tray[i]
        if cid and e.by ~= cid then
            others = others + e.copies
            i = i + 1
        elseif e.readyAt > now then
            coming = coming + e.copies
            i = i + 1
        else
            local meta = metadataOf(e)
            if not inventory.canCarry(src, ITEM, e.copies, meta) or not inventory.add(src, ITEM, e.copies, meta) then
                full = true
                break
            end
            taken = taken + e.copies
            table.remove(tray, i)
            MySQL.update('UPDATE computers_prints SET printer = NULL, copies = 0 WHERE id = ?', { e.id })
        end
    end

    if taken > 0 then return say(true, taken == 1 and 'print.took_one' or 'print.took', taken) end
    if full then return say(false, 'print.inventory_full') end
    if coming > 0 then return say(false, 'print.still_printing') end
    if others > 0 then return say(false, 'print.not_yours') end
    return say(false, 'print.tray_empty')
end)

-- ── The item ──────────────────────────────────────────────────────────────────────────────

---@type table<integer, table> page id -> the page as the viewer gets it (the last few read).
local cache = {}
---@type integer[] The ids in `cache`, oldest first.
local cached = {}

---A page by its id (nil when there is none, or its time ran out and it was thrown away).
---@param id integer
---@return table|nil page { id, doc, by, from, at }
local function read(id)
    if cache[id] then return cache[id] end
    local r = MySQL.single.await('SELECT doc, by_name, computer, UNIX_TIMESTAMP(created_at) AS at FROM computers_prints WHERE id = ?', { id })
    local doc = r and json.decode(r.doc or '') or nil
    if type(doc) ~= 'table' then return nil end
    local page = { id = id, doc = doc, by = r.by_name, from = r.computer, at = tonumber(r.at) or 0 }
    cache[id] = page
    cached[#cached + 1] = id
    if #cached > 64 then cache[table.remove(cached, 1)] = nil end
    return page
end

---The metadata of the printout a player just used. Inventories hand a used item over in
---different ways (a slot number, the item with its metadata, only its name), so each is tried.
---@param src integer
---@param item any
---@param slot any
---@return table|nil metadata
local function usedMetadata(src, item, slot)
    if type(slot) ~= 'number' and type(item) == 'table' then slot = item.slot end
    local held = slot ~= nil and inventory.getSlot(src, slot) or nil
    if held and held.name == ITEM and type(held.metadata) == 'table' and held.metadata.print_id then return held.metadata end
    if type(item) == 'table' then
        local meta = item.metadata or item.info
        if type(meta) == 'table' and meta.print_id then return meta end
    end
    -- (an inventory that says only which item it was: the first printout carried is the one opened)
    local first = inventory.getSlots(src, ITEM)[1]
    return first and first.metadata or nil
end

if ENABLED then
    local ok, err = pcall(inventory.registerUsable, ITEM, function(src, item, _, slot)
        local meta = usedMetadata(src, item, slot)
        local id = type(meta) == 'table' and math.tointeger(tonumber(meta.print_id)) or nil
        local page = id and read(id) or nil
        -- (a page thrown away after KeepDays, or an item that never was one of ours: it opens faded)
        TriggerClientEvent('sd-computers:client:paper', src, page or { faded = true, title = type(meta) == 'table' and meta.label or nil })
    end)
    if not ok then log.warn('print', 'the %s item could not be made usable: %s', ITEM, tostring(err)) end
end

-- ── Housekeeping ──────────────────────────────────────────────────────────────────────────

---Throw away what has waited in a tray too long, and the pages past their keeping time.
local function sweep()
    if TRAY_MINUTES > 0 then
        local before = os.time() - TRAY_MINUTES * 60
        for _, tray in pairs(trays) do
            for i = #tray, 1, -1 do
                if tray[i].at < before then
                    MySQL.query('DELETE FROM computers_prints WHERE id = ?', { tray[i].id })
                    table.remove(tray, i)
                end
            end
        end
    end
    if KEEP_DAYS > 0 then
        MySQL.query('DELETE FROM computers_prints WHERE printer IS NULL AND created_at < (NOW() - INTERVAL ? DAY)', { KEEP_DAYS })
        cache, cached = {}, {}
    end
end

CreateThread(function()
    -- (once the inventory has had time to start: a printout nobody can be handed is worth a line)
    Wait(10 * 1000)
    if ENABLED and not printing.itemReady() then
        log.warn('print', 'your inventory has no "%s" item: add it (README > Printers) or nobody can take a page from a printer', ITEM)
    end
    while true do
        Wait(60 * 1000)
        sweep()
    end
end)

-- ── For other resources ───────────────────────────────────────────────────────────────────

---Export: every printer, for a resource that wants to print to one.
---@return { id: integer, label: string, coords: vector3 }[]
exports('GetPrinters', function()
    local out = {}
    for _, n in ipairs(printers.near(vec3(0.0, 0.0, 0.0), math.huge)) do
        local c = n.printer.coords
        out[#out + 1] = { id = n.printer.id, label = n.printer.label, coords = vec3(c.x, c.y, c.z) }
    end
    table.sort(out, function(a, b) return a.id < b.id end)
    return out
end)

---Export: print a page of your own at a printer. It waits in the tray like any other.
---@param printerId integer a printer's id (GetPrinters)
---@param doc table { title, kind?, letterhead?, subhead?, fields?, body?, table?, image?, footer? }
---@param opts? { copies?: integer, by?: string, from?: string, citizenid?: string } who it says printed it, and from where
---@return boolean ok
---@return string|nil why 'disabled' | 'no_printer' | 'bad_page' | 'tray_full' | 'failed'
exports('PrintAt', function(printerId, doc, opts)
    opts = type(opts) == 'table' and opts or {}
    if not ENABLED then return false, 'disabled' end
    local printer = printers.get(math.tointeger(tonumber(printerId)))
    if not printer then return false, 'no_printer' end
    local page = printing.doc(doc)
    if not page then return false, 'bad_page' end
    local copies = math.max(1, math.min(MAX_COPIES, math.tointeger(tonumber(opts.copies)) or 1))
    if printing.waiting(printer.id) + copies > TRAY_LIMIT then return false, 'tray_full' end
    local entry = keep(page, copies, { cid = line(opts.citizenid, 64), name = line(opts.by, 96), computer = line(opts.from, 96) }, printer)
    return entry ~= nil, not entry and 'failed' or nil
end)

---Export: hand a player a printed page of your own, with no printer in between.
---@param src integer player server id
---@param doc table { title, kind?, letterhead?, subhead?, fields?, body?, table?, image?, footer? }
---@param opts? { copies?: integer, by?: string, from?: string }
---@return boolean ok
---@return string|nil why 'disabled' | 'bad_page' | 'inventory_full' | 'failed'
exports('GivePrintout', function(src, doc, opts)
    opts = type(opts) == 'table' and opts or {}
    if not ENABLED then return false, 'disabled' end
    local page = printing.doc(doc)
    if not page then return false, 'bad_page' end
    local copies = math.max(1, math.min(MAX_COPIES, math.tointeger(tonumber(opts.copies)) or 1))
    if not inventory.canCarry(src, ITEM, copies) then return false, 'inventory_full' end
    local entry = keep(page, copies, { cid = player.getIdentifier(src), name = line(opts.by, 96) or player.getName(src), computer = line(opts.from, 96) }, nil)
    if not entry then return false, 'failed' end
    if not inventory.add(src, ITEM, copies, metadataOf(entry)) then return false, 'inventory_full' end
    return true
end)

return printing
