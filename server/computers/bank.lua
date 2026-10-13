---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table RPC registration (server.computers.rpc).
local rpc = require 'server.computers.rpc'
---@type table Optional sd-phone link (server.computers.phone): the phone's banking history.
local phone = require 'server.computers.phone'
---@type table Money helpers (bridge.server.money).
local money = require 'bridge.server.money'
---@type table UTF-8-safe clipping (shared.text).
local text = require 'shared.text'

-- Bank. The character's own money, to look at: what is in the bank, the cash on them and their
-- recent statement. One endpoint, and it only reads - nothing here moves money. Whose account it
-- is comes from the session (src / s.citizenid) and never from the payload, so nobody can ask for
-- someone else's. Personal money is personal: none of this is written to the System Logs.
--
-- The statement comes from the best source that answers:
--   1. sd-phone's banking history, while the phone is linked. On QBCore/Qbox it logs every bank
--      movement, whatever caused it, so it is the fullest record there is.
--   2. the banking resource's own personal statement (sd-banking / Renewed-Banking keep one per
--      citizenid): what went through the bank itself.
--   3. nothing, and the page shows the balances alone.

---@type table Bank config (config.Bank).
local B = config.Bank or {}

---@type integer Most rows a statement carries (sd-phone's export stops at 100 as well).
local LIMIT = math.max(1, math.min(100, math.floor(tonumber(B.TransactionLimit) or 50)))

---@type integer Longest title / name / message sent to the page, in characters.
local MAX_TEXT = 160

---@type string[] Banking resources that keep a personal statement, probed in this order.
local SUPPORTED = { 'sd-banking', 'Renewed-Banking' }

---@type table<string, 'deposit'|'withdraw'> A banking resource's transaction type -> which way the
---money went (sd-banking's standing orders once wrote inbound / outbound).
local KINDS = { deposit = 'deposit', withdraw = 'withdraw', inbound = 'deposit', outbound = 'withdraw' }

---@class BankTx One statement line, the same shape whatever the source.
---@field id string unique within one statement
---@field title string
---@field amount number always positive: `kind` carries the direction
---@field kind 'deposit'|'withdraw' into the bank account / out of it
---@field issuer string who it came from ('' when the source does not say)
---@field receiver string who it went to ('' when the source does not say)
---@field message string
---@field time integer unix seconds

---Unix seconds, from a source that may have stored milliseconds.
---@param v any
---@return integer
local function seconds(v)
    local n = math.floor(tonumber(v) or 0)
    if n > 100000000000 then n = n // 1000 end
    return math.max(0, n)
end

---sd-phone's banking history for the character. Its rows are { id, label, amount, category,
---counterparty?, created_at }: the amount is signed (minus = money out) and the counterparty,
---when there is one, is the other side's phone number or name.
---@param s ComputerSession
---@return BankTx[]|nil rows nil when the phone is not the source right now, or did not answer
local function fromPhone(s)
    if not (phone.linked() and (config.Phone or {}).Bank ~= false) then return nil end
    local rows = phone.export('getBankTransactions', s.citizenid, LIMIT)
    if type(rows) ~= 'table' then return nil end

    local out = {}
    for _, r in ipairs(rows) do
        local signed = tonumber(r.amount) or 0
        local leaving = signed < 0
        local other = text.clip(r.counterparty, MAX_TEXT)
        out[#out + 1] = {
            id = tostring(r.id or ''),
            title = text.clip(r.label, MAX_TEXT),
            amount = math.abs(signed),
            kind = leaving and 'withdraw' or 'deposit',
            issuer = leaving and s.name or other,
            receiver = leaving and other or s.name,
            message = '',
            time = seconds(r.created_at),
        }
    end
    return out
end

---The started banking resource that keeps personal statements (nil = none). Re-resolved on every
---call, so one started after us is picked up without a restart. A resource named for the Business
---Manager (configs/server/boss.lua > Banking: a renamed fork, say) is the one asked here as well.
---@return string|nil
local function backend()
    local want = config.Boss and config.Boss.Banking
    if type(want) == 'string' and want ~= 'auto' then
        return GetResourceState(want) == 'started' and want or nil
    end
    for _, name in ipairs(SUPPORTED) do
        if GetResourceState(name) == 'started' then return name end
    end
    return nil
end

---The banking resource's personal statement. sd-banking and Renewed-Banking key a personal
---account by citizenid and answer getAccountTransactions with rows of { trans_id, title, amount,
---trans_type, issuer, receiver, message, time } (the amount positive, the direction in
---trans_type), or with false for an account they have not loaded.
---@param s ComputerSession
---@return BankTx[]|nil rows nil when no banking resource is running, or it has no such account
local function fromBanking(s)
    local b = backend()
    if not b then return nil end
    local list = exports[b]:getAccountTransactions(s.citizenid)
    if type(list) ~= 'table' then return nil end

    local out = {}
    for _, t in ipairs(list) do
        -- (a row whose direction cannot be told is left out, not guessed at)
        local kind = KINDS[tostring(t.trans_type):lower()]
        if kind then
            out[#out + 1] = {
                id = tostring(t.trans_id or ''),
                title = text.clip(t.title, MAX_TEXT),
                amount = math.abs(tonumber(t.amount) or 0),
                kind = kind,
                issuer = text.clip(t.issuer, MAX_TEXT),
                receiver = text.clip(t.receiver, MAX_TEXT),
                message = text.clip(t.message, MAX_TEXT),
                time = seconds(t.time),
            }
        end
    end
    return out
end

---@type { name: 'phone'|'banking', read: fun(s: ComputerSession): BankTx[]|nil }[] Statement
---sources, best first.
local SOURCES = {
    { name = 'phone', read = fromPhone },
    { name = 'banking', read = fromBanking },
}

---Newest first, cut to LIMIT, every id unique. Lines of the same second keep the order their
---source gave them, and an id that repeats gets its place appended: a banking resource writes
---one id on both rows of a transfer, and the page keys its rows by id.
---@param rows BankTx[]
---@return BankTx[]
local function tidy(rows)
    local order = {}
    for i, r in ipairs(rows) do order[r] = i end
    table.sort(rows, function(a, b)
        if a.time ~= b.time then return a.time > b.time end
        return order[a] < order[b]
    end)

    local out, seen = {}, {}
    for i = 1, math.min(#rows, LIMIT) do
        local r = rows[i]
        if r.id == '' or seen[r.id] then r.id = ('%s#%d'):format(r.id, i) end
        seen[r.id] = true
        out[i] = r
    end
    return out
end

---The character's statement, from the best source that answers. Each source runs in a pcall: a
---missing or changed export is a source that did not answer, never an error on the player's screen.
---@param s ComputerSession
---@return BankTx[] rows newest first, at most LIMIT
---@return 'phone'|'banking'|'none' source where they came from ('none' = no statement here)
local function statement(s)
    for _, source in ipairs(SOURCES) do
        local ok, rows = pcall(source.read, s)
        if not ok then
            log.warn('bank', 'the %s statement could not be read: %s', source.name, tostring(rows))
        elseif rows then
            return tidy(rows), source.name
        end
    end
    return {}, 'none'
end

---The whole page in one call: the holder's name, both balances, and the statement with where it
---came from.
rpc.register('bank:overview', 'bank', function(src, s)
    if B.Enabled == false then return rpc.fail('bank.err_disabled') end

    local rows, source = statement(s)
    return rpc.ok({
        name = s.name,
        bank = tonumber(money.get(src, 'bank')) or 0,
        cash = tonumber(money.get(src, 'cash')) or 0,
        source = source,
        transactions = rows,
    })
end)

return {}
