---@type table sd-computers config root (configs/config.lua).
local config = require 'configs.config'
---@type table Console log helper (shared.log): tagged color-coded prints.
local log = require 'shared.log'
---@type table The prop models known as a computer (shared.props).
local props = require 'shared.props'
---@type table Computer definitions (server.computers.registry): told the style the panel gave a computer.
local registry = require 'server.computers.registry'

---@type string GlobalState key the props that are a computer right now are published under.
local STATE_KEY = 'sd-computers:auto'
---@type string Row of computers_settings this module keeps.
local SETTING = 'auto'

-- The model computers of configs/shared/computers.lua - "every prop of these models is a computer" -
-- as the admin panel has them: all of them on or off, each one on or off, prop by prop, and the
-- style each opens in (one for the computer, and one of its own for any prop of it). What the
-- panel changes is kept in the database and wins over the file; a prop nobody touched follows the
-- file, so adding a model there still works. All of them start off (config.Admin.Automatic): out of
-- the box a computer is one that was placed or picked, until the panel's switch says otherwise.
--
-- This decides which props OFFER a computer. The props are the game's own and not networked, so
-- the server never knows which model a player is standing at: an entry that is switched off is
-- still an entry, and a script can open it (OpenComputer). Lock it with `groups` to keep people out.

---@type table Automatic-computer module; the table returned at end of file.
local auto = {}

---@type boolean Where the switch for all of them starts: config.Admin.Automatic.
local DEFAULT = (config.Admin or {}).Automatic == true
---@type boolean Whether any prop in the world is a computer on its own.
local master = DEFAULT
---@class AutoChoice what the panel chose for one model computer
---@field enabled boolean|nil false = switched off
---@field models table<string, boolean> a prop ticked or unticked against what the file says
---@field style string|nil the style the computer opens in (nil = the file's, else the default)
---@field styles table<string, string> a style of its own for a prop

---@type table<string, AutoChoice> by computer id
local choices = {}

-- auto.onChanged(id) hears that a model computer was switched off, so whoever sits at one can be
-- stood up (server/admin/panel.lua wires it to session.closeComputer).
---@type fun(id: string)
auto.onChanged = function() end

---Create the settings table if it doesn't exist, so the resource stays drop-in. Run once at boot.
function auto.ensureSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS computers_settings (
            name       VARCHAR(48) NOT NULL,
            value      LONGTEXT    NULL,
            updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
end

---@param id any
---@return table|nil def the model computer with that id
local function defOf(id)
    for _, def in ipairs(props.defs) do
        if def.id == id then return def end
    end
    return nil
end

---A style from the panel: a Desktop.Styles key, or nil for "no style of its own".
---@param raw any
---@return string|nil style
---@return boolean ok false when it names a style that does not exist
local function styleOf(raw)
    if raw == nil or raw == '' or raw == false then return nil, true end
    if type(raw) == 'string' and (config.Desktop.Styles or {})[raw] then return raw, true end
    return nil, false
end

---Whether a model computer is switched on (whatever the master switch says).
---@param def table computers.lua entry
---@return boolean
function auto.on(def)
    local c = choices[def.id]
    return not (c and c.enabled == false)
end

---Whether a prop is ticked for a model computer: the panel's choice, else the file's.
---@param def table
---@param model string
---@param own boolean whether computers.lua lists it for this computer
---@return boolean
local function ticked(def, model, own)
    local c = choices[def.id]
    local v = c and c.models[model]
    if v == nil then return own end
    return v == true
end

---The model computer a spare prop is ticked for: the first in config order (a prop is one
---computer, not two).
---@param model string
---@return table|nil def
local function holder(model)
    for _, def in ipairs(props.defs) do
        if ticked(def, model, false) then return def end
    end
    return nil
end

---The props ticked for a model computer, whatever the switches say.
---@param def table computers.lua entry
---@return string[]
function auto.models(def)
    local names, own = props.candidates(def)
    local out = {}
    for _, name in ipairs(names) do
        local on
        if own[name] then on = ticked(def, name, true) else on = holder(name) == def end
        if on then out[#out + 1] = name end
    end
    return out
end

---The props that are this computer in the world right now (none while it, or all of them, is off).
---@param def table computers.lua entry
---@return string[]
function auto.active(def)
    if not master or not auto.on(def) then return {} end
    return auto.models(def)
end

---Publish the props that are a computer, each with the style it opens in when the panel gave it
---(or its computer) one: { [computer id] = { [model] = style | true } }.
local function publish()
    local out = {}
    for _, def in ipairs(props.defs) do
        local c = choices[def.id]
        local map = {}
        for _, name in ipairs(auto.active(def)) do
            map[name] = (c and (c.styles[name] or c.style)) or true
        end
        out[def.id] = map
        registry.setStyle(def.id, c and c.style or nil) -- (a script opening the entry gets the computer's style too)
    end
    GlobalState[STATE_KEY] = out
end

local function save()
    -- (the switch for all of them is only kept where the panel moved it away from the file's: left
    -- where the file has it, it goes on following the file)
    local enabled
    if master ~= DEFAULT then enabled = master end
    MySQL.prepare.await('INSERT INTO computers_settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        { SETTING, json.encode({ enabled = enabled, computers = choices }) })
end

---@param id string
---@return AutoChoice choice
local function choiceOf(id)
    choices[id] = choices[id] or { models = {}, styles = {} }
    return choices[id]
end

---Load what the panel chose and publish the props that are a computer. Run once at boot.
function auto.load()
    local raw = MySQL.scalar.await('SELECT value FROM computers_settings WHERE name = ?', { SETTING })
    local saved = type(raw) == 'string' and json.decode(raw) or nil
    if type(saved) == 'table' then
        if type(saved.enabled) == 'boolean' then master = saved.enabled end
        -- (only what still means something: a computer, a prop or a style the config no longer has is dropped)
        for id, c in pairs(type(saved.computers) == 'table' and saved.computers or {}) do
            local def = defOf(id)
            if def and type(c) == 'table' then
                local kept = choiceOf(def.id)
                if c.enabled == false then kept.enabled = false end
                kept.style = select(1, styleOf(c.style))
                local allowed = {}
                for _, name in ipairs((props.candidates(def))) do allowed[name] = true end
                for name, on in pairs(type(c.models) == 'table' and c.models or {}) do
                    if allowed[name] and type(on) == 'boolean' then kept.models[name] = on end
                end
                for name, style in pairs(type(c.styles) == 'table' and c.styles or {}) do
                    if allowed[name] then kept.styles[name] = select(1, styleOf(style)) end
                end
            end
        end
    end
    publish()
    if not master then log.info('auto', 'props in the world are not computers on their own (the Automatic tab of the admin panel switches that on)') end
end

---Publish again: the props a computer can be made of changed (one was added or removed in the panel).
---What was chosen for a prop that is gone is dropped.
function auto.refresh()
    for _, def in ipairs(props.defs) do
        local c = choices[def.id]
        if c then
            local allowed = {}
            for _, name in ipairs((props.candidates(def))) do allowed[name] = true end
            for name in pairs(c.models) do if not allowed[name] then c.models[name] = nil end end
            for name in pairs(c.styles) do if not allowed[name] then c.styles[name] = nil end end
        end
    end
    save()
    publish()
end

---Everything the panel's Automatic tab shows.
---@return table { enabled, computers = { key, label, enabled, style?, base?, models = { model, on, own, taken?, style? }[] }[] }
function auto.snapshot()
    local list = {}
    for _, def in ipairs(props.defs) do
        local names, own = props.candidates(def)
        local c = choices[def.id]
        local models = {}
        for _, name in ipairs(names) do
            local row = { model = name, own = own[name] == true, style = c and c.styles[name] or nil }
            if row.own then
                row.on = ticked(def, name, true)
            else
                local other = holder(name)
                row.on = other == def
                if other and other ~= def then row.taken = other.label or other.id end
            end
            models[#models + 1] = row
        end
        list[#list + 1] = { key = def.id, label = def.label or def.id, enabled = auto.on(def), style = c and c.style or nil, base = def.style, models = models }
    end
    return { enabled = master, computers = list }
end

-- ── Changes (each returns ok, then a locale key saying why not) ───────────────────────────

---Switch every model computer on or off at once.
---@param on boolean
---@return boolean ok
function auto.setEnabled(on)
    master = on == true
    save()
    publish()
    if not master then
        for _, def in ipairs(props.defs) do auto.onChanged(def.id) end
    end
    return true
end

---Switch one model computer on or off.
---@param id any computer id
---@param on boolean
---@return boolean ok
---@return string|nil why locale key
function auto.setComputer(id, on)
    local def = defOf(id)
    if not def then return false, 'admin.gone' end
    local c = choiceOf(def.id)
    if on == true then c.enabled = nil else c.enabled = false end
    save()
    publish()
    if not on then auto.onChanged(def.id) end
    return true
end

---@param def table
---@param model any
---@return boolean known, table<string, boolean> own
local function candidate(def, model)
    local names, own = props.candidates(def)
    for _, name in ipairs(names) do
        if name == model then return true, own end
    end
    return false, own
end

---Tick or untick one prop of a model computer.
---@param id any computer id
---@param model any model name
---@param on boolean
---@return boolean ok
---@return string|nil why locale key
function auto.setModel(id, model, on)
    local def = defOf(id)
    if not def then return false, 'admin.gone' end
    local known, own = candidate(def, model)
    if not known then return false, 'admin.bad_request' end
    if on and not own[model] then
        local other = holder(model)
        if other and other ~= def then return false, 'admin.prop_taken' end
    end
    -- (what the file says anyway is not kept: the prop goes back to following the file)
    local chosen = choiceOf(def.id).models
    if (on == true) == (own[model] == true) then chosen[model] = nil else chosen[model] = on == true end
    save()
    publish()
    return true
end

---Give a model computer a style (nil = back to the file's, or the server default).
---@param id any computer id
---@param style any Desktop.Styles key, or nil
---@return boolean ok
---@return string|nil why locale key
function auto.setStyle(id, style)
    local def = defOf(id)
    if not def then return false, 'admin.gone' end
    local key, ok = styleOf(style)
    if not ok then return false, 'admin.bad_request' end
    choiceOf(def.id).style = key
    save()
    publish()
    return true
end

---Give one prop of a model computer a style of its own (nil = the computer's).
---@param id any computer id
---@param model any model name
---@param style any Desktop.Styles key, or nil
---@return boolean ok
---@return string|nil why locale key
function auto.setModelStyle(id, model, style)
    local def = defOf(id)
    if not def then return false, 'admin.gone' end
    if not candidate(def, model) then return false, 'admin.bad_request' end
    local key, ok = styleOf(style)
    if not ok then return false, 'admin.bad_request' end
    choiceOf(def.id).styles[model] = key
    save()
    publish()
    return true
end

return auto
