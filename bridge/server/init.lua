---@type table Tagged debug logger for this file (bridge.shared.debug).
local dprint = require('bridge.shared.debug').tag('bridge:init')

dprint('init: loading server bridge sub-modules...')

require 'bridge.server.player'
dprint('init: bridge.server.player loaded')

require 'bridge.server.notify'
dprint('init: bridge.server.notify loaded')

require 'bridge.server.inventory'
dprint('init: bridge.server.inventory loaded')

require 'bridge.server.money'
dprint('init: bridge.server.money loaded')

require 'bridge.server.job'
dprint('init: bridge.server.job loaded')

require 'bridge.server.gang'
dprint('init: bridge.server.gang loaded')

require 'bridge.server.stash'
dprint('init: bridge.server.stash loaded')

require 'bridge.server.vehicles'
dprint('init: bridge.server.vehicles loaded')

---@type table Detected framework descriptor (bridge.shared.framework).
local framework = require 'bridge.shared.framework'

---@type table Detected inventory resource descriptor (bridge.shared.inventory_id).
local inventoryId = require 'bridge.shared.inventory_id'

dprint('init: all server bridge modules loaded — framework=%s inventory=%s', tostring(framework.name), tostring(inventoryId.name or 'framework-default'))

print(('^2[SD-COMPUTERS]^0 Bridge initialised — Framework: ^3%s^0, Inventory: ^3%s^0'):format(
    framework.name, inventoryId.name or 'framework-default'))

-- No update check: sd-computers is a personal resource with no GitHub release repo, so it would
-- only print "Failed to fetch release info (HTTP 404)" on every boot. bridge/server/version.lua is
-- kept - require it and call version.check('<owner>/<repo>') if this ever gets published.
