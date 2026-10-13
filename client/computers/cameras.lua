---@type table Client computer state (client.computers.state): whether a computer is open.
local state = require 'client.computers.state'
---@type table The camera at the screen (client.computers.view): stepped away from while a camera is watched.
local view = require 'client.computers.view'

-- The Security Cameras app's picture. Choosing a camera in the app puts the game's own view where
-- that camera is: the desktop steps aside (web/src/apps/cameras draws a slim frame over the picture
-- instead), the player stays in their chair, and the camera turns and zooms within the limits
-- configs/shared/cameras.lua gives it, until they go back to the desktop.
--
-- Which camera, and where it is, is the server's to say: the page only ever names one by id, and
-- this file asks the server for it the way every app action is asked (the guarded rpc), so a
-- camera the player may not watch from this computer never comes back at all.

---@type table Camera-view module; the table returned at end of file.
local cameras = {}

---@class WatchedCamera
---@field cam integer the scripted camera
---@field id string
---@field pitch0 number the way it was set up to look
---@field roll number
---@field yaw0 number
---@field fov0 number
---@field yaw number how far it has been turned from that, degrees
---@field pitch number
---@field zoom number times it is zoomed in (1 = not)
---@field pan number most it turns either way
---@field tilt number most it tips up or down
---@field maxZoom number
---@field effect boolean scan lines are on
---@field radar boolean the radar was showing and has been put away
---@field screen boolean the player was at a prop's screen (there is a camera there to go back to)

---@type WatchedCamera|nil The camera being watched (nil when none).
local current

local function clamp(v, lo, hi) return math.max(lo, math.min(hi, v)) end

---Point the camera where its turn and zoom have it.
---@param w WatchedCamera
local function aim(w)
    SetCamRot(w.cam, w.pitch0 + w.pitch, w.roll, w.yaw0 + w.yaw, 2)
    SetCamFov(w.cam, w.fov0 / w.zoom)
end

---Tell the page what is on the display: a camera's picture (and which), or the desktop again.
---@param w WatchedCamera|nil
---@param info? table { label, area } of the camera
local function announce(w, info)
    if not w then
        SendNUIMessage({ action = 'computers:camera', data = { active = false } })
        return
    end
    SendNUIMessage({ action = 'computers:camera', data = { active = true, id = w.id, label = info and info.label, area = info and info.area, zoom = w.zoom, maxZoom = w.maxZoom } })
end

---While a camera is watched: nothing of the game's own HUD over its picture.
---@param w WatchedCamera
local function hold(w)
    CreateThread(function()
        while current == w do
            HideHudAndRadarThisFrame()
            Wait(0)
        end
    end)
end

---Go back to the desktop: the camera goes, the world around the player loads again, and the view
---returns to the prop's screen (or to the player, where the computer is fullscreen). Idempotent.
function cameras.stop()
    local w = current
    if not w then return end
    current = nil
    if w.effect then ClearTimecycleModifier() end
    ClearFocus()
    SetCamActive(w.cam, false)
    DestroyCam(w.cam, false)
    if not view.resume() then RenderScriptCams(false, false, 0, true, true) end
    FreezeEntityPosition(cache.ped, false)
    if w.radar then DisplayRadar(true) end
    announce(nil)
end

---NUI callback: watch a camera (or, already watching one, switch to another). Replies once its
---picture is up.
---@param data { id: string }
---@param cb function nui callback
RegisterNUICallback('computers:camera:start', function(data, cb)
    if not state.isOpen() or type(data) ~= 'table' or type(data.id) ~= 'string' then return cb({ ok = false }) end
    local res = lib.callback.await('sd-computers:server:rpc', false, 'cameras:watch', { id = data.id })
    if not res or not res.ok or type(res.data) ~= 'table' then
        return cb({ ok = false, error = res and res.error or locale('err.internal') })
    end
    if not state.isOpen() then return cb({ ok = false }) end -- (the computer closed while the server was asked)

    local c, was = res.data, current
    local cam = CreateCamWithParams('DEFAULT_SCRIPTED_CAMERA', c.x, c.y, c.z, c.pitch, c.roll, c.yaw, c.fov, false, 2)
    -- The world loads round wherever the game is asked to look; the player is somewhere else
    -- entirely, so they are held where they sit while the ground under them may not be there.
    SetFocusPosAndVel(c.x, c.y, c.z, 0.0, 0.0, 0.0)
    local w = {
        cam = cam, id = c.id, pitch0 = c.pitch, roll = c.roll, yaw0 = c.yaw, fov0 = c.fov,
        yaw = 0.0, pitch = 0.0, zoom = 1.0,
        pan = tonumber(c.pan) or 60.0, tilt = tonumber(c.tilt) or 25.0, maxZoom = math.max(1.0, tonumber(c.zoom) or 3.0),
        effect = c.effect == true, radar = false, screen = false,
    }
    if was then
        -- (switching: the same chair, the same put-away radar - only the camera changes)
        w.radar, w.screen = was.radar, was.screen
        SetCamActive(was.cam, false)
        DestroyCam(was.cam, false)
        if was.effect and not w.effect then ClearTimecycleModifier() end
    else
        w.screen = view.pause()
        FreezeEntityPosition(cache.ped, true)
        if not IsRadarHidden() then
            DisplayRadar(false)
            w.radar = true
        end
    end
    SetCamActive(cam, true)
    RenderScriptCams(true, false, 0, true, true)
    if w.effect then
        SetTimecycleModifier('scanline_cam_cheap')
        SetTimecycleModifierStrength(1.0)
    end
    current = w
    hold(w) -- (the one that held for the camera before this ends by itself)
    announce(w, c)
    cb({ ok = true })
end)

---NUI callback: turn, tip or zoom the camera, within what it can do.
---  dx, dy  how far the picture was dragged, as fractions of the display (drag it right and the
---          camera turns left, like sliding a photograph)
---  zoom    a factor to zoom by (above 1 = closer)
---  reset   back to how it was set up
---@param data { dx?: number, dy?: number, zoom?: number, reset?: boolean }
---@param cb function nui callback
RegisterNUICallback('computers:camera:control', function(data, cb)
    local w = current
    if not w or type(data) ~= 'table' then return cb({ ok = false }) end
    if data.reset == true then
        w.yaw, w.pitch, w.zoom = 0.0, 0.0, 1.0
    else
        local fov = w.fov0 / w.zoom
        w.yaw = clamp(w.yaw + (tonumber(data.dx) or 0.0) * fov * GetAspectRatio(false), -w.pan, w.pan)
        w.pitch = clamp(w.pitch + (tonumber(data.dy) or 0.0) * fov, -w.tilt, w.tilt)
        local factor = tonumber(data.zoom)
        if factor and factor > 0.0 then w.zoom = clamp(w.zoom * factor, 1.0, w.maxZoom) end
    end
    aim(w)
    cb({ ok = true, zoom = w.zoom })
end)

---NUI callback: back to the desktop.
---@param _ any unused nui data
---@param cb function nui callback
RegisterNUICallback('computers:camera:stop', function(_, cb)
    cameras.stop()
    cb({ ok = true })
end)

-- However the computer closes - shut down, walked away from, the server, a restart - the display
-- is handed back first.
state.onClose(cameras.stop)

---Whether a camera's picture is on the display.
---@return boolean
function cameras.isWatching() return current ~= nil end

return cameras
