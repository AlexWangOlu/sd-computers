---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'

-- Society funds adapter. sd-banking is a Renewed-Banking fork and both share the public API
-- (getAccountMoney / addAccountMoney / removeAccountMoney / handleTransaction /
-- getAccountTransactions) with society accounts keyed by JOB NAME - so one code path serves both.

---@type table Society module; the table returned at end of file.
local society = {}

---@type string[] Banking resources probed in order when config.Boss.Banking = 'auto'.
local SUPPORTED = { 'sd-banking', 'Renewed-Banking' }

---The banking resource to use right now (nil = funds unavailable). Re-resolved per call, so a
---banking resource started after us is picked up without a restart.
---@return string|nil
local function backend()
    local want = config.Boss and config.Boss.Banking
    if want == false or not (config.Boss and config.Boss.Funds) then return nil end
    if type(want) == 'string' and want ~= 'auto' then
        return GetResourceState(want) == 'started' and want or nil
    end
    for _, name in ipairs(SUPPORTED) do
        if GetResourceState(name) == 'started' then return name end
    end
    return nil
end

---Whether society funds can be shown at all.
---@return boolean
function society.available()
    return backend() ~= nil
end

---A job's society balance (nil when unavailable or the job has no account).
---@param jobName string
---@return number|nil
function society.balance(jobName)
    local b = backend()
    if not b then return nil end
    local ok, amount = pcall(function() return exports[b]:getAccountMoney(jobName) end)
    if not ok or type(amount) ~= 'number' then return nil end
    return amount
end

---Record a transaction on the society's statement (best effort - a failure here never undoes the
---money move that already happened).
---@param b string backend resource
---@param jobName string
---@param title string
---@param amount number
---@param message string
---@param issuer string who did it
---@param receiver string the other side
---@param kind 'deposit'|'withdraw'
local function record(b, jobName, title, amount, message, issuer, receiver, kind)
    local ok, err = pcall(function()
        exports[b]:handleTransaction(jobName, title, amount, message, issuer, receiver, kind)
    end)
    if not ok then log.warn('boss', 'handleTransaction failed for %s: %s', jobName, tostring(err)) end
end

---Credit the society.
---@param jobName string
---@param amount integer
---@param who string boss name (statement issuer)
---@param jobLabel string society display name
---@return boolean ok
function society.deposit(jobName, amount, who, jobLabel)
    local b = backend()
    if not b then return false end
    local ok, res = pcall(function() return exports[b]:addAccountMoney(jobName, amount) end)
    if not ok or res == false then return false end
    record(b, jobName, locale('boss.tx_deposit'), amount, locale('boss.tx_deposit_msg', who), who, jobLabel, 'deposit')
    return true
end

---Debit the society (refused, with nothing moved, when the balance can't cover it).
---@param jobName string
---@param amount integer
---@param who string boss name (statement receiver)
---@param jobLabel string society display name
---@return boolean ok
function society.withdraw(jobName, amount, who, jobLabel)
    local b = backend()
    if not b then return false end
    local ok, res = pcall(function() return exports[b]:removeAccountMoney(jobName, amount) end)
    if not ok or res ~= true then return false end
    record(b, jobName, locale('boss.tx_withdraw'), amount, locale('boss.tx_withdraw_msg', who), jobLabel, who, 'withdraw')
    return true
end

---The society's most recent transactions, newest first: { id, title, amount, kind, issuer,
---receiver, message, time }.
---@param jobName string
---@param limit integer
---@return table[]
function society.transactions(jobName, limit)
    local b = backend()
    if not b then return {} end
    local ok, list = pcall(function() return exports[b]:getAccountTransactions(jobName) end)
    if not ok or type(list) ~= 'table' then return {} end
    local out = {}
    for i = 1, math.min(#list, limit) do
        local t = list[i]
        out[#out + 1] = {
            id = t.trans_id, title = t.title, amount = tonumber(t.amount) or 0, kind = t.trans_type,
            issuer = t.issuer, receiver = t.receiver, message = t.message, time = tonumber(t.time) or 0,
        }
    end
    return out
end

return society
