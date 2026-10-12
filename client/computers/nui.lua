---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Client computer state (client.computers.state).
local state = require 'client.computers.state'
---@type table Police dispatch bridge (bridge.client.alert).
local alert = require 'bridge.client.alert'

-- NUI <-> server plumbing. The NUI never talks to the server directly: app actions go through ONE
-- passthrough ('computers:rpc' -> 'sd-computers:server:rpc'), where the server's session guard
-- decides everything. Nothing in here trusts or alters a payload.

---@type table|nil Cached decode of locales/<config.Locale>.json for the frontend.
local uiStrings

---Hand the active locale + its strings to the NUI (fetched once on app mount). The React side
---bundles en as the fallback and deep-merges this over it, so a partial locale only needs overrides.
---@param _ any unused nui data
---@param cb function nui callback
RegisterNUICallback('computers:ui:locale', function(_, cb)
    if not uiStrings then
        local raw = LoadResourceFile(GetCurrentResourceName(), ('locales/%s.json'):format(config.Locale or 'en'))
        uiStrings = (raw and json.decode(raw)) or {}
    end
    cb({ locale = config.Locale or 'en', strings = uiStrings })
end)

---Lock screen -> desktop (PIN checked server-side).
---@param data { pin?: string }
---@param cb function nui callback
RegisterNUICallback('computers:signIn', function(data, cb)
    cb(lib.callback.await('sd-computers:server:signIn', false, data and data.pin) or { ok = false })
end)

---Desktop -> lock screen (Start > Lock, Win+L).
---@param _ any unused nui data
---@param cb function nui callback
RegisterNUICallback('computers:lock', function(_, cb)
    TriggerServerEvent('sd-computers:server:lock')
    cb({ ok = true })
end)

---The NUI shut itself down (Start > Shut down, or Escape on the desktop).
---@param _ any unused nui data
---@param cb function nui callback
RegisterNUICallback('computers:close', function(_, cb)
    state.close()
    cb({ ok = true })
end)

---Every app action: a straight passthrough to the server's guarded rpc dispatcher.
---@param data { endpoint: string, payload?: table }
---@param cb function nui callback
RegisterNUICallback('computers:rpc', function(data, cb)
    if not state.isOpen() or type(data) ~= 'table' then return cb({ ok = false }) end
    cb(lib.callback.await('sd-computers:server:rpc', false, data.endpoint, data.payload) or { ok = false, error = locale('err.internal') })
end)

---Server push: a mail landed in an address this player is signed into while they sit at a computer.
---@param data { mailbox: string, message: table }
RegisterNetEvent('sd-computers:client:mailReceived', function(data)
    if not state.isOpen() then return end
    SendNUIMessage({ action = 'computers:mail:received', data = data })
end)

-- Optional sd-phone link (configs/shared/phone.lua). sd-phone pushes these to its own UI; a
-- player sitting at a computer gets them on the desktop too. Registering sd-phone's event names
-- here changes nothing for sd-phone (every resource's handler runs), and without sd-phone they
-- simply never fire. The NUI drops them unless this computer's Mail / Messages is the phone's.

---sd-phone: a mail landed in a phone account this player is signed into.
---@param msg table sd-phone MailMessage
RegisterNetEvent('sd-phone:client:mail:received', function(msg)
    if not state.isOpen() or type(msg) ~= 'table' then return end
    SendNUIMessage({ action = 'computers:phone:mail', data = msg })
end)

---sd-phone: a text arrived ({ id = thread id, participants, messages = { newMessage } }).
---@param conv table sd-phone Conversation
RegisterNetEvent('sd-phone:client:messages:incoming', function(conv)
    if not state.isOpen() or type(conv) ~= 'table' then return end
    SendNUIMessage({ action = 'computers:phone:message', data = conv })
end)

---sd-phone: the other side of a 1:1 thread read my texts ({ conversation = their number, seenAt = ms }).
---@param data table
RegisterNetEvent('sd-phone:client:messages:seen', function(data)
    if not state.isOpen() or type(data) ~= 'table' then return end
    SendNUIMessage({ action = 'computers:phone:seen', data = data })
end)

---Server -> boss's target: "X wants to hire you at Y" - accept/decline, auto-declining after 20s so
---the boss's request can never hang.
---@param bossName string
---@param jobLabel string
---@return boolean accepted
lib.callback.register('sd-computers:client:confirmHire', function(bossName, jobLabel)
    local answered = false
    SetTimeout(20000, function()
        if not answered then lib.closeAlertDialog() end
    end)
    local res = lib.alertDialog({
        header = locale('boss.offer_header', jobLabel),
        content = locale('boss.offer_body', bossName, jobLabel),
        centered = true,
        cancel = true,
        labels = { confirm = locale('boss.offer_accept'), cancel = locale('boss.offer_decline') },
    })
    answered = true
    return res == 'confirm'
end)

---Server -> hacker: a breach rolled a police alert (targets.lua `alert`). Sent from here so the
---dispatch carries the hacker's real position/street, through whatever dispatch resource runs.
---@param cfg table targets.lua alert block
RegisterNetEvent('sd-computers:client:alert', function(cfg)
    if type(cfg) ~= 'table' then return end
    alert.send({
        title = cfg.title, message = cfg.message, description = cfg.message,
        displayCode = cfg.code, code = cfg.code, jobs = cfg.jobs,
        sprite = cfg.sprite or 521, colour = cfg.colour or 1, scale = cfg.scale or 1.0,
        blipText = cfg.title,
    })
end)
