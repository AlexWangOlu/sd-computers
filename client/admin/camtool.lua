-- Putting a security camera up, or aiming one again: the admin flies a free camera to where it
-- should hang and looks the way it should look. What is on the display IS what the camera will
-- show, zoom and all - so there is nothing to imagine, and Enter keeps exactly that. What comes
-- back is where it is and the way it faces; the server keeps it (server/computers/cameras.lua).

---@type table Camera-tool module; the table returned at end of file.
local camtool = {}

---@type number Metres a second the camera flies at (Shift = FAST times that, Alt = SLOW times it).
local SPEED = 4.0
local FAST, SLOW = 5.0, 0.2
---@type number Degrees the view turns for a full push of the mouse, at a 60 degree field of view.
local LOOK = 8.0
---@type number Degrees one wheel notch narrows or widens the view by.
local FOV_STEP = 2.5
---@type number What a camera can be set to see: the same range the server keeps (cameras.lua > specOf).
local FOV_MIN, FOV_MAX = 10.0, 110.0
---@type number How far it tips: short of straight up or down.
local PITCH_MAX = 89.0
---@type integer ms between HUD updates while nothing but the position changes.
local HUD_MS = 150

---@type boolean
local active = false
---@type promise|nil
local pending
---@type fun(action: string, data: table)|nil
local hudPush
---@type integer|nil the scripted camera
local cam

---Controls (group 0) read by the loop. Every control is held off while the tool runs, so these are
---read as disabled controls.
local K = {
    lookLR = 1, lookUD = 2,
    forward = 32, back = 33, left = 34, right = 35,
    up = 22, upAlt = 38, down = 36, downAlt = 44, -- Space / E, Ctrl / Q
    fast = 21, slow = 19, -- Shift, Alt
    zoomIn = 15, zoomOut = 14, -- wheel up, wheel down
    enter = 191, back2 = 194, pause = 200, pauseAlt = 322,
}

local function clamp(v, lo, hi) return math.max(lo, math.min(hi, v)) end

---End the tool: give the view and the world back, hide the HUD and resolve the waiting start()
---call. Idempotent.
---@param result table|nil { x, y, z, pitch, yaw, fov }, or nil when cancelled
local function finish(result)
    if not active then return end
    active = false
    if cam then
        RenderScriptCams(false, false, 0, true, true)
        SetCamActive(cam, false)
        DestroyCam(cam, false)
        cam = nil
    end
    ClearFocus()
    FreezeEntityPosition(cache.ped, false)
    if hudPush then hudPush('computers:camtool:hud', { active = false }) end
    local p = pending
    pending = nil
    if p then p:resolve(result) end
end

---Start the per-frame loop: flies the camera, and keeps or cancels it.
---@param at vector3 where it starts
---@param pitch number
---@param yaw number
---@param fov number
---@param moving boolean aiming one that is up already (the HUD says so)
local function loop(at, pitch, yaw, fov, moving)
    CreateThread(function()
        local started = GetGameTimer()
        local lastHud, lastFov = 0, nil
        cam = CreateCamWithParams('DEFAULT_SCRIPTED_CAMERA', at.x, at.y, at.z, pitch, 0.0, yaw, fov, false, 2)
        SetCamActive(cam, true)
        RenderScriptCams(true, false, 0, true, true)
        -- (the admin stays where they stood: the camera may fly anywhere, and the world loads round it)
        FreezeEntityPosition(cache.ped, true)

        while active do
            DisableAllControlActions(0)
            HideHudAndRadarThisFrame()

            -- Looking: slower the further it is zoomed in, so a narrow view can still be aimed.
            local turn = LOOK * (fov / 60.0)
            yaw = yaw - GetDisabledControlNormal(0, K.lookLR) * turn
            pitch = clamp(pitch - GetDisabledControlNormal(0, K.lookUD) * turn, -PITCH_MAX, PITCH_MAX)

            -- Flying: forward is where it looks, sideways is level, up and down are the world's.
            local ry, rp = math.rad(yaw), math.rad(pitch)
            local forward = vector3(-math.sin(ry) * math.cos(rp), math.cos(ry) * math.cos(rp), math.sin(rp))
            local right = vector3(math.cos(ry), math.sin(ry), 0.0)
            local move = vector3(0.0, 0.0, 0.0)
            if IsDisabledControlPressed(0, K.forward) then move = move + forward end
            if IsDisabledControlPressed(0, K.back) then move = move - forward end
            if IsDisabledControlPressed(0, K.right) then move = move + right end
            if IsDisabledControlPressed(0, K.left) then move = move - right end
            if IsDisabledControlPressed(0, K.up) or IsDisabledControlPressed(0, K.upAlt) then move = move + vector3(0.0, 0.0, 1.0) end
            if IsDisabledControlPressed(0, K.down) or IsDisabledControlPressed(0, K.downAlt) then move = move - vector3(0.0, 0.0, 1.0) end
            if #move > 0.001 then
                local speed = SPEED * (IsDisabledControlPressed(0, K.fast) and FAST or 1.0) * (IsDisabledControlPressed(0, K.slow) and SLOW or 1.0)
                at = at + (move / #move) * speed * GetFrameTime()
            end

            if IsDisabledControlJustPressed(0, K.zoomIn) then fov = clamp(fov - FOV_STEP, FOV_MIN, FOV_MAX) end
            if IsDisabledControlJustPressed(0, K.zoomOut) then fov = clamp(fov + FOV_STEP, FOV_MIN, FOV_MAX) end

            SetCamCoord(cam, at.x, at.y, at.z)
            SetCamRot(cam, pitch, 0.0, yaw, 2)
            SetCamFov(cam, fov)
            SetFocusPosAndVel(at.x, at.y, at.z, 0.0, 0.0, 0.0)

            local now = GetGameTimer()
            if hudPush and (fov ~= lastFov or now - lastHud > HUD_MS) then
                lastHud, lastFov = now, fov
                hudPush('computers:camtool:hud', { active = true, moving = moving, x = at.x, y = at.y, z = at.z, pitch = pitch, yaw = yaw, fov = fov })
            end

            if IsDisabledControlJustPressed(0, K.enter) then
                -- (not the press that started this: the panel's button was let go a moment ago)
                if now - started > 300 then
                    finish({ x = at.x, y = at.y, z = at.z, pitch = pitch, yaw = yaw, fov = fov })
                    return
                end
            elseif IsDisabledControlJustPressed(0, K.back2) or IsDisabledControlJustPressed(0, K.pause) or IsDisabledControlJustPressed(0, K.pauseAlt) then
                finish(nil)
                return
            end
            Wait(0)
        end
    end)
end

---Fly a camera and block the calling thread until the admin keeps it or cancels.
---@param from table|nil { x, y, z, pitch, yaw, fov } a camera that is up already, to aim again; nil
---starts from the admin's own view
---@return table|nil|false result { x, y, z, pitch, yaw, fov }; nil when cancelled, false when refused
---@return string|nil errKey
function camtool.start(from)
    if active then return false, 'admin.busy' end
    local at, pitch, yaw, fov
    if type(from) == 'table' and tonumber(from.x) and tonumber(from.y) and tonumber(from.z) then
        at = vector3(from.x + 0.0, from.y + 0.0, from.z + 0.0)
        pitch, yaw, fov = tonumber(from.pitch) or 0.0, tonumber(from.yaw) or 0.0, tonumber(from.fov) or 60.0
    else
        local rot = GetGameplayCamRot(2)
        at, pitch, yaw, fov = GetGameplayCamCoord(), rot.x, rot.z, 60.0
    end
    active = true
    pending = promise.new()
    loop(at, clamp(pitch, -PITCH_MAX, PITCH_MAX), yaw, clamp(fov, FOV_MIN, FOV_MAX), from ~= nil)
    return Citizen.Await(pending)
end

---Cancel the running tool; the waiting start() call returns nil.
function camtool.cancel() finish(nil) end

---Whether the tool is running.
---@return boolean
function camtool.isActive() return active end

---Set the callback that receives the tool's HUD updates (the admin panel wires it to its NUI).
---@param fn fun(action: string, data: table)
function camtool.setHud(fn) hudPush = fn end

---Give the view back when this resource stops.
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    finish(nil)
end)

return camtool
