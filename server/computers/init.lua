---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table Profile + log persistence (server.computers.store).
local store = require 'server.computers.store'
---@type table Mail persistence (server.computers.mailstore).
local mailstore = require 'server.computers.mailstore'
---@type table System Logs (server.computers.logs).
local logs = require 'server.computers.logs'
---@type table Computer definitions (server.computers.registry).
local registry = require 'server.computers.registry'
---@type table Computers placed from the admin panel (server.computers.placed).
local placed = require 'server.computers.placed'

-- Boot order matters only for the schema: every table exists before the first callback can run.
-- The feature modules register their callbacks/exports at require time.
store.ensureSchema()
mailstore.ensureSchema()
placed.ensureSchema()
placed.load() -- before the first open: a placed computer is a registry entry like any other

require 'server.computers.session'
require 'server.computers.shell'
require 'server.computers.mail'
require 'server.computers.boss'
require 'server.computers.hacks'
require 'server.computers.phoneapps' -- Messages + Notes over the optional sd-phone link (inert without it)
require 'server.admin.panel' -- the /computeradmin panel's verbs: list, place, change, move, remove

---Retention purge at boot, then every 6 hours.
CreateThread(function()
    while true do
        logs.purge()
        Wait(6 * 60 * 60 * 1000)
    end
end)

---Export: every computer (id, label, location or model) - the configured ones and the ones placed
---from the admin panel (`placed = true`, with the prop they stand as) - for other resources that
---want to write logs to them or list them.
---@return table[] { id, label, hostname, coords?, model?, placed?, prop? }
exports('GetComputers', function()
    local out = {}
    for _, def in ipairs(registry.all()) do
        out[#out + 1] = { id = def.id, label = def.label, hostname = def.hostname, coords = def.coords, model = def.model, placed = def.placed ~= nil or nil, prop = def.prop }
    end
    return out
end)

local placedCount = 0
for _ in pairs(placed.all()) do placedCount = placedCount + 1 end
log.info(nil, 'ready - %d computers (%d configured, %d placed)', #registry.all(), #registry.all() - placedCount, placedCount)
