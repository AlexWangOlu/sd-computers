---@type table Instance module; the table returned at end of file.
local instance = {}

---The per-machine key a computer's System Logs, busy-lock, hack cooldowns and screen hang off. A
---location computer is one machine (its id); a model computer is one machine PER PROP, keyed by
---the prop's rounded coords - '<id>@x,y,z'. Shared, so a client names the prop it is looking at
---exactly as the server names the session on it.
---@param def table computers.lua entry
---@param coords vector3|table the prop's coords (ignored for location computers)
---@return string instance
function instance.id(def, coords)
    if def.coords ~= nil or def.model == nil then return def.id end
    return ('%s@%d,%d,%d'):format(def.id, math.floor(coords.x + 0.5), math.floor(coords.y + 0.5), math.floor(coords.z + 0.5))
end

return instance
