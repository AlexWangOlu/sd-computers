---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Client computer state (client.computers.state): whether a computer is open.
local state = require 'client.computers.state'
---@type table The admin panel (client.admin.panel): whether it, or one of its tools, is up.
local panel = require 'client.admin.panel'
---@type table Inventory helpers (bridge.client.inventory): what a printout's tooltip says.
local inventory = require 'bridge.client.inventory'

---@type table Printers config (config.Printers).
local P = config.Printers or {}

-- A printed page, in the hand. Using the item (config.Printers.Item) has the server look the page
-- up and send it here, and this puts it on the screen: a sheet of paper over the game, drawn by the
-- OS page with no computer open (web/src/os/Paper.tsx), the way a StartHack window is. The page is
-- read and it is closed; the one thing it asks of the server is to sign a line on it, which the
-- server does for whoever really holds the sheet (server/computers/printing.lua).

---@type boolean Whether a page is up.
local open = false
---@type boolean Whether the character was put into the reading pose for it.
local reading = false

---Put the page down. Idempotent.
local function close()
    if not open then return end
    open = false
    SendNUIMessage({ action = 'computers:paper:close' })
    if not state.isOpen() then SetNuiFocus(false, false) end
    if reading then
        reading = false
        ClearPedTasks(cache.ped)
    end
end

---Server push: the page of the printout this player just used.
---@param page { id?: integer, doc?: table, by?: string, from?: string, at?: integer, signing?: { name: string }, faded?: boolean, title?: string }
RegisterNetEvent('sd-computers:client:paper', function(page)
    if type(page) ~= 'table' then return end
    -- (the resource has one NUI page, and its focus: a computer or the panel has it already)
    if state.isOpen() or panel.isOpen() then
        lib.notify({ title = locale('print.notify_title'), description = locale('print.close_computer_first'), type = 'error' })
        return
    end
    open = true
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'computers:paper:open', data = page })

    local ped = cache.ped
    if P.ReadAnimation ~= false and not reading and IsPedOnFoot(ped) and not IsEntityDead(ped) and not IsPedRagdoll(ped) then
        reading = true
        TaskStartScenarioInPlace(ped, 'WORLD_HUMAN_CLIPBOARD', 0, true)
    end
end)

---NUI callback: the page was put down (Escape, the X, a click beside it).
RegisterNUICallback('computers:paper:close', function(_, cb)
    cb({ ok = true })
    close()
end)

---NUI callback: the signature this player signs with, if they have drawn one.
RegisterNUICallback('computers:paper:signature', function(_, cb)
    if not open then return cb({ ok = false }) end
    cb(lib.callback.await('sd-computers:server:paper:signature', false) or { ok = false })
end)

---NUI callback: sign a line of the page that is up. The answer is the page as it is now.
---@param data { field: integer, image?: string }
RegisterNUICallback('computers:paper:sign', function(data, cb)
    if not open or type(data) ~= 'table' then return cb({ ok = false }) end
    cb(lib.callback.await('sd-computers:server:paper:sign', false, { field = data.field, image = data.image }) or { ok = false })
end)

-- What a printout's tooltip adds under its name, where the inventory can show it (ox_inventory).
CreateThread(function()
    pcall(inventory.registerDisplayMetadata, {
        printed_by = locale('print.meta_by'),
        printed_at = locale('print.meta_at'),
        printed_from = locale('print.meta_from'),
        signed_by = locale('print.meta_signed'),
    })
end)

---Give focus back when this resource stops with a page up.
---@param resource string stopping resource name
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    if open then
        SetNuiFocus(false, false)
        if reading then ClearPedTasks(cache.ped) end
    end
end)

return {}
