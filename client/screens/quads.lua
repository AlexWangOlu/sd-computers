---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'

-- Where the screen is on a computer's prop: the rectangle from configs/shared/screens.lua
-- (Screens.Models), or the one an admin drew for that model in the panel (client/admin/screener.lua;
-- kept by the server, published, and winning over the file's), worked out once per model. Two things
-- stand on it - the picture drawn on the prop for everyone around (client/screens/world.lua), and the
-- camera that goes up to it for the player using the computer (client/computers/view.lua).

---@type table Quads module; the table returned at end of file.
local quads = {}

---@type string GlobalState key the server publishes the screens drawn in the admin panel under.
local STATE_KEY = 'sd-computers:screens'

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
quads.LIFT = 0.0006

---@type number Metres a screen is drawn further out from its prop for every metre the camera is away.
---The prop's own glass wins against a picture lying just in front of it more and more with distance
---(measured: a picture has to be 0.075 mm further out per metre to show at all, and where it is not
---quite far enough it is cut away in halves). Half a millimetre a metre is several times that, and
---less than a pixel at any distance, so the picture never visibly leaves the glass.
quads.LIFT_PER_METRE = 0.0005

---@class ScreenSpec a screen as it is measured: with the screen facing you (x right, y away, z up)
---@field x number the middle of the lit area, metres from the prop's origin
---@field y number
---@field z number
---@field w number its width
---@field h number its height
---@field tilt? number degrees it leans back
---@field heading? number degrees it is turned from the prop's front
---@field custom? boolean drawn in the admin panel, rather than listed in the file

---A screen's rectangle, from its measurements.
---@param s ScreenSpec
---@return ScreenQuad
function quads.make(s)
    local tilt, heading = math.rad(s.tilt or 0.0), math.rad(s.heading or 0.0)
    local ch, sh = math.cos(heading), math.sin(heading)
    -- Measured with the screen facing the viewer (x right, y away, z up), then turned to the way
    -- the model really faces.
    local function turn(x, y, z) return vec3(x * ch - y * sh, x * sh + y * ch, z) end
    local normal = turn(0.0, -math.cos(tilt), math.sin(tilt))
    local mid = turn(s.x, s.y, s.z) + normal * quads.LIFT
    local right = turn(1.0, 0.0, 0.0)
    local up = turn(0.0, math.sin(tilt), math.cos(tilt))
    local hr, hu = right * (s.w / 2), up * (s.h / 2)
    return {
        tl = mid - hr + hu, tr = mid + hr + hu, bl = mid - hr - hu, br = mid + hr - hu,
        c = mid, n = normal, right = right, up = up,
        w = s.w, h = s.h, aspect = s.w / s.h,
    }
end

---@type table<string, ScreenSpec> model name -> its screen as configs/shared/screens.lua has it.
local fromFile = {}
for name, q in pairs((config.Screens and config.Screens.Models) or {}) do
    local c, size = q.centre, q.size
    if c and size and size.x > 0 and size.y > 0 then
        fromFile[name] = { x = c.x, y = c.y, z = c.z, w = size.x, h = size.y, tilt = q.tilt or 0.0, heading = q.heading or 0.0 }
    else
        log.warn('screens', 'screen for model %s needs a centre and a size - skipped', tostring(name))
    end
end

---@type table<string, ScreenSpec> model name -> its screen: the file's, and over them the panel's.
local specs = {}
---@type table<integer, ScreenQuad> model hash -> where its screen is.
local byModel = {}

---Work every rectangle out again: the file's, then the ones drawn in the panel over them.
---@param drawn table<string, table>|nil the server's list: model name -> { x, y, z, w, h, tilt, heading }
local function rebuild(drawn)
    local all = {}
    for name, s in pairs(fromFile) do all[name] = s end
    for name, s in pairs(type(drawn) == 'table' and drawn or {}) do
        local x, y, z, w, h = tonumber(s.x), tonumber(s.y), tonumber(s.z), tonumber(s.w), tonumber(s.h)
        if type(name) == 'string' and x and y and z and w and h and w > 0 and h > 0 then
            all[name] = { x = x, y = y, z = z, w = w, h = h, tilt = tonumber(s.tilt) or 0.0, heading = tonumber(s.heading) or 0.0, custom = true }
        end
    end
    local map = {}
    for name, s in pairs(all) do map[joaat(name)] = quads.make(s) end
    specs, byModel = all, map
end

AddStateBagChangeHandler(STATE_KEY, 'global', function(_, _, value) rebuild(value) end)
rebuild(GlobalState[STATE_KEY])

---A model's screen as it is measured (nil for a model that has none), and the file's own for it
---when the one in use was drawn in the panel.
---@param name string model name
---@return ScreenSpec|nil spec
---@return ScreenSpec|nil file
function quads.spec(name)
    return specs[name], fromFile[name]
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
