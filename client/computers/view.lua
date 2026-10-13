---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Where the screen is on each prop (client.screens.quads).
local quads = require 'client.screens.quads'

---@type table How a computer is used (config.Interact).
local I = config.Interact or {}
---@type table The camera that goes up to the screen (config.Interact.Camera).
local C = I.Camera or {}

-- The view from the chair. Using a computer does not cover the game with a desktop: the camera
-- goes up to the prop, square on to its screen, and the desktop is laid exactly over that screen
-- - so what frames it is the prop's own bezel, and the room is still there around it.
--
-- The camera sits on the line straight out of the middle of the screen. From there the screen is
-- not skewed at all: it is a plain upright rectangle on the player's display, and that rectangle
-- is all the NUI needs to be told (web/src/host places the OS in it).

---@type table View module; the table returned at end of file.
local view = {}

---@type boolean Whether the camera goes up to the screen at all ('fullscreen' = the old way).
local ENABLED = I.View ~= 'fullscreen'
---@type number How much of the display's height the screen takes.
local FILL = math.min(0.95, math.max(0.3, tonumber(C.Fill) or 0.76))
---@type number The most of the display's width it may take (a wide screen on a narrow display backs off to this).
local MAX_WIDTH = 0.9
---@type number Camera field of view, degrees (vertical).
local FOV = math.min(80.0, math.max(15.0, tonumber(C.Fov) or 40.0))
---@type integer ms the camera takes to get there and back.
local EASE = math.max(0, math.floor(tonumber(C.Ease) or 600))
---@type number Metres the desktop stops short of the edge of the screen: the rectangles in
---Screens.Models run a little under the bezel, and the desktop should not.
local INSET = 0.0035

---@class ScreenView
---@field cam integer the scripted camera
---@field entity integer the prop
---@field tl vector3 its screen's corners
---@field tr vector3
---@field bl vector3
---@field br vector3
---@field radar boolean the radar was showing and has been put away
---@field lit boolean the camera has arrived: the screen is the desktop's now
---@field away boolean|nil the display is showing something else for now (a security camera's picture)

---@type ScreenView|nil The view in use (nil when the player is not at a screen).
local current

---While at the screen: the player's own ped is not drawn for them (the camera is where their head
---is), and the prop's screen is black behind the desktop, so nothing of its own picture shows
---around the edge.
---@param v ScreenView
local function hold(v)
    CreateThread(function()
        local hideAt = GetGameTimer() + math.floor(EASE * 0.6)
        while current == v do
            if v.away then
                -- (the display shows a security camera's picture: the room is as anyone sees it -
                -- that camera may well be looking at this very desk)
                Wait(100)
            else
                if GetGameTimer() >= hideAt then SetEntityLocallyInvisible(cache.ped) end
                if v.lit then
                    local tl, tr, bl, br = v.tl, v.tr, v.bl, v.br
                    DrawPoly(bl.x, bl.y, bl.z, br.x, br.y, br.z, tr.x, tr.y, tr.z, 0, 0, 0, 255)
                    DrawPoly(bl.x, bl.y, bl.z, tr.x, tr.y, tr.z, tl.x, tl.y, tl.z, 0, 0, 0, 255)
                end
                Wait(0)
            end
        end
    end)
end

---Take the camera up to a prop's screen. Yields while it travels.
---@param entity integer|nil the prop
---@return { x: number, y: number, w: number, h: number }|nil rect the part of the display the
---screen covers, as fractions of it - nil when there is no screen to go to (the desktop is then
---fullscreen), or the player left on the way
function view.enter(entity)
    if not ENABLED or not entity or not DoesEntityExist(entity) then return nil end
    local quad = quads.of(entity)
    if not quad then return nil end
    if current then view.leave() end

    local tl, tr, bl, br, centre, normal = quads.place(entity, quad)
    local reach = math.tan(math.rad(FOV) / 2)
    local aspect = GetAspectRatio(false)
    local dist = math.max((quad.h / 2) / (FILL * reach), (quad.w / 2) / (MAX_WIDTH * reach * aspect))
    local from = centre + normal * dist

    local cam = CreateCamWithParams('DEFAULT_SCRIPTED_CAMERA', from.x, from.y, from.z, 0.0, 0.0, 0.0, FOV, false, 2)
    PointCamAtCoord(cam, centre.x, centre.y, centre.z)
    SetCamActive(cam, true)
    RenderScriptCams(true, true, EASE, true, true)

    local v = { cam = cam, entity = entity, tl = tl, tr = tr, bl = bl, br = br, radar = false, lit = false }
    if C.HideRadar ~= false and not IsRadarHidden() then
        DisplayRadar(false)
        v.radar = true
    end
    current = v
    hold(v)

    Wait(EASE + 50)
    if current ~= v then return nil end

    -- Where the screen ended up on the display: asked of the game, with the arithmetic to fall back on.
    local itl, _, _, ibr = quads.place(entity, quad, INSET)
    local a, x0, y0 = GetScreenCoordFromWorldCoord(itl.x, itl.y, itl.z)
    local b, x1, y1 = GetScreenCoordFromWorldCoord(ibr.x, ibr.y, ibr.z)
    if not (a and b) or x1 - x0 < 0.05 or y1 - y0 < 0.05 then
        local h = (quad.h - 2 * INSET) / (2 * dist * reach)
        local w = (quad.w - 2 * INSET) / (2 * dist * reach * aspect)
        x0, y0, x1, y1 = 0.5 - w / 2, 0.5 - h / 2, 0.5 + w / 2, 0.5 + h / 2
    end
    v.lit = true
    return { x = x0, y = y0, w = x1 - x0, h = y1 - y0 }
end

---Hand the view back to the player. Idempotent.
function view.leave()
    local v = current
    if not v then return end
    current = nil
    RenderScriptCams(false, true, EASE, true, true)
    if v.radar then DisplayRadar(true) end
    SetTimeout(EASE + 100, function()
        if DoesCamExist(v.cam) then DestroyCam(v.cam, false) end
    end)
end

---Let the display show something else for a while without leaving the screen: the Security
---Cameras app putting a camera's picture up (client/computers/cameras.lua). The camera at the
---screen is kept, switched off, for view.resume() to come back to.
---@return boolean paused false when the player is not at a screen (their computer is fullscreen)
function view.pause()
    local v = current
    if not v then return false end
    v.away = true
    SetCamActive(v.cam, false)
    return true
end

---Come back to the screen after view.pause().
---@return boolean resumed false when there is no screen to come back to
function view.resume()
    local v = current
    if not v or not v.away then return false end
    v.away = false
    SetCamActive(v.cam, true)
    RenderScriptCams(true, false, 0, true, true)
    return true
end

---The prop whose screen the player's desktop is on right now (nil when none) - its picture in the
---world is left out while it is (client/screens/world.lua).
---@return integer|nil entity
function view.entity()
    return current and current.lit and not current.away and current.entity or nil
end

---Drop the camera at once (resource stop).
function view.shutdown()
    local v = current
    if not v then return end
    current = nil
    RenderScriptCams(false, false, 0, true, true)
    if DoesCamExist(v.cam) then DestroyCam(v.cam, false) end
    if v.radar then DisplayRadar(true) end
end

return view
