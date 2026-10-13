---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'

-- Load translations for this VM from configs/config.lua's `Locale` (en is always loaded first as
-- the per-key fallback). See locales/.
lib.locale(config.Locale)

require 'client.computers.state'
require 'client.admin.placer'       -- the placement gizmo (the same creator sd-bombs and sd-scooters use)
require 'client.admin.picker'       -- aiming at a prop the game already has, to make it a computer
require 'client.computers.auto'     -- which props in the world are a computer on their own right now (the admin panel's switches)
require 'client.computers.placed'   -- computers placed or picked from the admin panel: their props + target option
require 'client.computers.interact' -- target options on every configured location / prop model
require 'client.computers.nui'      -- NUI <-> server passthroughs, mail push, hire prompt, alerts
require 'client.computers.hacks'    -- StartHack export (standalone hack.exe window)
require 'client.admin.panel'        -- the /computeradmin panel: NUI glue + placing/moving through the gizmo
require 'client.screens.world'      -- the screen drawn on every computer prop: lock face, or the session's live copy

---@type table Client computer state (client.computers.state).
local state = require 'client.computers.state'
---@type table Computers placed from the admin panel (client.computers.placed).
local placed = require 'client.computers.placed'
---@type table The screens in the world (client.screens.world).
local screens = require 'client.screens.world'

---On resource stop, release NUI focus and the typing animation, give the screens' browsers up and
---delete the placed computers' props.
---@param resource string stopping resource name
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    state.shutdown()
    screens.shutdown()
    placed.cleanupAll()
end)

log.debug(nil, 'client loaded')
