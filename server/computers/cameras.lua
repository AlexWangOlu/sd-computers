---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table Job predicates (bridge.server.job).
local job = require 'bridge.server.job'
---@type table Gang predicates (bridge.server.gang).
local gang = require 'bridge.server.gang'

---@type table Cameras config (config.Cameras).
local C = config.Cameras or {}

-- The security cameras of configs/shared/cameras.lua, and who may watch which from where. This
-- file only knows the cameras: session.lua asks it whether a player gets the app at all (they do
-- when there is at least one camera for them at that computer), and the app's two endpoints
-- (server/computers/shell.lua) list those cameras and hand one's position over - never one the
-- player may not see, whatever the client asks for.

---@type table Camera module; the table returned at end of file.
local cameras = {}

---@class SecurityCamera
---@field id string
---@field label string
---@field area string|nil the heading it is listed under
---@field x number where it is
---@field y number
---@field z number
---@field pitch number the way it looks (rotation order 2)
---@field roll number
---@field yaw number
---@field fov number
---@field groups table<string, integer>|nil job/gang lock; nil = anyone
---@field computers table<string, boolean>|nil computer ids it can be watched from; nil = any

---@type SecurityCamera[] Every camera, in config order.
local list = {}
do
    local seen = {}
    for _, c in ipairs(type(C.Cameras) == 'table' and C.Cameras or {}) do
        local rot = c.rot
        if type(c.id) == 'string' and not seen[c.id] and type(c.coords) == 'vector3' and (rot == nil or type(rot) == 'vector3') then
            seen[c.id] = true
            local from
            if type(c.computers) == 'table' then
                from = {}
                for _, id in ipairs(c.computers) do from[id] = true end
            end
            list[#list + 1] = {
                id = c.id, label = type(c.label) == 'string' and c.label or c.id, area = type(c.area) == 'string' and c.area or nil,
                x = c.coords.x, y = c.coords.y, z = c.coords.z,
                pitch = rot and rot.x or 0.0, roll = rot and rot.y or 0.0, yaw = rot and rot.z or 0.0,
                fov = math.min(110.0, math.max(10.0, tonumber(c.fov) or 60.0)),
                groups = type(c.groups) == 'table' and next(c.groups) ~= nil and c.groups or nil,
                computers = from,
            }
        else
            log.warn('cameras', 'camera %s needs a unique id and coords (and its rot must be a vec3) - skipped', tostring(c.id))
        end
    end
end

---Does the player satisfy a camera's `groups` lock (any listed job/gang at its min grade)?
---@param src integer
---@param groups table<string, integer>|nil
---@return boolean
local function allowed(src, groups)
    if not groups then return true end
    for name, minGrade in pairs(groups) do
        local g = tonumber(minGrade) or 0
        if job.has(src, name, g) or gang.has(src, name, g) then return true end
    end
    return false
end

---The cameras a player may watch from a computer, in config order (none while the app is off, or
---the computer opts out with `cameras = false`).
---@param src integer
---@param def table computers.lua entry
---@return SecurityCamera[]
function cameras.visible(src, def)
    local out = {}
    if C.Enabled == false or def.cameras == false then return out end
    for _, cam in ipairs(list) do
        if (not cam.computers or cam.computers[def.id]) and allowed(src, cam.groups) then out[#out + 1] = cam end
    end
    return out
end

---How far a camera turns and zooms, and whether its picture has scan lines (configs/shared/cameras.lua).
---@return { pan: number, tilt: number, zoom: number, effect: boolean }
function cameras.limits()
    return {
        pan = math.min(180.0, math.max(0.0, tonumber(C.Pan) or 60.0)),
        tilt = math.min(80.0, math.max(0.0, tonumber(C.Tilt) or 25.0)),
        zoom = math.min(10.0, math.max(1.0, tonumber(C.Zoom) or 3.0)),
        effect = C.Effect ~= false,
    }
end

return cameras
