---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'

-- Where the screen is on a computer's prop: the rectangle from configs/shared/screens.lua
-- (Screens.Models), worked out once per model. Two things stand on it - the picture drawn on the
-- prop for everyone around (client/screens/world.lua), and the camera that goes up to it for the
-- player using the computer (client/computers/view.lua).

---@type table Quads module; the table returned at end of file.
local quads = {}

---@type number Metres from a location computer's zone centre its screen prop is looked for.
quads.ZONE_RADIUS = 1.25

---@class ScreenQuad everything from the prop's origin, in the prop's own axes
---@field tl vector3 corners
---@field tr vector3
---@field bl vector3
---@field br vector3
---@field c vector3 the middle
---@field n vector3 the way the screen faces (unit)
---@field right vector3 along its top edge, left to right as you look at it (unit)
---@field up vector3 along its side, bottom to top (unit)
---@field w number width, metres
---@field h number height
---@field aspect number width over height

---@type number Metres every rectangle is drawn in front of where it was measured. A rectangle lying
---exactly in the glass fights it for the pixel, and from some angles half of it loses.
local LIFT = 0.0006

---@type table<integer, ScreenQuad> model hash -> where its screen is.
local byModel = {}
for name, q in pairs((config.Screens and config.Screens.Models) or {}) do
    local c, size = q.centre, q.size
    if c and size and size.x > 0 and size.y > 0 then
        local tilt, heading = math.rad(q.tilt or 0.0), math.rad(q.heading or 0.0)
        local ch, sh = math.cos(heading), math.sin(heading)
        -- Measured with the screen facing the viewer (x right, y away, z up), then turned to the way
        -- the model really faces.
        local function turn(x, y, z) return vec3(x * ch - y * sh, x * sh + y * ch, z) end
        local normal = turn(0.0, -math.cos(tilt), math.sin(tilt))
        local mid = turn(c.x, c.y, c.z) + normal * LIFT
        local right = turn(1.0, 0.0, 0.0)
        local up = turn(0.0, math.sin(tilt), math.cos(tilt))
        local hr, hu = right * (size.x / 2), up * (size.y / 2)
        byModel[joaat(name)] = {
            tl = mid - hr + hu, tr = mid + hr + hu, bl = mid - hr - hu, br = mid + hr - hu,
            c = mid, n = normal, right = right, up = up,
            w = size.x, h = size.y, aspect = size.x / size.y,
        }
    else
        log.warn('screens', 'screen for model %s needs a centre and a size - skipped', tostring(name))
    end
end

---Where a model's screen is (nil for a model that has none).
---@param model integer model hash
---@return ScreenQuad|nil
function quads.model(model)
    return byModel[model]
end

---Where a prop's screen is (nil when it has none).
---@param entity integer
---@return ScreenQuad|nil
function quads.of(entity)
    return byModel[GetEntityModel(entity)]
end

---The prop with a screen nearest a point.
---@param coords vector3
---@param radius number metres
---@return integer|nil entity
function quads.near(coords, radius)
    local best, bestDist
    for _, entity in ipairs(GetGamePool('CObject')) do
        if byModel[GetEntityModel(entity)] then
            local d = #(GetEntityCoords(entity) - coords)
            if d <= radius and (not bestDist or d < bestDist) then best, bestDist = entity, d end
        end
    end
    return best
end

---A prop's screen in the world.
---@param entity integer
---@param q ScreenQuad
---@param inset? number metres to pull every edge in by
---@return vector3 tl, vector3 tr, vector3 bl, vector3 br, vector3 centre, vector3 normal
function quads.place(entity, q, inset)
    local function at(v) return GetOffsetFromEntityInWorldCoords(entity, v.x, v.y, v.z) end
    local i = inset or 0.0
    local r, u = q.right * i, q.up * i
    local c = at(q.c)
    return at(q.tl + r - u), at(q.tr - r - u), at(q.bl + r + u), at(q.br - r + u), c, at(q.c + q.n) - c
end

return quads
