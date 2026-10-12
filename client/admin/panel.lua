---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table Placement gizmo (client.admin.placer).
local placer = require 'client.admin.placer'
---@type table Client computer state (client.computers.state): whether a computer is open.
local state = require 'client.computers.state'

---@type table Admin config (config.Admin): the props a computer can be placed as.
local A = config.Admin

-- The /computeradmin panel's client side: opens the NUI page with a snapshot, relays its actions
-- to the server, and runs the placement gizmo with the panel hidden whenever a computer is placed
-- or moved. Built the way sd-bombs builds its panel, so both behave the same.

---@type boolean Whether the panel is open. Hidden-for-placement still counts as open: focus comes
---back the moment the placer returns.
local open = false

---Ask the server. Every reply has the same shape, so a lost reply becomes a failure here.
---@param verb string
---@param data table|nil
---@return table reply { success: boolean, message?: string, data?: table }
local function request(verb, data)
    local reply = lib.callback.await('sd-computers:server:admin:' .. verb, false, data or {})
    if type(reply) ~= 'table' then return { success = false, message = locale('ui.admin.toast.failed') } end
    return reply
end

---Send one message to the admin panel NUI. It lives in an iframe of the resource's page, which
---forwards every message on (web/src/AdminFrame.tsx).
---@param action string NUI action (computers:admin:<verb>)
---@param data table|nil
local function push(action, data)
    SendNUIMessage({ action = action, data = data })
end

-- The gizmo draws its HUD in the admin page.
placer.setHud(function(action, data) push(action, data) end)

---Take focus and mount the panel with a fresh snapshot. Strings first: the panel reads them as
---it renders.
---@param snap table
local function show(snap)
    SetNuiFocus(true, true)
    push('computers:admin:locale', { strings = lib.getLocales() })
    push('computers:admin:open', { snapshot = snap })
end

---Drop focus and hide the panel (it stays mounted) so the admin can aim the placer.
local function hideForPlacement()
    push('computers:admin:hide')
    SetNuiFocus(false, false)
end

---Bring the panel back after a placement with the outcome and a fresh snapshot.
---@param placed table { what, action, success, message?, cancelled? }
local function showAfterPlacement(placed)
    local snap = request('snapshot')
    SetNuiFocus(true, true)
    push('computers:admin:show', { snapshot = snap.data and snap.data.snapshot, placed = placed })
end

---Close for good. Idempotent.
local function close()
    if not open then return end
    open = false
    SetNuiFocus(false, false)
    push('computers:admin:close')
end

---Server push: open the admin panel (/computeradmin). Not while sitting at a computer: the two
---share the resource's one NUI page, and its focus.
RegisterNetEvent('sd-computers:client:openAdmin', function()
    if open or placer.isActive() then return end
    if state.isOpen() then
        lib.notify({ title = locale('admin.title'), description = locale('admin.close_computer_first'), type = 'error' })
        return
    end
    local snap = request('snapshot')
    if not snap.success then
        lib.notify({ title = locale('admin.title'), description = snap.message, type = 'error' })
        return
    end
    open = true
    show(snap.data.snapshot)
end)

---NUI callback: the panel asked to close (Escape or the X).
RegisterNUICallback('computers:admin:close', function(_, cb)
    cb({ ok = true })
    close()
end)

---@type table<string, string> Plain pass-throughs: NUI verb -> server verb. The reply goes straight
---back to the panel, which re-renders from the snapshot inside it.
local PASS = {
    snapshot = 'snapshot',
    updatecomputer = 'updateComputer',
    deletecomputer = 'deleteComputer',
    deleteallcomputers = 'deleteAllComputers',
}

for nuiVerb, serverVerb in pairs(PASS) do
    RegisterNUICallback('computers:admin:' .. nuiVerb, function(data, cb)
        cb(request(serverVerb, data))
    end)
end

---NUI callback: teleport, then close - standing in front of the thing is the point.
RegisterNUICallback('computers:admin:teleport', function(data, cb)
    local reply = request('teleport', data)
    cb(reply)
    if reply.success then close() end
end)

---What the HUD calls a prop: its name from config.Admin.Props (the model name when it is not listed).
---@param model string
---@return string
local function propLabel(model)
    for _, p in ipairs(A.Props or {}) do
        if p.model == model then return p.label or model end
    end
    return model
end

---Run the placer with the panel hidden, create (or move) the record from the result, and bring
---the panel back with the outcome.
---@param model string prop previewed
---@param action 'placed'|'moved'
---@param build fun(spot: table): string, table turns the placed transform into server verb + payload
---@param from table|nil where it stands now, when moving it
local function placeAndCreate(model, action, build, from)
    hideForPlacement()
    -- (airborne: a computer belongs on a desk - it starts sitting on what was aimed at, and is not
    -- dropped to the floor or warned about floating)
    local spot, err = placer.start('object', model, propLabel(model), nil, from, { airborne = true })
    local placed
    if spot then
        local reply = request(build(spot))
        placed = { what = 'computer', action = action, success = reply.success, message = (not reply.success) and reply.message or nil }
    else
        placed = { what = 'computer', action = action, success = false, cancelled = err == nil, message = err and locale(err) or nil }
    end
    log.debug('admin', 'placement %s: %s', action, placed.success and 'ok' or tostring(placed.message or 'cancelled'))
    if open then showAfterPlacement(placed) end
end

---NUI callback: place a computer, set up in the panel: its prop, name, style and job lock. Replies
---immediately; the panel waits for computers:admin:show. The server checks all of it again.
RegisterNUICallback('computers:admin:placecomputer', function(data, cb)
    cb({ ok = true })
    placeAndCreate(tostring(data.prop), 'placed', function(spot)
        return 'createComputer', {
            x = spot.x, y = spot.y, z = spot.z, heading = spot.heading,
            label = data.label, prop = data.prop, style = data.style, jobs = data.jobs,
        }
    end)
end)

---NUI callback: pick a new spot for a placed computer with the gizmo. It keeps its id - and its logs.
RegisterNUICallback('computers:admin:movecomputer', function(data, cb)
    cb({ ok = true })
    local c = (GlobalState['sd-computers:placed'] or {})[tostring(data.id)]
    if not c then
        if open then showAfterPlacement({ what = 'computer', action = 'moved', success = false, message = locale('admin.gone') }) end
        return
    end
    placeAndCreate(c.prop, 'moved', function(spot)
        return 'moveComputer', { id = data.id, x = spot.x, y = spot.y, z = spot.z, heading = spot.heading }
    end, { x = c.coords.x, y = c.coords.y, z = c.coords.z, heading = c.coords.w })
end)

---Give focus back when this resource stops (the placer cancels itself).
---@param resource string stopping resource name
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    if open then SetNuiFocus(false, false) end
end)

---@type table Admin panel module; the table returned at end of file.
local panel = {}

---Whether the admin panel is up (the gizmo running counts).
---@return boolean
function panel.isOpen() return open or placer.isActive() end

return panel
