---@type string GlobalState key the server publishes the computers taken away in the panel under.
local STATE_KEY = 'sd-computers:removed'

-- The location computers of configs/shared/computers.lua an admin took away in the panel
-- (server/computers/removed.lua). The target option and the screens both ask here, so one that is
-- taken away stops offering a computer and its prop goes back to its stock look at once, for
-- everyone - and comes back the same way when the panel restores it.

---@type table Removed-computer module; the table returned at end of file.
local removed = {}

---@type table<string, boolean> computer id -> true
local gone = GlobalState[STATE_KEY] or {}
AddStateBagChangeHandler(STATE_KEY, 'global', function(_, _, value) gone = value or {} end)

---Whether a computer was taken away in the admin panel.
---@param id any computer id
---@return boolean
function removed.is(id)
    return gone[id] == true
end

return removed
