---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
lib.locale(config.Locale)   -- locale from configs/config.lua's `Locale` (en fallback per-key)

require 'server.computers.init'

---@type table Session module (server.computers.session).
local session = require 'server.computers.session'

---Clean teardown on resource stop: end every open session so each signed-in player gets a logoff
---entry in their computer's System Logs (their NUI closes itself on the client side), and clear
---the published placed computers so clients drop those props at once (GlobalState outlives us).
---@param resource string the stopping resource name
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        if src and session.get(src) then session.close(src) end
    end
    require('server.computers.placed').unpublish()
end)
