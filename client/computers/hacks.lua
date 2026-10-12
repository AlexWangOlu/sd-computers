---@type table Client computer state (client.computers.state).
local state = require 'client.computers.state'

-- The StartHack export: any resource can run one of the computer's hack minigames as a standalone
-- "hack.exe" window (no computer needed), e.g. a heist's door panel. The run goes through the same
-- server-verified pipeline as Command Prompt hacks; a win returns a one-shot proof the calling
-- resource should redeem server-side with exports['sd-computers']:ConsumeHackProof(src, proof).

---@type table|nil The run in progress: its promise, resolved by 'computers:lib:done'.
local pending

---Run a hack minigame and wait for the result.
---@param opts string|{ game: string, difficulty?: string, title?: string } game key, or options
---@param difficulty? string 'easy'|'medium'|'hard' (when opts is the game key)
---@return boolean won, string|nil proof redeem with ConsumeHackProof on the server
local function startHack(opts, difficulty)
    if pending then return false, nil end
    if type(opts) == 'string' then opts = { game = opts, difficulty = difficulty } end
    if type(opts) ~= 'table' then return false, nil end

    local res = lib.callback.await('sd-computers:server:libStart', false, opts.game, opts.difficulty)
    if not res or not res.ok then
        lib.notify({ description = res and res.error or locale('err.internal'), type = 'error' })
        return false, nil
    end

    pending = promise.new()
    local data = res.data
    data.title = opts.title
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'computers:lib:open', data = data })
    local result = Citizen.Await(pending)
    pending = nil
    if not state.isOpen() then SetNuiFocus(false, false) end
    return result and result.won == true, result and result.proof or nil
end
exports('StartHack', startHack)

---The hack window finished (won / lost / closed).
---@param data { won: boolean, proof?: string }
---@param cb function nui callback
RegisterNUICallback('computers:lib:done', function(data, cb)
    if pending then pending:resolve(type(data) == 'table' and data or { won = false }) end
    cb({ ok = true })
end)

---Milestone / submit / fail for a library run - straight passthroughs to the server pipeline.
RegisterNUICallback('computers:lib:advance', function(data, cb)
    cb(lib.callback.await('sd-computers:server:libAdvance', false, data.token, data.step, data.payload) or { ok = false })
end)
RegisterNUICallback('computers:lib:submit', function(data, cb)
    cb(lib.callback.await('sd-computers:server:libSubmit', false, data.token) or { ok = false })
end)
RegisterNUICallback('computers:lib:fail', function(data, cb)
    cb(lib.callback.await('sd-computers:server:libFail', false, data.token) or { ok = false })
end)

---Server-side RunHack export: the server asks this client to play, gets the proof back and
---redeems it itself.
---@param game string
---@param difficulty string
---@return string|nil proof
lib.callback.register('sd-computers:client:runHack', function(game, difficulty)
    local won, proof = startHack({ game = game, difficulty = difficulty })
    return won and proof or nil
end)
