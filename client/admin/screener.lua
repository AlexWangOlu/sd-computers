---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Where the screen is on each prop (client.screens.quads).
local quads = require 'client.screens.quads'
---@type table The browsers behind the screens (client.screens.dui).
local dui = require 'client.screens.dui'

-- The screen tool: drawing where the screen is on a prop, instead of measuring it and typing the
-- numbers into configs/shared/screens.lua. A prop of the model is stood on its own, well above
-- the map, in front of a plain backdrop and a camera that looks at it square on. The admin drags
-- a box over the glass with the mouse - corner to corner, then by its edges - with the lock face
-- drawn in it exactly as it will be in the world; the wheel pushes it into the prop or pulls it
-- out, Q / E lean it back with a lid, and the right button looks at it from any side. Enter hands
-- the rectangle back (the panel sends it to the server, which keeps it for every prop of that
-- model); nothing is kept here.
--
-- What is edited is a ScreenSpec (client/screens/quads.lua): the same numbers the file holds.

---@type table Screener module; the table returned at end of file.
local screener = {}

---@type number Camera field of view, degrees (vertical).
local FOV = 35.0
---@type number Metres a rectangle may not be smaller than, a side.
local MIN_SIZE = 0.02
---@type number Metres an arrow key moves it.
local NUDGE = 0.001
---@type number Metres a wheel notch pushes it in or pulls it out.
local DEPTH = 0.0005
---@type number Degrees Q / E lean it.
local LEAN = 0.2
---@type number Times as far with Shift held.
local COARSE = 10.0
---@type number Degrees round the prop the side view is from: far enough round to see a picture
---standing off the glass, not so far that the bezel hides the glass.
local SIDE = 75.0
---@type number Degrees the camera turns for a full sweep of the mouse.
local LOOK = 6.0
---@type integer Most steps Ctrl + Z goes back.
local HISTORY = 60
---@type number Metres from the camera nothing is drawn nearer than (its near clip).
local CLIP = 0.03
---@type number Metres from the camera the box's outline is drawn at: just past the clip, nearer than any prop.
local NEAR = 0.05

---@type table Desktop.Styles, for the lock face shown in the box.
local STYLES = (config.Desktop and config.Desktop.Styles) or {}
---@type string
local STYLE = (config.Desktop and STYLES[config.Desktop.DefaultStyle] and config.Desktop.DefaultStyle) or next(STYLES) or 'modern'

---Controls (group 0) read by the loop. The mouse buttons and the wheel are key mappings further
---down: with the cursor out, the game swallows them before any control sees them.
local C = {
    enter = 191, back = 194, pause = 200, pauseAlt = 322, shift = 21, ctrl = 36,
    up = 172, down = 173, left = 174, right = 175,
    leanBack = 44, leanForward = 38, -- Q, E
    front = 23, side = 0, -- F, V
    snap = 47, turn = 45, picture = 74, -- G, R, H
    undo = 20, copy = 26, -- Z, C
    reset = 178, resetAlt = 214, -- Delete
    lookX = 1, lookY = 2, talk = 249,
}

local COL = { line = { 237, 237, 239 }, hot = { 62, 207, 115 }, backdrop = { 96, 102, 114 } }

---@type boolean
local active = false
---@type promise|nil
local pending
---@type fun(action: string, data: table)|nil
local hudPush
---@type integer|nil the prop being looked at
local prop
---@type vector3|nil where it stands. It is not turned, so its axes are the world's.
local origin
---@type integer|nil
local cam
---@type table|nil the browser showing the lock face
local browser
---@type ScreenSpec|nil the screen being drawn
local spec
---@type table the tool's state: the camera, the drag in hand, what can be undone
local ui = {}

-- ── Math ──────────────────────────────────────────────────────────────────────────────────

local function clamp(v, lo, hi) return math.max(lo, math.min(hi, v)) end
---Whether a key is down, held off by the loop or not (a key mapping fires outside the loop's frame).
local function down(control) return IsControlPressed(0, control) or IsDisabledControlPressed(0, control) end
local function dot(a, b) return a.x * b.x + a.y * b.y + a.z * b.z end
local function cross(a, b) return vector3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x) end
local function unit(v) return v / math.max(#v, 1e-6) end

---@param s ScreenSpec
---@return ScreenSpec
local function copy(s)
    return { x = s.x, y = s.y, z = s.z, w = s.w, h = s.h, tilt = s.tilt or 0.0, heading = s.heading or 0.0 }
end

---Move a screen's middle within its own plane (across, up) and along the way it faces (out).
---@param s ScreenSpec
---@param across number metres to the right, as you look at it
---@param up number
---@param out number metres towards the viewer
local function shift(s, across, up, out)
    local t = math.rad(s.tilt)
    local sin, cos = math.sin(t), math.cos(t)
    s.x = s.x + across
    s.y = s.y + up * sin - out * cos
    s.z = s.z + up * cos + out * sin
end

---@class ScreenFrame the rectangle being drawn, in the world
---@field c vector3 its middle, where it is drawn
---@field n vector3 the way it faces
---@field right vector3
---@field up vector3
---@field hw number half its width
---@field hh number half its height

---@param s ScreenSpec
---@return ScreenFrame
local function frameOf(s)
    local q = quads.make(s)
    return { c = origin + q.c, n = q.n, right = q.right, up = q.up, hw = s.w / 2, hh = s.h / 2 }
end

---Where a ray meets a rectangle's plane, measured from its middle (nil when the plane is seen
---too nearly edge on for that to mean anything).
---@param f ScreenFrame
---@param ro vector3
---@param rd vector3
---@return number|nil across, number|nil up
local function onPlane(f, ro, rd)
    local facing = dot(rd, f.n)
    if math.abs(facing) < 0.2 then return nil end
    local t = dot(f.c - ro, f.n) / facing
    if t <= 0.0 then return nil end
    local p = ro + rd * t - f.c
    return dot(p, f.right), dot(p, f.up)
end

---What a press at a point of the plane takes hold of: an edge or a corner ('resize', with which),
---the whole of it ('move'), or nothing - a new box is drawn from there ('draw').
---@param f ScreenFrame
---@param a number across
---@param b number up
---@param reach number metres from an edge that still counts as on it
---@return string kind, integer ex, integer ey
local function grabAt(f, a, b, reach)
    if a < -f.hw - reach or a > f.hw + reach or b < -f.hh - reach or b > f.hh + reach then return 'draw', 0, 0 end
    local ex = (math.abs(a + f.hw) <= reach and -1) or (math.abs(a - f.hw) <= reach and 1) or 0
    local ey = (math.abs(b + f.hh) <= reach and -1) or (math.abs(b - f.hh) <= reach and 1) or 0
    if ex ~= 0 or ey ~= 0 then return 'resize', ex, ey end
    return 'move', 0, 0
end

-- ── Undo ──────────────────────────────────────────────────────────────────────────────────

---Keep the screen as it is now, to go back to. Steps of one kind in quick succession (a turn of
---the wheel, a held arrow) are one step back.
---@param kind? string
local function remember(kind)
    local now = GetGameTimer()
    if kind and ui.lastKind == kind and now - (ui.lastAt or 0) < 700 then
        ui.lastAt = now
        return
    end
    ui.lastKind, ui.lastAt = kind, now
    ui.history[#ui.history + 1] = { spec = copy(spec), fresh = ui.fresh }
    if #ui.history > HISTORY then table.remove(ui.history, 1) end
end

---@param text string HUD note key
local function note(text)
    ui.note, ui.noteId = text, (ui.noteId or 0) + 1
end

-- ── Camera ────────────────────────────────────────────────────────────────────────────────

---Put the camera where the view has it: on a ball round the middle of the screen, measured from
---straight in front of it.
---@param n vector3 the way the screen faces
---@return vector3 pos, vector3 forward, vector3 right, vector3 up
local function aimCamera(n)
    local yaw = math.atan(n.y, n.x) + math.rad(ui.az)
    local pitch = clamp(math.asin(clamp(n.z, -1.0, 1.0)) + math.rad(ui.el), -1.45, 1.45)
    local out = vector3(math.cos(pitch) * math.cos(yaw), math.cos(pitch) * math.sin(yaw), math.sin(pitch))
    local pos = ui.focus + out * ui.dist
    local fwd = -out
    SetCamCoord(cam, pos.x, pos.y, pos.z)
    SetCamRot(cam, math.deg(math.asin(fwd.z)), 0.0, math.deg(math.atan(-fwd.x, fwd.y)), 2)
    local right = unit(vector3(fwd.y, -fwd.x, 0.0))
    return pos, fwd, right, cross(right, fwd)
end

---The way the camera looks through the cursor.
---@param fwd vector3
---@param right vector3
---@param up vector3
---@return vector3
local function cursorRay(fwd, right, up)
    local cx, cy = GetNuiCursorPosition()
    local rw, rh = GetActiveScreenResolution()
    local reach = math.tan(math.rad(FOV) / 2)
    return unit(fwd + right * ((2.0 * cx / rw - 1.0) * reach * GetAspectRatio(false)) + up * ((1.0 - 2.0 * cy / rh) * reach))
end

---@return string 'front' | 'side' | 'free'
local function viewName()
    if math.abs(ui.tel) > 6.0 then return 'free' end
    if math.abs(ui.taz) < 6.0 then return 'front' end
    return math.abs(math.abs(ui.taz) - SIDE) < 6.0 and 'side' or 'free'
end

-- ── Drawing ───────────────────────────────────────────────────────────────────────────────

local function line(a, b, col) DrawLine(a.x, a.y, a.z, b.x, b.y, b.z, col[1], col[2], col[3], 255) end

---A flat four-cornered patch, seen from either side.
local function patch(a, b, c, d, col, alpha)
    DrawPoly(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, col[1], col[2], col[3], alpha)
    DrawPoly(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z, col[1], col[2], col[3], alpha)
    DrawPoly(c.x, c.y, c.z, b.x, b.y, b.z, a.x, a.y, a.z, col[1], col[2], col[3], alpha)
    DrawPoly(d.x, d.y, d.z, c.x, c.y, c.z, a.x, a.y, a.z, col[1], col[2], col[3], alpha)
end

---A plain wall behind the prop and a lamp over the camera's shoulder: the same prop looks the same
---at noon in the desert and at midnight in the rain. (Over the shoulder, not at the lens: glass
---throws a lamp at the lens straight back as a white spot in the middle of the screen.)
local function studio(pos, fwd, right, up)
    local back = ui.dist + 4.0
    local c = pos + fwd * back
    local hh = math.tan(math.rad(FOV) / 2) * back * 1.4
    local hr, hu = right * (hh * GetAspectRatio(false)), up * hh
    patch(c - hr - hu, c + hr - hu, c + hr + hu, c - hr + hu, COL.backdrop, 255)
    local lamp = pos + up * (ui.dist * 0.9) - right * (ui.dist * 0.7)
    DrawLightWithRange(lamp.x, lamp.y, lamp.z, 255, 255, 255, ui.dist * 2.0 + 3.0, 1.2)
end

---The lock face, in the box: drawn the way every screen in the world is (client/screens/world.lua).
---@param f ScreenFrame
---@param pos vector3 the camera
local function picture(f, pos)
    local away = pos - f.c
    if dot(away, f.n) <= 0.0 then return end
    local c = f.c + f.n * (#away * quads.LIFT_PER_METRE)
    local hr, hu = f.right * f.hw, f.up * f.hh
    local tl, tr, bl, br = c - hr + hu, c + hr + hu, c - hr - hu, c + hr - hu
    local u0, v0, u1, v1 = dui.cover(f.hw / f.hh)
    local txn = browser.txn
    DrawSpritePoly(bl.x, bl.y, bl.z, br.x, br.y, br.z, tr.x, tr.y, tr.z, 255, 255, 255, 255, dui.TXD, txn, u0, v1, 1.0, u1, v1, 1.0, u1, v0, 1.0)
    DrawSpritePoly(bl.x, bl.y, bl.z, tr.x, tr.y, tr.z, tl.x, tl.y, tl.z, 255, 255, 255, 255, dui.TXD, txn, u0, v1, 1.0, u1, v0, 1.0, u0, v0, 1.0)
end

---The box itself: its four edges, and a grip on every corner and edge - the one a press would
---take hold of lit. Unlike the picture, it is never hidden by the prop: a box pushed too deep
---loses its picture to the glass (which is how "too deep" looks), and must not be lost with it.
---So it is drawn right in front of the camera, on the lines of sight to where it really is - the
---same place on the display, in front of everything.
---@param f ScreenFrame
---@param pos vector3 the camera
---@param hot table|nil { ex, ey } the grip under the cursor (0, 0 = the whole of it)
local function outline(f, pos, hot)
    local function near(p) return pos + unit(p - pos) * NEAR end
    local hr, hu = f.right * f.hw, f.up * f.hh
    local tl, tr, bl, br = near(f.c - hr + hu), near(f.c + hr + hu), near(f.c - hr - hu), near(f.c + hr - hu)
    local whole = hot and hot[1] == 0 and hot[2] == 0
    local col = whole and COL.hot or COL.line
    line(tl, tr, col) line(tr, br, col) line(br, bl, col) line(bl, tl, col)
    local s = ui.dist * 0.006
    local gr, gu = f.right * s, f.up * s
    for ex = -1, 1 do
        for ey = -1, 1 do
            if ex ~= 0 or ey ~= 0 then
                local p = f.c + hr * ex + hu * ey
                local lit = hot and hot[1] == ex and hot[2] == ey
                patch(near(p - gr - gu), near(p + gr - gu), near(p + gr + gu), near(p - gr + gu), lit and COL.hot or COL.line, 255)
            end
        end
    end
end

-- ── What the keys do ──────────────────────────────────────────────────────────────────────

---Sit the screen on whatever the prop has under its middle: the nearest thing a line straight into
---it from the front meets. A prop is only as finely shaped for this as its collision is, so it is a
---first guess - the wheel does the rest.
---@param quiet? boolean say nothing (the guess made as the tool opens)
local function snapToSurface(quiet)
    local f = frameOf(spec)
    local c = f.c - f.n * quads.LIFT -- (the middle as measured: frameOf has it where it is drawn)
    local best
    for _, at in ipairs({ { 0.0, 0.0 }, { -0.25, 0.0 }, { 0.25, 0.0 }, { 0.0, -0.25 }, { 0.0, 0.25 } }) do
        local p = c + f.right * (at[1] * spec.w) + f.up * (at[2] * spec.h)
        local from, to = p + f.n * 0.75, p - f.n * 0.75
        local _, hit, where, _, entity = GetShapeTestResult(StartExpensiveSynchronousShapeTestLosProbe(from.x, from.y, from.z, to.x, to.y, to.z, 16, cache.ped, 4))
        if hit == 1 and entity == prop then
            local out = dot(where - c, f.n)
            if at[1] == 0.0 and at[2] == 0.0 then
                best = out
                break
            end
            if not best or out > best then best = out end
        end
    end
    if not best then
        if not quiet then note('no_surface') end
        return
    end
    if not quiet then
        remember()
        note('snapped')
    end
    shift(spec, 0.0, 0.0, best)
end

---The line this screen is in configs/shared/screens.lua, on the clipboard.
---@param model string
local function copyLine(model)
    local parts = {
        ('centre = vec3(%.4f, %.4f, %.4f)'):format(spec.x, spec.y, spec.z),
        ('size = vec2(%.4f, %.4f)'):format(spec.w, spec.h),
    }
    if math.abs(spec.tilt) >= 0.05 then parts[#parts + 1] = ('tilt = %.1f'):format(spec.tilt) end
    if math.abs(spec.heading) >= 0.05 then parts[#parts + 1] = ('heading = %.1f'):format(spec.heading) end
    lib.setClipboard(('%s = { %s },'):format(model, table.concat(parts, ', ')))
    note('copied')
end

---@type table<integer, integer> control -> when a key held down steps next.
local repeatAt = {}

---Whether a key steps this frame: once as it goes down, then again and again while it is held.
---@param control integer
---@return boolean
local function stepping(control)
    local now = GetGameTimer()
    if IsDisabledControlJustPressed(0, control) then
        repeatAt[control] = now + 350
        return true
    end
    if IsDisabledControlPressed(0, control) and repeatAt[control] and now >= repeatAt[control] then
        repeatAt[control] = now + 45
        return true
    end
    return false
end

---Follow the drag in hand to where the cursor is on the plane.
---@param d table the drag: what was taken hold of, where, and the screen as it was
---@param a number across, from the middle the screen had as the drag began
---@param b number up
local function follow(d, a, b)
    local s = copy(d.spec)
    if d.kind == 'move' then
        shift(s, a - d.a, b - d.b, 0.0)
    elseif d.kind == 'draw' then
        s.w, s.h = math.max(math.abs(a - d.a), 0.001), math.max(math.abs(b - d.b), 0.001)
        shift(s, (a + d.a) / 2, (b + d.b) / 2, 0.0)
    else
        -- (the edge follows the cursor from where it was taken hold of, not from its own line)
        local l, r, bottom, top = -d.spec.w / 2, d.spec.w / 2, -d.spec.h / 2, d.spec.h / 2
        if d.ex < 0 then l = math.min(a - d.ox, r - MIN_SIZE) elseif d.ex > 0 then r = math.max(a - d.ox, l + MIN_SIZE) end
        if d.ey < 0 then bottom = math.min(b - d.oy, top - MIN_SIZE) elseif d.ey > 0 then top = math.max(b - d.oy, bottom + MIN_SIZE) end
        s.w, s.h = r - l, top - bottom
        shift(s, (l + r) / 2, (bottom + top) / 2, 0.0)
    end
    spec = s
end

-- ── The loop ──────────────────────────────────────────────────────────────────────────────

---End the tool: take the prop and the camera away, hide the HUD and resolve the waiting start()
---call. Idempotent.
---@param result table|nil the screen drawn, or nil when cancelled
local function finish(result)
    if not active then return end
    active = false
    if not ui.looking then LeaveCursorMode() end
    RenderScriptCams(false, false, 0, true, true)
    if cam and DoesCamExist(cam) then DestroyCam(cam, false) end
    if prop and DoesEntityExist(prop) then DeleteEntity(prop) end
    if browser then dui.release(browser) end
    if ui.radar then DisplayRadar(true) end
    cam, prop, browser, origin, spec = nil, nil, nil, nil, nil
    if hudPush then hudPush('computers:screener:hud', { active = false }) end
    local p = pending
    pending = nil
    if p then p:resolve(result) end
end

---@param label string what the HUD calls the prop
---@param model string its model name
local function loop(label, model)
    CreateThread(function()
        local lastHud = 0
        while active do
            DisableAllControlActions(0)
            EnableControlAction(0, C.talk, true)
            local dt = GetFrameTime()
            local ctrl = down(C.ctrl)
            local coarse = down(C.shift) and COARSE or 1.0

            -- The camera: eased towards where the view was last sent, round the middle of the screen
            -- (left where it was while a drag is in hand, or the box would run from the cursor).
            if ui.looking then
                ui.taz = ui.taz - GetDisabledControlNormal(0, C.lookX) * LOOK
                ui.tel = clamp(ui.tel + GetDisabledControlNormal(0, C.lookY) * LOOK, -80.0, 80.0)
            end
            local ease = math.min(1.0, dt * 14.0)
            ui.az = ui.az + (ui.taz - ui.az) * ease
            ui.el = ui.el + (ui.tel - ui.el) * ease
            ui.dist = ui.dist + (ui.tdist - ui.dist) * ease
            local cur = frameOf(spec)
            if not ui.drag then ui.focus = ui.focus + (cur.c - ui.focus) * ease end
            local pos, fwd, right, up = aimCamera(cur.n)

            -- Where the cursor is on the screen's plane, and what a press there would take hold of.
            local a, b, kind, ex, ey
            if not ui.looking then
                a, b = onPlane(ui.drag and ui.drag.f or cur, pos, cursorRay(fwd, right, up))
                if a and not ui.drag then
                    if ui.fresh then kind, ex, ey = 'draw', 0, 0 else kind, ex, ey = grabAt(cur, a, b, math.max(0.004, ui.dist * 0.014)) end
                end
            end

            if ui.pressed then
                ui.pressed = false
                if kind and not ui.drag then
                    remember()
                    ui.drag = {
                        kind = kind, ex = ex, ey = ey, a = a, b = b, f = cur, spec = copy(spec), fresh = ui.fresh, moved = false,
                        ox = a - ex * spec.w / 2, oy = b - ey * spec.h / 2,
                    }
                end
            end
            local d = ui.drag
            if d and a then
                if not d.moved and math.abs(a - d.a) + math.abs(b - d.b) > 0.002 then d.moved = true end
                if d.moved then follow(d, a, b) end
            end
            if ui.released then
                ui.released = false
                if d then
                    ui.drag = nil
                    -- (a click that went nowhere, or a box too small to be one: as it was)
                    if not d.moved or spec.w < MIN_SIZE or spec.h < MIN_SIZE then
                        spec = d.spec
                        table.remove(ui.history)
                    elseif d.kind == 'draw' then
                        ui.fresh = false
                    end
                    d = nil
                end
            end

            if not d then
                if not ui.fresh then
                    local step = NUDGE * coarse
                    for _, m in ipairs({ { C.left, -step, 0.0 }, { C.right, step, 0.0 }, { C.up, 0.0, step }, { C.down, 0.0, -step } }) do
                        if stepping(m[1]) then
                            remember('nudge')
                            shift(spec, m[2], m[3], 0.0)
                        end
                    end
                    for _, m in ipairs({ { C.leanBack, 1.0 }, { C.leanForward, -1.0 } }) do
                        if stepping(m[1]) then
                            remember('lean')
                            spec.tilt = clamp(spec.tilt + m[2] * LEAN * coarse, -89.0, 89.0)
                        end
                    end
                    if IsDisabledControlJustPressed(0, C.snap) then snapToSurface() end
                    if IsDisabledControlJustPressed(0, C.copy) then copyLine(model) end
                end
                if IsDisabledControlJustPressed(0, C.turn) then
                    remember()
                    spec.heading = (spec.heading + 90.0) % 360.0
                end
                if ctrl and IsDisabledControlJustPressed(0, C.undo) and #ui.history > 0 then
                    local was = table.remove(ui.history)
                    spec, ui.fresh, ui.lastKind = was.spec, was.fresh, nil
                elseif IsDisabledControlJustPressed(0, C.reset) or IsDisabledControlJustPressed(0, C.resetAlt) then
                    remember()
                    spec, ui.fresh = copy(ui.first), ui.firstFresh
                end
            end
            if IsDisabledControlJustPressed(0, C.front) then ui.taz, ui.tel, ui.tdist = 0.0, 0.0, ui.fit end
            if IsDisabledControlJustPressed(0, C.side) then ui.taz, ui.tel = (ui.taz > 0.0 and -SIDE or SIDE), 0.0 end
            if IsDisabledControlJustPressed(0, C.picture) then ui.picture = not ui.picture end

            -- What is there to see: a prop nothing has been drawn on yet shows no box until one is being drawn.
            local shown = frameOf(spec)
            local visible = not ui.fresh or (d ~= nil and d.moved)
            studio(pos, fwd, right, up)
            if visible then
                if ui.picture then picture(shown, pos) end
                outline(shown, pos, (d and { d.ex, d.ey }) or ((kind == 'move' or kind == 'resize') and { ex, ey }) or nil)
            end

            local now = GetGameTimer()
            if hudPush and now - lastHud >= 50 then
                lastHud = now
                hudPush('computers:screener:hud', {
                    active = true, label = label, model = model,
                    x = spec.x, y = spec.y, z = spec.z, w = spec.w, h = spec.h, tilt = spec.tilt, heading = spec.heading,
                    drawn = visible, over = d and d.kind or kind, dragging = d ~= nil and d.moved,
                    edgeOn = a == nil and not ui.looking, looking = ui.looking,
                    view = viewName(), picture = ui.picture, canUndo = #ui.history > 0,
                    note = ui.note, noteId = ui.noteId,
                })
            end

            if not d and IsDisabledControlJustPressed(0, C.enter) then
                if ui.fresh then
                    note('draw_first')
                else
                    finish(copy(spec))
                    return
                end
            elseif IsDisabledControlJustPressed(0, C.back) or IsDisabledControlJustPressed(0, C.pause) or IsDisabledControlJustPressed(0, C.pauseAlt) then
                if d then
                    -- (out of the drag, not out of the tool)
                    spec, ui.drag = d.spec, nil
                    table.remove(ui.history)
                else
                    finish(nil)
                    return
                end
            end
            Wait(0)
        end
    end)
end

-- ── Key mappings (rebindable in Settings > Key Bindings > FiveM) ──────────────────────────

lib.addKeybind({
    name = 'sd_computers_screen_grab',
    description = 'Screen tool: draw, move or resize the screen',
    defaultMapper = 'MOUSE_BUTTON',
    defaultKey = 'MOUSE_LEFT',
    onPressed = function() if active then ui.pressed = true end end,
    onReleased = function() if active then ui.released = true end end,
})

---Hold to look at the prop from another side: the cursor goes while it is held and comes back on release.
lib.addKeybind({
    name = 'sd_computers_screen_look',
    description = 'Screen tool: hold to look around the prop',
    defaultMapper = 'MOUSE_BUTTON',
    defaultKey = 'MOUSE_RIGHT',
    onPressed = function()
        if not active or ui.drag or ui.looking then return end
        ui.looking = true
        LeaveCursorMode()
    end,
    onReleased = function()
        if not active or not ui.looking then return end
        ui.looking = false
        EnterCursorMode()
    end,
})

---One notch of the wheel: the screen a little deeper into the prop or further out of it (Shift =
---ten times as far), or with Ctrl the camera closer or further away.
---@param dir integer 1 = away from the admin, -1 = towards them
local function wheel(dir)
    if not active or ui.drag then return end
    if down(C.ctrl) then
        ui.tdist = clamp(ui.tdist * (dir > 0 and 0.88 or 1.14), 0.12, 10.0)
        return
    end
    if ui.fresh then return end
    remember('depth')
    shift(spec, 0.0, 0.0, -dir * DEPTH * (down(C.shift) and COARSE or 1.0))
end

lib.addKeybind({
    name = 'sd_computers_screen_in',
    description = 'Screen tool: push the screen into the prop',
    defaultMapper = 'MOUSE_WHEEL',
    defaultKey = 'IOM_WHEEL_UP',
    onPressed = function() wheel(1) end,
})

lib.addKeybind({
    name = 'sd_computers_screen_out',
    description = 'Screen tool: pull the screen out of the prop',
    defaultMapper = 'MOUSE_WHEEL',
    defaultKey = 'IOM_WHEEL_DOWN',
    onPressed = function() wheel(-1) end,
})

-- ── Starting it ───────────────────────────────────────────────────────────────────────────

---Draw the screen of `modelName` and block the calling thread until the admin saves or cancels.
---@param modelName string
---@param label string what the HUD calls the prop (already localised)
---@return table|nil|false spec { x, y, z, w, h, tilt, heading }; nil when cancelled, false when refused
---@return string|nil errKey
function screener.start(modelName, label)
    if active then return false, 'admin.busy' end
    -- (asked first: requesting a model the game does not have is an error, not a nil)
    if not IsModelInCdimage(joaat(modelName)) then return false, 'admin.model_missing' end
    local model = lib.requestModel(joaat(modelName), 5000)
    if not model then return false, 'admin.model_missing' end

    -- On its own, above anything the map has standing: nothing is in the way and nothing is behind it.
    local pc = GetEntityCoords(cache.ped)
    local ent = CreateObjectNoOffset(model, pc.x, pc.y, math.max(pc.z + 150.0, 450.0), false, false, false)
    SetModelAsNoLongerNeeded(model)
    if not ent or ent == 0 or not DoesEntityExist(ent) then return false, 'admin.spawn_failed' end
    SetEntityHeading(ent, 0.0)
    FreezeEntityPosition(ent, true)
    SetEntityLodDist(ent, 500)
    Wait(100) -- (a moment for it to be solid: the first guess at its screen is sat on its surface)
    if active or not DoesEntityExist(ent) then
        if DoesEntityExist(ent) then DeleteEntity(ent) end
        return false, 'admin.busy'
    end

    active = true
    pending = promise.new()
    prop, origin = ent, GetEntityCoords(ent)
    browser = dui.acquire(dui.url('idle', STYLE))

    -- Where it starts: the screen it has, or a guess at one - the middle of its front, sat on its surface.
    local mn, mx = GetModelDimensions(model)
    local width, height = mx.x - mn.x, mx.z - mn.z
    local has = quads.spec(modelName)
    -- (as far back as shows all of it with room to spare, whichever of its width and its height asks for more)
    local need = math.max(height, width / GetAspectRatio(false), 0.15)
    local fit = clamp((need / 2) / math.tan(math.rad(FOV) / 2) / 0.55, 0.3, 10.0)
    ui = {
        az = 0.0, el = 0.0, dist = fit, taz = 0.0, tel = 0.0, tdist = fit, fit = fit,
        picture = true, looking = false, drag = nil, history = {}, fresh = has == nil, radar = false,
    }
    if has then
        spec = copy(has)
    else
        spec = { x = (mn.x + mx.x) / 2, y = mn.y, z = mn.z + height * 0.55, w = math.max(MIN_SIZE, width * 0.7), h = math.max(MIN_SIZE, height * 0.5), tilt = 0.0, heading = 0.0 }
        snapToSurface(true)
    end
    ui.first, ui.firstFresh = copy(spec), ui.fresh
    ui.focus = frameOf(spec).c

    cam = CreateCamWithParams('DEFAULT_SCRIPTED_CAMERA', origin.x, origin.y - fit, origin.z, 0.0, 0.0, 0.0, FOV, false, 2)
    SetCamNearClip(cam, CLIP)
    aimCamera(frameOf(spec).n)
    SetCamActive(cam, true)
    RenderScriptCams(true, false, 0, true, true)
    if not IsRadarHidden() then
        DisplayRadar(false)
        ui.radar = true
    end
    EnterCursorMode()
    loop(label, modelName)
    return Citizen.Await(pending)
end

---Cancel the tool; the waiting start() call returns nil.
function screener.cancel() finish(nil) end

---Whether the tool is running.
---@return boolean
function screener.isActive() return active end

---Set the callback that receives the tool's HUD updates (the admin panel wires it to its NUI).
---@param fn fun(action: string, data: table)
function screener.setHud(fn) hudPush = fn end

---Take the prop and the camera away when this resource stops.
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    finish(nil)
end)

return screener
