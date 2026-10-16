---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Profile persistence (server.computers.store).
local store = require 'server.computers.store'
---@type table UTF-8-safe clipping (shared.text).
local text = require 'shared.text'

---@type table Profile module (roaming per-character settings + Notepad notes); returned at end of file.
local profile = {}

---@type integer Notes one character may keep.
local MAX_NOTES = 50
---@type integer Characters per note title / body.
local MAX_TITLE, MAX_BODY = 80, 20000

---@type table<string, table<string, boolean>> style -> wallpaper ids that style offers.
local WALLPAPERS = {}
for style, def in pairs(config.Desktop.Styles or {}) do
    WALLPAPERS[style] = {}
    for _, w in ipairs(def.Wallpapers or {}) do WALLPAPERS[style][w.id] = true end
end

---Clean one style's settings to the known, valid fields only (anything else is dropped).
---@param t any
---@param style string
---@return table settings { theme?, wallpaper?, accent? }
local function sanitize(t, style)
    if type(t) ~= 'table' then return {} end
    local out = {}
    if t.theme == 'dark' or t.theme == 'light' then out.theme = t.theme end
    if type(t.wallpaper) == 'string' then
        local w = t.wallpaper
        local known = WALLPAPERS[style] or {}
        if known[w] or (#w <= 512 and (w:match('^https://') or w:match('^nui://'))) then out.wallpaper = w end
    end
    if type(t.accent) == 'string' and t.accent:match('^#%x%x%x%x%x%x$') then out.accent = t.accent:lower() end
    return out
end

---All of a character's stored settings as { [style] = settings }. Profiles saved before styles
---existed held one flat { theme, wallpaper, accent } - that becomes the 'modern' entry.
---@param citizenid string
---@return table<string, table>
local function allSettings(citizenid)
    local raw = store.getProfile(citizenid)
    local t = raw and json.decode(raw)
    if type(t) ~= 'table' then return {} end
    if t.theme or t.wallpaper or t.accent then return { modern = { theme = t.theme, wallpaper = t.wallpaper, accent = t.accent } } end
    return t
end

---A character's settings for one style (empty table = that style's defaults apply).
---@param citizenid string
---@param style string
---@return table settings
function profile.settings(citizenid, style)
    return sanitize(allSettings(citizenid)[style], style)
end

---Merge + persist a settings change for one style; returns that style's stored result.
---@param citizenid string
---@param style string
---@param patch table partial settings
---@return table settings
function profile.saveSettings(citizenid, style, patch)
    local all = allSettings(citizenid)
    local merged = sanitize(all[style], style)
    for k, v in pairs(sanitize(patch, style)) do merged[k] = v end
    all[style] = merged
    store.setSettings(citizenid, json.encode(all))
    return merged
end

---A character's notes, newest edit first.
---@param citizenid string
---@return table[] notes { id, title, body, updatedAt }
function profile.notes(citizenid)
    local _, raw = store.getProfile(citizenid)
    local list = raw and json.decode(raw)
    if type(list) ~= 'table' then return {} end
    table.sort(list, function(a, b) return (a.updatedAt or 0) > (b.updatedAt or 0) end)
    return list
end

---Create or update a note. A note without an id (or with an unknown one) is new; at MAX_NOTES the
---save is refused.
---@param citizenid string
---@param note table { id?, title, body }
---@return table|nil saved the stored note
---@return string|nil err locale key when refused
function profile.saveNote(citizenid, note)
    if type(note) ~= 'table' then return nil, 'err.invalid' end
    local title = text.clip(note.title, MAX_TITLE)
    local body = text.clip(note.body, MAX_BODY)
    if title == '' then title = locale('files.untitled') end

    local list = profile.notes(citizenid)
    local saved
    for _, n in ipairs(list) do
        if note.id ~= nil and n.id == note.id then
            n.title, n.body, n.updatedAt = title, body, os.time()
            saved = n
            break
        end
    end
    if not saved then
        if #list >= MAX_NOTES then return nil, 'err.notes_full' end
        saved = { id = ('%x%04x'):format(os.time(), math.random(0, 0xFFFF)), title = title, body = body, updatedAt = os.time() }
        list[#list + 1] = saved
    end
    store.setNotes(citizenid, json.encode(list))
    return saved, nil
end

---Delete a note by id (no-op for an unknown id).
---@param citizenid string
---@param id string
function profile.deleteNote(citizenid, id)
    local list, kept = profile.notes(citizenid), {}
    for _, n in ipairs(list) do
        if n.id ~= id then kept[#kept + 1] = n end
    end
    store.setNotes(citizenid, json.encode(kept))
end

return profile
