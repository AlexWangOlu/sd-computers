---@type table The prop models known as a computer (shared.props): what may be picked.
local props = require 'shared.props'

-- Picking a prop the game already has in the world, to make it a computer of its own: the admin
-- walks about and looks at a monitor or laptop, the one under the crosshair is boxed, and
-- Enter (or a click) takes it. Nothing is spawned or moved - what comes back is which model it is
-- and where it stands, and the server keeps that (server/computers/placed.lua).

---@type table Picker module; the table returned at end of file.
local picker = {}

---@type number Metres ahead of the camera a prop can be picked from.
local REACH = 12.0
---@type number Metres from where the admin is looking a prop is still the one meant: monitors are thin.
local SNAP = 0.6
---@type integer ms between looks for the props around.
local SCAN_MS = 400

---@type boolean
local active = false
---@type promise|nil
local pending
---@type fun(action: string, data: table)|nil
local hudPush
---@type integer|nil the prop boxed right now
local outlined

---Controls (group 0) read by the loop.
local C = { enter = 191, click = 24, back = 194, pause = 200, pauseAlt = 322 }
---@type integer[] Held off every frame so picking never shoots, swaps weapons or opens the pause menu.
---Movement and the camera stay live: the admin walks up to what they want.
local BLOCKED = { 24, 25, 37, 44, 45, 140, 141, 142, 191, 194, 199, 200, 257, 263, 264, 322 }

local COL = { ok = { 237, 237, 239 }, taken = { 245, 170, 60 } }
---@type integer[][] The twelve edges of a box, by corner.
local EDGES = { { 1, 2 }, { 2, 3 }, { 3, 4 }, { 4, 1 }, { 5, 6 }, { 6, 7 }, { 7, 8 }, { 8, 5 }, { 1, 5 }, { 2, 6 }, { 3, 7 }, { 4, 8 } }
---@type integer[][] Its six faces, by corner.
local FACES = { { 1, 2, 3, 4 }, { 5, 6, 7, 8 }, { 1, 2, 6, 5 }, { 2, 3, 7, 6 }, { 3, 4, 8, 7 }, { 4, 1, 5, 8 } }

---Unit direction a camera rotation looks along.
---@param rot vector3 rotation in degrees (pitch x, heading z)
---@return vector3
local function rotToDir(rot)
    local rz, rx = math.rad(rot.z), math.rad(rot.x)
    local flat = math.abs(math.cos(rx))
    return vector3(-math.sin(rz) * flat, math.cos(rz) * flat, math.sin(rx))
end

---What the camera is looking at: the point, and the prop when it is one.
---@return vector3|nil at
---@return integer|nil entity
local function aim()
    local ro = GetFinalRenderedCamCoord()
    local to = ro + rotToDir(GetFinalRenderedCamRot(2)) * REACH
    local _, hit, at, _, entity = GetShapeTestResult(StartExpensiveSynchronousShapeTestLosProbe(ro.x, ro.y, ro.z, to.x, to.y, to.z, 1 + 16, cache.ped, 4))
    if hit ~= 1 then return nil, nil end
    return at, (entity and entity ~= 0 and GetEntityType(entity) == 3) and entity or nil
end

---Box a prop: its edges, and its faces faintly, so it reads from across a room.
---@param entity integer
---@param col integer[] { r, g, b }
local function box(entity, col)
    local mn, mx = GetModelDimensions(GetEntityModel(entity))
    local c = {}
    for i, v in ipairs({
        vector3(mn.x, mn.y, mn.z), vector3(mx.x, mn.y, mn.z), vector3(mx.x, mx.y, mn.z), vector3(mn.x, mx.y, mn.z),
        vector3(mn.x, mn.y, mx.z), vector3(mx.x, mn.y, mx.z), vector3(mx.x, mx.y, mx.z), vector3(mn.x, mx.y, mx.z),
    }) do c[i] = GetOffsetFromEntityInWorldCoords(entity, v.x, v.y, v.z) end
    for _, e in ipairs(EDGES) do
        local a, b = c[e[1]], c[e[2]]
        DrawLine(a.x, a.y, a.z, b.x, b.y, b.z, col[1], col[2], col[3], 255)
    end
    for _, f in ipairs(FACES) do
        local p, q, r, s = c[f[1]], c[f[2]], c[f[3]], c[f[4]]
        -- (both windings: a face shows from either side)
        DrawPoly(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z, col[1], col[2], col[3], 28)
        DrawPoly(r.x, r.y, r.z, q.x, q.y, q.z, p.x, p.y, p.z, col[1], col[2], col[3], 28)
        DrawPoly(p.x, p.y, p.z, r.x, r.y, r.z, s.x, s.y, s.z, col[1], col[2], col[3], 28)
        DrawPoly(s.x, s.y, s.z, r.x, r.y, r.z, p.x, p.y, p.z, col[1], col[2], col[3], 28)
    end
end

---Outline one prop (or none), taking the outline off the last.
---@param entity integer|nil
local function outline(entity)
    if outlined == entity then return end
    if outlined and DoesEntityExist(outlined) then SetEntityDrawOutline(outlined, false) end
    outlined = entity
    if entity then SetEntityDrawOutline(entity, true) end
end

---End picking: take the outline off, hide the HUD and resolve the waiting start() call. Idempotent.
---@param result table|nil what was picked, or nil when cancelled
local function finish(result)
    if not active then return end
    active = false
    outline(nil)
    if hudPush then hudPush('computers:picker:hud', { active = false }) end
    local p = pending
    pending = nil
    if p then p:resolve(result) end
end

---Start the per-frame loop: finds the prop under the crosshair, boxes it and confirms or cancels.
---@param taken fun(entity: integer): boolean whether a prop is a picked or placed computer already
---@param set { byHash: table<integer, string>, label: fun(model: string): string } the models that can be picked
local function loop(taken, set)
    CreateThread(function()
        local near, scanned = {}, 0
        local lastHud, lastKey = 0, nil
        local started = GetGameTimer()
        SetEntityDrawOutlineShader(1)
        while active do
            for _, c in ipairs(BLOCKED) do DisableControlAction(0, c, true) end
            DisablePlayerFiring(cache.playerId, true)

            -- The props around that could be picked, looked for a few times a second.
            local now = GetGameTimer()
            if now - scanned > SCAN_MS then
                scanned = now
                local origin = GetEntityCoords(cache.ped)
                near = {}
                for _, entity in ipairs(GetGamePool('CObject')) do
                    if set.byHash[GetEntityModel(entity)] and #(GetEntityCoords(entity) - origin) <= REACH + 4.0 then near[#near + 1] = entity end
                end
            end

            -- The one meant: the prop looked at, or the nearest one to the point looked at.
            local at, hit = aim()
            local found
            if hit and set.byHash[GetEntityModel(hit)] then
                found = hit
            elseif at then
                local best
                for _, entity in ipairs(near) do
                    if DoesEntityExist(entity) then
                        local d = #(GetEntityCoords(entity) - at)
                        if d <= SNAP and (not best or d < best) then found, best = entity, d end
                    end
                end
            end

            local model = found and set.byHash[GetEntityModel(found)] or nil
            local isTaken = found ~= nil and taken(found)
            if found then
                local col = isTaken and COL.taken or COL.ok
                SetEntityDrawOutlineColor(col[1], col[2], col[3], 255)
                box(found, col)
            end
            outline(found)

            local key = ('%s:%s'):format(tostring(found), tostring(isTaken))
            if hudPush and (key ~= lastKey or now - lastHud > 500) then
                lastKey, lastHud = key, now
                hudPush('computers:picker:hud', {
                    active = true, state = not found and 'none' or (isTaken and 'taken' or 'ok'),
                    model = model, label = model and set.label(model) or nil, what = set.what,
                })
            end

            if IsDisabledControlJustPressed(0, C.enter) or IsDisabledControlJustPressed(0, C.click) then
                -- (not the click that started this: the panel's button was let go a moment ago)
                if found and not isTaken and now - started > 300 then
                    local c = GetEntityCoords(found)
                    finish({ model = model, x = c.x, y = c.y, z = c.z, heading = GetEntityHeading(found) })
                    return
                end
            elseif IsDisabledControlJustPressed(0, C.back) or IsDisabledControlJustPressed(0, C.pause) or IsDisabledControlJustPressed(0, C.pauseAlt) then
                finish(nil)
                return
            end
            Wait(0)
        end
    end)
end

---Begin picking and block the calling thread until the admin takes a prop or cancels.
---@param taken fun(entity: integer): boolean whether a prop is a computer of its own already
---@param set? { byHash: table<integer, string>, label: fun(model: string): string } the models that can be picked (the computers' unless said: a printer is picked the same way)
---@return table|nil|false result { model, x, y, z, heading }; nil when cancelled, false when refused
---@return string|nil errKey
function picker.start(taken, set)
    if active then return false, 'admin.busy' end
    active = true
    pending = promise.new()
    loop(taken, set or props)
    return Citizen.Await(pending)
end

---Cancel the running pick; the waiting start() call returns nil.
function picker.cancel() finish(nil) end

---Whether a pick is running.
---@return boolean
function picker.isActive() return active end

---Set the callback that receives picker HUD updates (the admin panel wires it to its NUI).
---@param fn fun(action: string, data: table)
function picker.setHud(fn) hudPush = fn end

---Take the outline off whatever is boxed when this resource stops.
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    finish(nil)
end)

return picker
