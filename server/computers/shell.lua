---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table RPC registration (server.computers.rpc).
local rpc = require 'server.computers.rpc'
---@type table Session helpers (server.computers.session).
local session = require 'server.computers.session'
---@type table System Logs (server.computers.logs).
local logs = require 'server.computers.logs'
---@type table Roaming per-character settings + notes (server.computers.profile).
local profile = require 'server.computers.profile'
---@type table Computer definitions + styles (server.computers.registry).
local registry = require 'server.computers.registry'
---@type table The security cameras and who may watch them (server.computers.cameras).
local cameras = require 'server.computers.cameras'

-- The small apps' endpoints: the shell itself (app launches, personalisation), Notepad, Event
-- Viewer, Command Prompt's system info and Security Cameras. Mail, Business Manager, hacking and
-- the bigger apps have their own files.

---Logging an app window opening (config.Logs.AppLaunch). Any signed-in session.
---@param payload { app: string }
rpc.register('shell:launch', nil, function(_, s, payload)
    local app = payload.app
    if type(app) ~= 'string' or not s.apps[app] then return rpc.ok() end
    if config.Logs and config.Logs.AppLaunch ~= false then
        local label = config.Desktop.Apps[app] and config.Desktop.Apps[app].label or app
        logs.write(s.instance, {
            level = 'information', source = 'Shell', eventId = logs.EVENT.APP_START,
            message = locale('logs.app_start', label, s.name),
        }, session.actor(s))
    end
    return rpc.ok()
end)

---Personalisation (theme / wallpaper / accent) - roams with the character to every computer of
---the same style (each style keeps its own).
---@param payload { settings: table }
rpc.register('profile:save', nil, function(_, s, payload)
    return rpc.ok(profile.saveSettings(s.citizenid, s.style, payload.settings))
end)

-- ── Notepad ───────────────────────────────────────────────────────────────────────────────

rpc.register('notes:list', 'notepad', function(_, s)
    return rpc.ok(profile.notes(s.citizenid))
end)

---@param payload { note: { id?: string, title: string, body: string } }
rpc.register('notes:save', 'notepad', function(_, s, payload)
    local note, err = profile.saveNote(s.citizenid, payload.note)
    if not note then return rpc.fail(err or 'err.invalid') end
    return rpc.ok(note)
end)

---@param payload { id: string }
rpc.register('notes:delete', 'notepad', function(_, s, payload)
    if type(payload.id) == 'string' then profile.deleteNote(s.citizenid, payload.id) end
    return rpc.ok()
end)

-- ── Event Viewer ──────────────────────────────────────────────────────────────────────────

---May this player clear this computer's log? (config.Logs.AllowClear + optional ClearGroups)
---@param src integer
---@return boolean
local function canClear(src)
    local L = config.Logs or {}
    if L.AllowClear == false then return false end
    return session.inGroups(src, L.ClearGroups)
end

---One page of this computer's System Logs (+ summary). See logs.page for the filter shape.
---@param payload { filter?: table }
rpc.register('logs:page', 'logs', function(src, s, payload)
    local page = logs.page(s.instance, payload.filter)
    page.canClear = canClear(src)
    page.computer = { hostname = s.hostname, label = s.def.label or s.def.id }
    return rpc.ok(page)
end)

---Clear this computer's log (writes the 1102 "log cleared" entry naming who did it).
rpc.register('logs:clear', 'logs', function(src, s)
    if not canClear(src) then return rpc.fail('err.no_access') end
    logs.clear(s.instance, session.actor(s))
    return rpc.ok()
end)

-- ── Command Prompt ────────────────────────────────────────────────────────────────────────

---`systeminfo` / `ipconfig` / `whoami` facts the client can't know on its own.
rpc.register('cmd:sysinfo', 'cmd', function(_, s)
    local c = s.coords
    local mac = ('%02X-%02X-%02X-%02X-%02X-%02X'):format(0x00, 0x1A, math.floor(c.x) & 0xFF, math.floor(c.y) & 0xFF, math.floor(c.z) & 0xFF, #s.instance & 0xFF)
    return rpc.ok({
        hostname = s.hostname, ip = s.ip, mac = mac, label = s.def.label or s.def.id,
        user = s.name, domain = (s.def.groups and next(s.def.groups)) and tostring(next(s.def.groups)):upper() or 'WORKGROUP',
        os = registry.styleDef(s.style).OsName or s.style, build = registry.styleDef(s.style).OsBuild or '1.0', uptime = os.time() - s.openedAt,
    })
end)

-- ── Security Cameras ──────────────────────────────────────────────────────────────────────

---The cameras this player may watch from this computer (configs/shared/cameras.lua).
rpc.register('cameras:list', 'cameras', function(src, s)
    local out = {}
    for _, cam in ipairs(cameras.visible(src, s.def)) do
        out[#out + 1] = { id = cam.id, label = cam.label, area = cam.area }
    end
    return rpc.ok(out)
end)

---Where one of those cameras is and how far it turns: what the client needs to show its picture.
---Only ever one the player may watch here. The first look at each camera in a session goes into
---this computer's System Logs.
---@param payload { id: string }
rpc.register('cameras:watch', 'cameras', function(src, s, payload)
    for _, cam in ipairs(cameras.visible(src, s.def)) do
        if cam.id == payload.id then
            s.watched = s.watched or {}
            if not s.watched[cam.id] then
                s.watched[cam.id] = true
                logs.write(s.instance, {
                    level = 'information', source = 'Cameras', eventId = logs.EVENT.CAMERA_VIEW,
                    message = locale('logs.camera_view', s.name, cam.label), data = { camera = cam.id },
                }, session.actor(s))
            end
            local limits = cameras.limits()
            return rpc.ok({
                id = cam.id, label = cam.label, area = cam.area,
                x = cam.x, y = cam.y, z = cam.z, pitch = cam.pitch, roll = cam.roll, yaw = cam.yaw, fov = cam.fov,
                pan = limits.pan, tilt = limits.tilt, zoom = limits.zoom, effect = limits.effect,
            })
        end
    end
    return rpc.fail('cameras.err_unknown')
end)

return {}
