---@type table Client computer state (client.computers.state): whether a computer is open.
local state = require 'client.computers.state'
---@type table The camera at the screen (client.computers.view): stepped away from while a camera is watched.
local view = require 'client.computers.view'

-- The Security Cameras app's picture. The game draws one view at a time, so watching a camera
-- means the game looks through it: its view goes to where the camera is, and the page draws that
-- view, live, inside the app's window (web/src/apps/cameras - a page can be handed the game's own
-- picture). What was on the display before - the room round the prop's screen - is kept as a still
-- by the page for as long as a camera is watched, so the player seems to stay at their desk; they
-- are held in their chair meanwhile, and the camera turns and zooms within the limits
-- configs/shared/cameras.lua gives it.
--
-- Which camera, and where it is, is the server's to say: the page only ever names one by id, and
-- this file asks the server for it the way every app action is asked (the guarded rpc), so a
-- camera the player may not watch from this computer never comes back at all.

---@type table Camera-view module; the table returned at end of file.
local cameras = {}

---@type table<string, string> A picture's look -> the game's own filter for it ('colour' and
---'none' have none: the page draws the scan lines). The name is the game's spelling.
local LOOKS = { cctv = 'CAMERA_secuirity' }
---@type integer Longest the world round a camera (or round the player, coming back) is waited for, ms.
local LOAD_MS = 2500
---@type integer Longest the page is waited for to say it has the still of the room, ms.
local FREEZE_MS = 700

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
---@field filter string the look of its picture ('cctv' | 'colour' | 'none')
---@field radar boolean the radar was showing and has been put away
---@field screen boolean the player was at a prop's screen (there is a camera there to go back to)

---@type WatchedCamera|nil The camera being watched (nil when none).
local current
---@type promise|nil Waiting for the page to say it has the still of the room.
local frozen
---@type boolean The page has been asked for that still, and not yet told the room is back.
local still = false
---@type integer Counts every ask to watch and every ask to stop. Both wait - for the server, for the
---world to load - and one that finds the count has moved on while it waited has been overtaken:
---it leaves everything to whoever came after it.
local asked = 0

local function clamp(v, lo, hi) return math.max(lo, math.min(hi, v)) end

---Point the camera where its turn and zoom have it.
---@param w WatchedCamera
local function aim(w)
    SetCamRot(w.cam, w.pitch0 + w.pitch, w.roll, w.yaw0 + w.yaw, 2)
    SetCamFov(w.cam, w.fov0 / w.zoom)
end

---Tell the page what the game is showing: a camera's picture (and whose), or the room again.
---@param w WatchedCamera|nil
---@param info? table { label, area } of the camera
local function announce(w, info)
    if not w then
        still = false
        SendNUIMessage({ action = 'computers:camera', data = { active = false } })
        return
    end
    SendNUIMessage({
        action = 'computers:camera',
        data = { active = true, id = w.id, label = info and info.label, area = info and info.area, zoom = w.zoom, maxZoom = w.maxZoom, filter = w.filter },
    })
end

---While a camera is watched: nothing of the game's own HUD in its picture.
---@param w WatchedCamera
local function hold(w)
    CreateThread(function()
        while current == w do
            HideHudAndRadarThisFrame()
            Wait(0)
        end
    end)
end

---Give the game's picture a look, or take it off.
---@param filter string|nil
local function look(filter)
    local name = filter and LOOKS[filter]
    if name then
        SetTimecycleModifier(name)
        SetTimecycleModifierStrength(1.0)
    else
        ClearTimecycleModifier()
    end
end

---Wait until the world round a point is there to be looked at (but not for long: a camera a long
---way off shows up while its last corners are still arriving).
---@param x number
---@param y number
---@param z number
---@param radius number
---@param mine integer the ask this is waited for: overtaken, the wait is over
local function loadAround(x, y, z, radius, mine)
    NewLoadSceneStartSphere(x, y, z, radius, 0)
    local t = GetGameTimer()
    while asked == mine and IsNewLoadSceneActive() and not IsNewLoadSceneLoaded() and GetGameTimer() - t < LOAD_MS do Wait(50) end
    if asked == mine then NewLoadSceneStop() end -- (whoever overtook this is loading somewhere of their own)
end

---Have the page keep a still of what is on the display right now - the room, round the prop's
---screen - before the game looks somewhere else. Waited for, but not for long: a page that does not
---answer only means the room is not covered.
local function freeze()
    local p = promise.new()
    frozen = p
    still = true
    SendNUIMessage({ action = 'computers:camera:freeze' })
    SetTimeout(FREEZE_MS, function()
        if frozen == p then
            frozen = nil
            p:resolve(false)
        end
    end)
    Citizen.Await(p)
end

---NUI callback: the page has the still.
RegisterNUICallback('computers:camera:frozen', function(_, cb)
    cb({ ok = true })
    local p = frozen
    frozen = nil
    if p then p:resolve(true) end
end)

---Stop watching: the camera goes, the world round the player loads again and the view returns to
---the prop's screen (or to the player, where the computer is fullscreen). The page is told last, so
---its still of the room is only taken away once the room is really back. Idempotent.
---@param now? boolean at once, with no waiting for the room: the computer is closing under the camera
function cameras.stop(now)
    asked = asked + 1
    local mine = asked
    local w = current
    if not w then
        -- (nothing was up yet - but a camera on its way has just been called off, and the page may
        -- already be holding the still for it)
        if still then announce(nil) end
        return
    end
    current = nil
    look(nil)
    ClearFocus()
    SetCamActive(w.cam, false)
    DestroyCam(w.cam, false)
    if not view.resume() then RenderScriptCams(false, false, 0, true, true) end
    if w.radar then DisplayRadar(true) end
    if not now then
        local ped = cache.ped
        local at = GetEntityCoords(ped)
        loadAround(at.x, at.y, at.z, 40.0, mine)
        -- (the floor under the player may have gone while the game looked elsewhere: they are held
        -- until it is back)
        local t = GetGameTimer()
        while asked == mine and not HasCollisionLoadedAroundEntity(ped) and GetGameTimer() - t < LOAD_MS do Wait(50) end
        if asked ~= mine then return end -- (another camera was picked meanwhile: the chair and the still are its now)
    end
    FreezeEntityPosition(cache.ped, false)
    announce(nil)
end

---NUI callback: watch a camera (or, already watching one, switch to another). Replies once its
---picture is up and the world round it has loaded.
---@param data { id: string }
---@param cb function nui callback
RegisterNUICallback('computers:camera:start', function(data, cb)
    if not state.isOpen() or type(data) ~= 'table' or type(data.id) ~= 'string' then return cb({ ok = false }) end
    asked = asked + 1
    local mine = asked
    local res = lib.callback.await('sd-computers:server:rpc', false, 'cameras:watch', { id = data.id })
    -- (stopped, the computer closed or another camera picked while the server was asked)
    if asked ~= mine then return cb({ ok = false, overtaken = true }) end
    if not res or not res.ok or type(res.data) ~= 'table' then
        return cb({ ok = false, error = res and res.error or locale('err.internal') })
    end

    local c = res.data
    if not current then
        freeze()
        if asked ~= mine then return cb({ ok = false, overtaken = true }) end
    end

    local was = current
    local cam = CreateCamWithParams('DEFAULT_SCRIPTED_CAMERA', c.x, c.y, c.z, c.pitch, c.roll, c.yaw, c.fov, false, 2)
    -- The world loads round wherever the game is asked to look; the player is somewhere else
    -- entirely, so they are held where they sit while the ground under them may not be there.
    SetFocusPosAndVel(c.x, c.y, c.z, 0.0, 0.0, 0.0)
    local w = {
        cam = cam, id = c.id, pitch0 = c.pitch, roll = c.roll, yaw0 = c.yaw, fov0 = c.fov,
        yaw = 0.0, pitch = 0.0, zoom = 1.0,
        pan = tonumber(c.pan) or 60.0, tilt = tonumber(c.tilt) or 25.0, maxZoom = math.max(1.0, tonumber(c.zoom) or 3.0),
        filter = type(c.filter) == 'string' and c.filter or 'cctv', radar = false, screen = false,
    }
    if was then
        -- (switching: the same chair, the same put-away radar - only the camera changes)
        w.radar, w.screen = was.radar, was.screen
        SetCamActive(was.cam, false)
        DestroyCam(was.cam, false)
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
    look(w.filter)
    current = w
    hold(w) -- (the one that held for the camera before this ends by itself)

    -- The page shows "connecting" until this replies: the picture is not handed over half-loaded.
    loadAround(c.x, c.y, c.z, 60.0, mine)
    if asked ~= mine then return cb({ ok = false, overtaken = true }) end
    announce(w, c)
    cb({ ok = true })
end)

---NUI callback: turn, tip or zoom the camera, within what it can do.
---  dx, dy  how far the picture was dragged, as fractions of the picture (drag it right and the
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

---NUI callback: stop watching. Replies once the room is back.
---@param _ any unused nui data
---@param cb function nui callback
RegisterNUICallback('computers:camera:stop', function(_, cb)
    cameras.stop()
    cb({ ok = true })
end)

-- However the computer closes - shut down, walked away from, the server, a restart - the display
-- is handed back first, and at once.
state.onClose(function() cameras.stop(true) end)

---Whether a camera's picture is on the display.
---@return boolean
function cameras.isWatching() return current ~= nil end

return cameras
