---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'

---@type table Admin/placement tuning (configs/shared/admin.lua).
local CFG = config.Admin
---@type table Gizmo tuning (configs/shared/admin.lua > Placement).
local P = CFG.Placement or {}

-- The same creator sd-bombs and sd-scooters place with, carried over apart from names and from where a
-- new placement starts (startSpot): one placement tool across the server, so admins learn one set of keys.

---Placement with the game's own editor gizmo (the one object_gizmo uses). A translucent copy of the
---whole assembly (the root model plus any extra parts built with it) is previewed; the gizmo sits
---at the centre of that assembly, so the arrows and rings always wrap the full object and draw on top
---of it. The admin keeps walking and looking around; G switches the cursor on and off. Only the
---heading is kept from rotation, so whatever is placed stays upright. Every part is positioned from the root each
---frame the way the real props are built, so what is previewed is what gets placed.
local placer = {}

local SNAP_MOVE = P.SnapMove or 0.25
local SNAP_TURN = P.SnapTurn or 15.0
local NUDGE = P.Nudge or 0.05
local TURN_STEP = P.TurnStep or 5.0
local FLOAT_WARN = 0.15

---@type boolean
local active = false
---@type integer|nil root ghost
local ghost
---@type { ent: integer, offset: vector3 }[]
local parts = {}
---@type table|nil { x, y, z, heading } of the root origin, as the gizmo leaves it (unsnapped)
local draft
---@type table|nil { min = vector3, max = vector3 } in the root's space
local bounds
---@type promise|nil
local pending
---@type table
local ui = {}
---@type fun(action: string, data: table)|nil
local hudPush
---@type fun(t: table): string[]|nil
local warnFn
---@type fun(t: table)|nil called every frame with the transform shown (a caller's own overlay)
local frameFn
---@type vector3|nil the root's own turn in the assembly's space (pitch, roll, yaw; rotation order 2). nil = upright,
---like everything placed here.
local rootRot

---Controls (group 0) read by the loop. The gizmo's own inputs (select, translate, rotate, local) are
---key mappings further down, because the native gizmo only listens to its +gizmo* commands.
local C = {
    enter = 191, back = 177, pause = 200, pauseAlt = 322,
    wheelUp = 15, wheelDown = 14, shift = 21, ctrl = 36,

    cursor = 47, drop = 19, snap = 73, stick = 245,
    undo = 20, redo = 246,
    up = 172, down = 173, left = 174, right = 175, pageUp = 10, pageDown = 11,
}
---@type integer[] Held off every frame so placing never shoots, swaps weapons, opens chat or the pause
---menu. Movement stays live: the admin walks around while placing.
local BLOCKED = {
    10, 11, 14, 15, 16, 17, 19, 20, 24, 25, 36, 37, 44, 45, 47, 73, 99, 100, 115, 116,
    140, 141, 142, 172, 173, 174, 175, 199, 200, 238, 241, 242, 245, 246, 257, 263, 264, 322, 331,
}

local COL = { box = { 237, 237, 239 }, warn = { 245, 170, 60 } }

---Math

---Clamp a number into a range.
---@param v number
---@param lo number
---@param hi number
---@return number
local function clamp(v, lo, hi) return math.max(lo, math.min(hi, v)) end
---Round a number to the nearest multiple of a step.
---@param v number
---@param step number
---@return number
local function snapTo(v, step) return math.floor(v / step + 0.5) * step end
---Wrap an angle into -180..180 degrees, so a turn reads as the short way round.
---@param a number degrees
---@return number
local function wrap180(a) return (a + 540.0) % 360.0 - 180.0 end

---Unit direction a camera rotation looks along.
---@param rot vector3 rotation in degrees (pitch x, heading z)
---@return vector3
local function rotToDir(rot)
    local rz, rx = math.rad(rot.z), math.rad(rot.x)
    local flat = math.abs(math.cos(rx))
    return vector3(-math.sin(rz) * flat, math.cos(rz) * flat, math.sin(rx))
end

---Local axes for a heading: right (+X), forward (+Y).
local function axes(heading)
    local r = math.rad(heading)
    local c, s = math.cos(r), math.sin(r)
    return vector3(c, s, 0.0), vector3(-s, c, 0.0)
end

---Transform a point from the root's local space into world space.
---@param t table transform { x, y, z, heading }
---@param v vector3 local offset
---@return vector3
local function toWorld(t, v)
    local R, F = axes(t.heading)
    return vector3(t.x, t.y, t.z) + R * v.x + F * v.y + vector3(0.0, 0.0, v.z)
end

---Nearest world surface along a ray (ghosts have no collision, the player is ignored).
local function surfaceHit(ro, rd, reach)
    local to = ro + rd * (reach or 400.0)
    local _, hit, at = GetShapeTestResult(StartExpensiveSynchronousShapeTestLosProbe(ro.x, ro.y, ro.z, to.x, to.y, to.z, 1 + 16, cache.ped, 4))
    return hit == 1 and at or nil
end

---Ground height under a point, or nil.
local function groundAt(x, y, fromZ)
    local found, z = GetGroundZFor_3dCoord(x, y, fromZ + 2.0, false)
    if found then return z end
    local hit = surfaceHit(vector3(x, y, fromZ + 2.0), vector3(0.0, 0.0, -1.0), 60.0)
    return hit and hit.z or nil
end

---Assembly

---Centre of the footprint at the base: the point everything turns around and sits on the ground by.
local function pivot(t)
    return toWorld(t or draft, vector3((bounds.min.x + bounds.max.x) * 0.5, (bounds.min.y + bounds.max.y) * 0.5, bounds.min.z))
end

---Middle of the whole assembly in the root's space: where the gizmo sits.
local function centreLocal()
    return vector3((bounds.min.x + bounds.max.x) * 0.5, (bounds.min.y + bounds.max.y) * 0.5, (bounds.min.z + bounds.max.z) * 0.5)
end

---Copy a transform (the draft by default) so later edits do not change the copy.
---@param t table|nil transform
---@return table { x, y, z, heading }
local function snapshot(t)
    t = t or draft
    return { x = t.x, y = t.y, z = t.z, heading = t.heading }
end

---Turn a transform about its footprint pivot rather than the model origin, so the assembly spins in place.
---@param t table transform, changed in place
---@param degrees number
local function turnAround(t, degrees)
    local before = pivot(t)
    t.heading = (t.heading + degrees) % 360.0
    local after = pivot(t)
    t.x, t.y = t.x + (before.x - after.x), t.y + (before.y - after.y)
end

---Turn the draft about its footprint pivot.
---@param degrees number
local function turnBy(degrees) turnAround(draft, degrees) end

---What is shown and placed: the draft, or the draft on the snap grid (heading steps, and the footprint
---centre on a world grid). The gizmo keeps working on the raw draft so small drags still add up.
local function placed()
    if not ui.snap then return snapshot() end
    local t = snapshot()
    turnAround(t, snapTo(t.heading, SNAP_TURN) - t.heading)
    local piv = pivot(t)
    t.x, t.y = t.x + (snapTo(piv.x, SNAP_MOVE) - piv.x), t.y + (snapTo(piv.y, SNAP_MOVE) - piv.y)
    return t
end

---Move the root ghost and every part ghost to a transform, keeping them upright (or as the root is turned: rootRot).
---@param t table transform
local function apply(t)
    SetEntityCoordsNoOffset(ghost, t.x, t.y, t.z, false, false, false)
    local rr = rootRot
    SetEntityRotation(ghost, rr and rr.x or 0.0, rr and rr.y or 0.0, t.heading + (rr and rr.z or 0.0), 2, true)
    for _, p in ipairs(parts) do
        local at = toWorld(t, p.offset)
        SetEntityCoordsNoOffset(p.ent, at.x, at.y, at.z, false, false, false)
        -- (a part may be turned in the root's space)
        local r = p.rot
        SetEntityRotation(p.ent, r and r.x or 0.0, r and r.y or 0.0, t.heading + (r and r.z or 0.0), 2, true)
    end
end

---Remember the transform before a change so Ctrl+Z can bring it back.
local function remember()
    local last = ui.history[#ui.history]
    local now = snapshot()
    if last and last.x == now.x and last.y == now.y and last.z == now.z and last.heading == now.heading then return end
    ui.history[#ui.history + 1] = now
    if #ui.history > 60 then table.remove(ui.history, 1) end
    ui.future = {}
end

---Write a saved transform back into the draft (undo, redo and drag cancel).
---@param t table transform
local function restore(t)
    draft.x, draft.y, draft.z, draft.heading = t.x, t.y, t.z, t.heading
end

---Metres between ground probes across the footprint.
local GROUND_STEP = 0.5

---@type table|nil { key, top, low } the last footprint probe, reused while the transform is unchanged
local groundCache

---Highest and lowest ground under the whole footprint, probed on a grid (corners included). A long prop can be
---several metres wide, so on a camber the ground under its ends differs from the centre by more than
---its base; judging by the centre alone buries the ends.
---@param t table transform
---@return number|nil top, number|nil low
local function footprintGround(t)
    local key = ('%.3f:%.3f:%.3f:%.2f'):format(t.x, t.y, t.z, t.heading)
    if groundCache and groundCache.key == key then return groundCache.top, groundCache.low end
    local mn, mx = bounds.min, bounds.max
    local cols = clamp(math.ceil((mx.x - mn.x) / GROUND_STEP), 1, 12)
    local rows = clamp(math.ceil((mx.y - mn.y) / GROUND_STEP), 1, 4)
    local from = pivot(t).z + 1.0
    local top, low
    for i = 0, cols do
        for j = 0, rows do
            local p = toWorld(t, vector3(mn.x + (mx.x - mn.x) * i / cols, mn.y + (mx.y - mn.y) * j / rows, mn.z))
            local g = groundAt(p.x, p.y, from)
            if g then
                top = top and math.max(top, g) or g
                low = low and math.min(low, g) or g
            end
        end
    end
    groundCache = top and { key = key, top = top, low = low } or nil
    return top, low
end

---Sit the base on the highest ground under the footprint, so no part of the assembly ends up buried.
local function dropToGround()
    local top = footprintGround(draft)
    if top then draft.z = top - bounds.min.z end
end

---Make a preview entity a ghost: no collision, frozen, invincible, translucent and outlined.
---@param ent integer
local function ghostify(ent)
    SetEntityCollision(ent, false, false)
    FreezeEntityPosition(ent, true)
    SetEntityInvincible(ent, true)
    SetEntityAlpha(ent, 200, false)
    SetEntityNoCollisionEntity(ent, cache.ped, true)
    SetEntityCanBeDamaged(ent, false)
    SetEntityDrawOutline(ent, true)
end

---A point in a model's space as the model is turned (pitch x, roll y, yaw z; GTA's rotation order 2: roll, then pitch,
---then yaw).
---@param v vector3
---@param rot vector3 degrees
---@return vector3
local function turned(v, rot)
    local p, r, y = math.rad(rot.x), math.rad(rot.y), math.rad(rot.z)
    local x1, z1 = v.x * math.cos(r) + v.z * math.sin(r), -v.x * math.sin(r) + v.z * math.cos(r)
    local y2, z2 = v.y * math.cos(p) - z1 * math.sin(p), v.y * math.sin(p) + z1 * math.cos(p)
    return vector3(x1 * math.cos(y) - y2 * math.sin(y), x1 * math.sin(y) + y2 * math.cos(y), z2)
end

---Grow the assembly bounds to include a model's dimensions at an offset in the root's space - boxed as it lies when it
---is turned (rot).
---@param hash integer model hash
---@param offset vector3
---@param rot vector3|nil
local function extend(hash, offset, rot)
    local mn, mx = GetModelDimensions(hash)
    local lo = vector3(mn.x + offset.x, mn.y + offset.y, mn.z + offset.z)
    local hi = vector3(mx.x + offset.x, mx.y + offset.y, mx.z + offset.z)
    if rot then
        lo, hi = nil, nil
        for _, x in ipairs({ mn.x, mx.x }) do
            for _, y in ipairs({ mn.y, mx.y }) do
                for _, z in ipairs({ mn.z, mx.z }) do
                    local p = turned(vector3(x, y, z), rot) + offset
                    lo = lo and vector3(math.min(lo.x, p.x), math.min(lo.y, p.y), math.min(lo.z, p.z)) or p
                    hi = hi and vector3(math.max(hi.x, p.x), math.max(hi.y, p.y), math.max(hi.z, p.z)) or p
                end
            end
        end
    end
    if not bounds then
        bounds = { min = lo, max = hi }
    else
        bounds.min = vector3(math.min(bounds.min.x, lo.x), math.min(bounds.min.y, lo.y), math.min(bounds.min.z, lo.z))
        bounds.max = vector3(math.max(bounds.max.x, hi.x), math.max(bounds.max.y, hi.y), math.max(bounds.max.z, hi.z))
    end
end

---Native gizmo

local MATRIX = '<ffffffffffffffff'

---Column matrix at the assembly centre: right, forward, up, position (the layout DrawGizmo expects).
local function gizmoMatrix()
    local R, F = axes(draft.heading)
    local c = toWorld(draft, centreLocal())
    local buf = string.blob(64)
    return buf:blob_pack(1, MATRIX,
        R.x, R.y, R.z, 0.0,
        F.x, F.y, F.z, 0.0,
        0.0, 0.0, 1.0, 0.0,
        c.x, c.y, c.z, 1.0)
end

---Run the gizmo for this frame and fold whatever it changed back into the draft (position and heading
---only; pitch and roll from the rotate rings are dropped so the assembly stays upright).
---@return boolean changed
local function gizmoFrame()
    local buf = gizmoMatrix()
    local changed = Citizen.InvokeNative(0xEB2EDCA2, buf, 'sd_computers_placer', Citizen.ReturnResultAnyway())
    if not changed then return false end
    local m = { buf:blob_unpack(1, MATRIX) }
    local fx, fy = m[5], m[6]
    local heading = draft.heading
    if math.abs(fx) + math.abs(fy) > 1e-4 then heading = math.deg(math.atan(-fx, fy)) % 360.0 end
    local before = snapshot()
    local cl = centreLocal()
    local R, F = axes(heading)
    local off = R * cl.x + F * cl.y
    draft.heading = heading
    draft.x, draft.y, draft.z = m[13] - off.x, m[14] - off.y, m[15] - cl.z
    local dz = draft.z - before.z
    if math.abs(dz) > 1e-4 and math.abs(draft.x - before.x) + math.abs(draft.y - before.y) < 1e-4 then ui.stick = false end
    return true
end

---Tap a +/- key-mapping command once, the way the native gizmo expects its inputs.
---@param name string command name without the sign
local function command(name)
    ExecuteCommand('+' .. name)
    ExecuteCommand('-' .. name)
end

---Enter or leave cursor mode, skipping the native call when the state is unchanged.
---@param on boolean
local function setCursor(on)
    local shown = ui.cursor and not ui.looking -- (looking about: the cursor is on, but out of the way)
    ui.cursor, ui.looking = on, false
    if on == shown then return end
    if on then EnterCursorMode() else LeaveCursorMode() end
end

---Hold the right button to look about: the cursor goes while it is held and comes back on release.
---@param held boolean
local function lookAround(held)
    if held == (ui.looking == true) or not ui.cursor or ui.drag then return end
    ui.looking = held
    if held then LeaveCursorMode() else EnterCursorMode() end
end

---Drawing

---Draw a world-space line.
---@param a vector3
---@param b vector3
---@param c integer[] { r, g, b }
---@param alpha integer|nil defaults to 255
local function line(a, b, c, alpha) DrawLine(a.x, a.y, a.z, b.x, b.y, b.z, c[1], c[2], c[3], alpha or 255) end

---Draw a double-sided triangle, so it shows from above and below.
---@param a vector3
---@param b vector3
---@param c vector3
---@param col integer[] { r, g, b }
---@param alpha integer
local function tri(a, b, c, col, alpha)
    DrawPoly(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, col[1], col[2], col[3], alpha)
    DrawPoly(c.x, c.y, c.z, b.x, b.y, b.z, a.x, a.y, a.z, col[1], col[2], col[3], alpha)
end

---Draw a double-sided quad from two triangles.
---@param a vector3
---@param b vector3
---@param c vector3
---@param d vector3
---@param col integer[] { r, g, b }
---@param alpha integer
local function quad(a, b, c, d, col, alpha)
    tri(a, b, c, col, alpha)
    tri(a, c, d, col, alpha)
end

---Draw a dashed line with equal dash and gap lengths.
---@param a vector3
---@param b vector3
---@param dash number dash length in metres
---@param col integer[] { r, g, b }
---@param alpha integer
local function dashed(a, b, dash, col, alpha)
    local len = #(b - a)
    if len < 1e-3 then return end
    local d = (b - a) / len
    local t = 0.0
    while t < len do
        line(a + d * t, a + d * math.min(len, t + dash), col, alpha)
        t = t + dash * 2
    end
end

---Faint bounding box, ground footprint, a drop line when floating and a chevron at the front.
local function drawAssembly(t)
    local warn = ui.warnings and #ui.warnings > 0
    local col = warn and COL.warn or COL.box
    local mn, mx = bounds.min, bounds.max
    local c = {}
    for i, v in ipairs({
        vector3(mn.x, mn.y, mn.z), vector3(mx.x, mn.y, mn.z), vector3(mx.x, mx.y, mn.z), vector3(mn.x, mx.y, mn.z),
        vector3(mn.x, mn.y, mx.z), vector3(mx.x, mn.y, mx.z), vector3(mx.x, mx.y, mx.z), vector3(mn.x, mx.y, mx.z),
    }) do c[i] = toWorld(t, v) end
    local edgeAlpha = warn and 170 or 70
    for _, e in ipairs({ { 1, 2 }, { 2, 3 }, { 3, 4 }, { 4, 1 }, { 5, 6 }, { 6, 7 }, { 7, 8 }, { 8, 5 }, { 1, 5 }, { 2, 6 }, { 3, 7 }, { 4, 8 } }) do
        line(c[e[1]], c[e[2]], col, edgeAlpha)
    end
    local piv = pivot(t)
    local _, g = footprintGround(t)
    ui.floating = (g and not ui.airborne) and (piv.z - g) or 0.0 -- (a computer on a desk is meant to be up there)
    local lift = vector3(0.0, 0.0, (g and (g - piv.z) or 0.0) + 0.03)
    quad(c[1] + lift, c[2] + lift, c[3] + lift, c[4] + lift, warn and COL.warn or { 0, 0, 0 }, warn and 40 or 60)
    if g and ui.floating > FLOAT_WARN then
        dashed(piv, vector3(piv.x, piv.y, g + 0.03), 0.12, COL.warn, 220)
    end
    local R, F = axes(t.heading)
    local front = toWorld(t, vector3((mn.x + mx.x) * 0.5, mx.y, mn.z)) + F * 0.25 + lift
    local w = clamp(#(vector3(mx.x - mn.x, mx.y - mn.y, 0.0)) * 0.06, 0.18, 0.6)
    tri(front + F * w, front - R * w * 0.8, front + R * w * 0.8, col, 170)
end

---Lifecycle

---End placement: delete the ghosts, hide the HUD and resolve the waiting start() call. Idempotent.
---@param result table|nil the placed transform, or nil when cancelled
local function finish(result)
    if not active then return end
    active = false
    setCursor(false)
    for _, p in ipairs(parts) do
        if DoesEntityExist(p.ent) then DeleteEntity(p.ent) end
    end
    parts = {}
    if ghost and DoesEntityExist(ghost) then DeleteEntity(ghost) end
    ghost, bounds, warnFn, frameFn, rootRot = nil, nil, nil, nil, nil
    if hudPush then hudPush('computers:placer:hud', { active = false }) end
    local p = pending
    pending, draft = nil, nil
    if p then p:resolve(result) end
end

---Heading that turns the front of the assembly at a point towards the player.
---@param at vector3 placement point
---@param pc vector3 player coords
---@return number degrees
local function headingToFace(at, pc)
    local dx, dy = pc.x - at.x, pc.y - at.y
    if math.abs(dx) < 0.001 and math.abs(dy) < 0.001 then return 0.0 end
    return math.deg(math.atan(dx, -dy)) % 360.0
end

local lastHud, lastWarn = 0, 0

---Refresh the warning list (every 250 ms) and push the HUD state (every 50 ms), including a live
---move or rotate readout while the gizmo is being dragged.
---@param label string
---@param t table the transform being shown
local function pushHud(label, t)
    local now = GetGameTimer()
    if now - lastWarn > 250 then
        lastWarn = now
        local list = {}
        if (ui.floating or 0) > FLOAT_WARN then list[#list + 1] = { key = 'floating', value = ('%.2f'):format(ui.floating) } end
        if warnFn then
            for _, w in ipairs(warnFn(t) or {}) do list[#list + 1] = w end
        end
        ui.warnings = list
    end
    if not hudPush or now - lastHud < 50 then return end
    lastHud = now
    local d = ui.drag
    local readout, handle
    if d and d.changed then
        local turned = wrap180(t.heading - d.start.heading)
        if math.abs(turned) > 0.05 then
            handle, readout = 'rotate', ('%+.1f°'):format(turned)
        else
            local a, b = pivot(d.start), pivot(t)
            handle, readout = 'move', ('%.2f m'):format(#(b - a))
        end
    end
    hudPush('computers:placer:hud', {
        active = true, label = label,
        x = t.x, y = t.y, z = t.z, heading = t.heading,
        mode = ui.mode, space = ui.space, snap = ui.snap, stick = ui.stick, cursor = ui.cursor and not ui.looking,
        handle = handle, dragging = readout ~= nil, readout = readout,
        warnings = ui.warnings, canUndo = #ui.history > 0, canRedo = #ui.future > 0,
        snapMove = SNAP_MOVE, snapTurn = SNAP_TURN,
    })
end

---Start the per-frame placement thread: blocks controls, handles the wheel, snap, stick, drop,
---undo/redo and arrow nudges, runs the gizmo, draws the preview and confirms or cancels.
---@param label string what the HUD calls it
local function loop(label)
    CreateThread(function()
        local held = {}
        while active do
            local dt = GetFrameTime()
            for _, c in ipairs(BLOCKED) do DisableControlAction(0, c, true) end
            DisablePlayerFiring(cache.playerId, true)
            local shift = IsControlPressed(0, C.shift)
            local ctrl = IsDisabledControlPressed(0, C.ctrl)

            if IsDisabledControlJustPressed(0, C.cursor) and not ui.drag then setCursor(not ui.cursor) end

            if IsDisabledControlJustPressed(0, C.snap) then ui.snap = not ui.snap end
            if IsDisabledControlJustPressed(0, C.stick) then
                ui.stick = not ui.stick
                if ui.stick then remember() dropToGround() end
            end
            if IsDisabledControlJustPressed(0, C.drop) then remember() dropToGround() end

            if not ui.drag and ctrl and IsDisabledControlJustPressed(0, C.undo) and #ui.history > 0 then
                ui.future[#ui.future + 1] = snapshot()
                restore(table.remove(ui.history))
            elseif not ui.drag and ctrl and IsDisabledControlJustPressed(0, C.redo) and #ui.future > 0 then
                ui.history[#ui.history + 1] = snapshot()
                restore(table.remove(ui.future))
            end

            local R, F = axes(draft.heading)
            local step = NUDGE * (shift and 5.0 or 1.0) * math.max(1.0, dt * 60.0)
            local moves = {
                { C.up, F * step }, { C.down, F * -step }, { C.right, R * step }, { C.left, R * -step },
                { C.pageUp, vector3(0.0, 0.0, step) }, { C.pageDown, vector3(0.0, 0.0, -step) },
            }
            for _, m in ipairs(moves) do
                if IsDisabledControlPressed(0, m[1]) then
                    if not held[m[1]] then remember() held[m[1]] = true end
                    draft.x, draft.y, draft.z = draft.x + m[2].x, draft.y + m[2].y, draft.z + m[2].z
                    if m[1] == C.pageUp or m[1] == C.pageDown then ui.stick = false
                    elseif ui.stick then dropToGround() end
                else
                    held[m[1]] = nil
                end
            end

            if gizmoFrame() then
                if ui.drag then ui.drag.changed = true end
                if ui.stick then dropToGround() end
            end

            local t = placed()
            apply(t)
            SetEntityDrawOutlineColor(table.unpack((ui.warnings and #ui.warnings > 0) and { 245, 170, 60, 255 } or { 255, 255, 255, 200 }))
            drawAssembly(t)
            pushHud(label, t)
            if frameFn then frameFn(t) end

            if not ui.drag and IsDisabledControlJustPressed(0, C.enter) then
                finish(t)
                return
            elseif IsDisabledControlJustPressed(0, C.back) or IsDisabledControlJustPressed(0, C.pause) or IsDisabledControlJustPressed(0, C.pauseAlt) then
                if ui.drag then
                    restore(ui.drag.start)
                    ui.drag.start = snapshot()
                    ui.drag.changed = false
                else
                    finish(nil)
                    return
                end
            end
            Wait(0)
        end
    end)
end

---Gizmo key mappings (rebindable in Settings > Key Bindings > FiveM)

---Grab the gizmo while held. Records an undo step on press and drops it again on release when the drag changed nothing.
lib.addKeybind({
    name = 'sd_computers_gizmo_select',
    description = 'Computer placement: grab the gizmo',
    defaultMapper = 'MOUSE_BUTTON',
    defaultKey = 'MOUSE_LEFT',
    onPressed = function()
        if not active then return end
        remember()
        ui.drag = { start = snapshot(), changed = false }
        ExecuteCommand('+gizmoSelect')
    end,
    onReleased = function()
        ExecuteCommand('-gizmoSelect')
        if not active then return end
        if ui.drag and not ui.drag.changed and #ui.history > 0 then table.remove(ui.history) end
        ui.drag = nil
    end,
})

---Switch the gizmo to move mode.
lib.addKeybind({
    name = 'sd_computers_gizmo_move',
    description = 'Computer placement: move mode',
    defaultKey = 'W',
    onPressed = function()
        if not active then return end
        ui.mode = 'move'
        ExecuteCommand('+gizmoTranslation')
    end,
    onReleased = function() ExecuteCommand('-gizmoTranslation') end,
})

---Switch the gizmo to rotate mode.
lib.addKeybind({
    name = 'sd_computers_gizmo_rotate',
    description = 'Computer placement: rotate mode',
    defaultKey = 'R',
    onPressed = function()
        if not active then return end
        ui.mode = 'rotate'
        ExecuteCommand('+gizmoRotation')
    end,
    onReleased = function() ExecuteCommand('-gizmoRotation') end,
})

-- The wheel and the right button are key mappings too: with the cursor out the game swallows the wheel before any
-- control sees it (a key mapping still hears it), and the gizmo is only usable with the cursor out.

---Turn what is being placed one step. Shift = 15 degrees, Ctrl = 1, snap on = the snap angle.
---@param dir integer 1 or -1
local function wheelTurn(dir)
    if not active or ui.drag then return end
    remember()
    local step = ui.snap and SNAP_TURN or (IsDisabledControlPressed(0, C.ctrl) and 1.0 or (IsControlPressed(0, C.shift) and 15.0 or TURN_STEP))
    turnBy(dir * step)
end

lib.addKeybind({
    name = 'sd_computers_gizmo_turn_left',
    description = 'Computer placement: turn left',
    defaultMapper = 'MOUSE_WHEEL',
    defaultKey = 'IOM_WHEEL_UP',
    onPressed = function() wheelTurn(1) end,
})

lib.addKeybind({
    name = 'sd_computers_gizmo_turn_right',
    description = 'Computer placement: turn right',
    defaultMapper = 'MOUSE_WHEEL',
    defaultKey = 'IOM_WHEEL_DOWN',
    onPressed = function() wheelTurn(-1) end,
})

---Hold to look about: the cursor goes while it is held and comes back on release.
lib.addKeybind({
    name = 'sd_computers_gizmo_look',
    description = 'Computer placement: hold to look around',
    defaultMapper = 'MOUSE_BUTTON',
    defaultKey = 'MOUSE_RIGHT',
    onPressed = function() if active then lookAround(true) end end,
    onReleased = function() if active then lookAround(false) end end,
})

---Toggle the gizmo between local and world axes.
lib.addKeybind({
    name = 'sd_computers_gizmo_space',
    description = 'Computer placement: local / world axes',
    defaultKey = 'Q',
    onPressed = function()
        if not active then return end
        ui.space = ui.space == 'local' and 'world' or 'local'
        ExecuteCommand('+gizmoLocal')
    end,
    onReleased = function() ExecuteCommand('-gizmoLocal') end,
})

---@type number Metres in front of the admin a new placement starts when they were not looking at a place for it.
local START_AHEAD = 1.5

---Where a new placement starts. On what the admin is looking at, when that is somewhere a prop can stand (a desk, a
---counter, the floor: something level) and within reach of them; otherwise a step in front of them, on the ground.
---The panel covers the display when this is asked, so "what the admin is looking at" is as often a far wall they
---never chose - and a prop that starts on it, across the room and above head height, has to be fetched back first.
---@param pc vector3 player coords
---@return table draft { x, y, z, heading }
local function startSpot(pc)
    local reach = CFG.PlaceReach or 6.0
    local rot = GetGameplayCamRot(2)
    local ro, rd = GetGameplayCamCoord(), rotToDir(rot)
    -- (measured from the admin, not from the camera behind them: the ray is given the room to get that far)
    local to = ro + rd * (reach + 10.0)
    local _, hit, at, normal = GetShapeTestResult(StartExpensiveSynchronousShapeTestLosProbe(ro.x, ro.y, ro.z, to.x, to.y, to.z, 1 + 16, cache.ped, 4))
    if hit == 1 and normal.z >= 0.7 and #(at - pc) <= reach then
        return { x = at.x, y = at.y, z = at.z, heading = headingToFace(at, pc) }
    end

    -- The way the camera faces, and not through a wall that is nearer than the step.
    local yaw = math.rad(rot.z)
    local ahead = vector3(-math.sin(yaw), math.cos(yaw), 0.0)
    local wall = surfaceHit(pc, ahead, START_AHEAD + 0.5)
    local step = wall and math.max(0.3, #(wall - pc) - 0.5) or START_AHEAD
    local x, y = pc.x + ahead.x * step, pc.y + ahead.y * step
    local spot = vector3(x, y, groundAt(x, y, pc.z) or (pc.z - 1.0))
    return { x = spot.x, y = spot.y, z = spot.z, heading = headingToFace(spot, pc) }
end

---Begin placing `modelName` and block the calling thread until the admin confirms or cancels.
---@param kind string 'object' | 'vehicle'
---@param modelName string
---@param label string what the HUD calls it (already localised)
---@param extra table[]|nil more props built with the root, each { model, offset, rot? } in the root's space
---@param from table|nil start transform { x, y, z, heading } (moving something that already stands)
---@param opts table|nil { warn = fun(transform): { key, value? }[] } extra HUD warnings, checked a few times a second;
---  tint = a texture variation for every prop of the ghost;
---  frame = fun(transform) called every frame with where it is shown (an overlay of the caller's own)
---  rot = vector3 the root's own turn (pitch, roll, yaw), its parts' `rot` then counting towards the box too
---  airborne = true: it belongs off the ground (a computer: on a desk) - it starts with its underside on the spot it
---  starts at (startSpot), not dropped to the ground, does not stick to it, and is never warned about floating
---@return table|nil|false result { x, y, z, heading }; nil when cancelled, false when refused
---@return string|nil errKey
function placer.start(kind, modelName, label, extra, from, opts)
    if active then return false, 'admin.busy' end
    local model = lib.requestModel(joaat(modelName), 5000)
    if not model then return false, 'admin.model_missing' end

    active = true
    pending = promise.new()
    bounds, groundCache = nil, nil
    warnFn = opts and opts.warn or nil
    frameFn = opts and opts.frame or nil
    rootRot = opts and opts.rot or nil
    local airborne = opts and opts.airborne == true or false
    ui = { mode = 'move', space = 'world', snap = false, stick = from == nil and not airborne, cursor = false, drag = nil, history = {}, future = {}, warnings = {}, floating = 0.0,
        airborne = airborne }
    extend(model, vector3(0.0, 0.0, 0.0), rootRot)

    local pc = GetEntityCoords(cache.ped)
    if from then
        draft = { x = from.x + 0.0, y = from.y + 0.0, z = from.z + 0.0, heading = (from.heading or 0.0) + 0.0 }
    else
        draft = startSpot(pc)
    end

    if kind == 'vehicle' then
        ghost = CreateVehicle(model, draft.x, draft.y, draft.z, draft.heading, false, false)
        if ghost ~= 0 then SetVehicleEngineOn(ghost, false, true, true) end
    else
        ghost = CreateObjectNoOffset(model, draft.x, draft.y, draft.z, false, false, false)
    end
    SetModelAsNoLongerNeeded(model)
    if not ghost or ghost == 0 or not DoesEntityExist(ghost) then
        active, pending, draft, bounds = false, nil, nil, nil
        return false, 'admin.spawn_failed'
    end
    ghostify(ghost)
    local tint = opts and opts.tint
    if tint then SetObjectTextureVariation(ghost, tint) end

    for _, p in ipairs(extra or {}) do
        local hash = lib.requestModel(joaat(p.model), 5000)
        if hash then
            local ent = CreateObjectNoOffset(hash, draft.x, draft.y, draft.z, false, false, false)
            SetModelAsNoLongerNeeded(hash)
            if ent and ent ~= 0 and DoesEntityExist(ent) then
                ghostify(ent)
                if tint then SetObjectTextureVariation(ent, tint) end
                parts[#parts + 1] = { ent = ent, offset = p.offset, rot = p.rot }
                extend(hash, p.offset, rootRot and p.rot or nil)
            end
        end
    end

    if not from then
        local piv = pivot()
        draft.x, draft.y = draft.x + (draft.x - piv.x), draft.y + (draft.y - piv.y)
        if airborne then draft.z = draft.z - bounds.min.z else dropToGround() end -- (its underside on what was aimed at)
    end
    SetEntityDrawOutlineShader(1)
    command('gizmoTranslation')
    apply(draft)
    setCursor(true)
    loop(label)
    return Citizen.Await(pending)
end

---Cancel the running placement; the waiting start() call returns nil.
function placer.cancel() finish(nil) end

---Whether a placement is running.
---@return boolean
function placer.isActive() return active end

---Set the callback that receives placer HUD updates (the admin panel wires it to its NUI).
---@param fn fun(action: string, data: table)
function placer.setHud(fn) hudPush = fn end

---Cancel any running placement so its ghosts are deleted when this resource stops.
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    finish(nil)
end)

return placer
