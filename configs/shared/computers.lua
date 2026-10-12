-- Every usable computer. Each entry is EITHER a location (a box zone at fixed coords) OR a prop
-- model (every instance of that model in the world becomes a computer). Field reference:
--
--   id        unique string. Keys the computer's System Logs, PIN (configs/server/security.lua) and
--             hack targets (configs/server/targets.lua). Model computers get one log PER PROP
--             instance: '<id>@x,y,z' (rounded coords), so two desks never share a log.
--   label     shown on the target option and in the OS (Start menu, systeminfo).
--   hostname  the machine name in CMD/logs. Model computers append a short per-instance suffix.
--
--   coords    vec3 - location computer: the box zone centre (put it on the keyboard/monitor).
--   size      vec3 - box zone size (default vec3(0.8, 0.8, 0.8)).
--   rotation  number - box zone heading (default 0.0).
--     - or -
--   model     string | string[] - prop model name(s); every instance becomes this computer.
--
--   groups    optional job/gang lock, ox_target style: { police = 0, sheriff = 2 } (name = min
--             grade). nil = anyone can use it. Checked server-side on open AND on every action.
--   boss      optional Business Manager: a job name ('police') manages THAT job's employees and
--             funds; true manages whatever job the signed-in player has. Only that job's bosses
--             ever see the app. nil = no Business Manager on this computer.
--   style     optional look: 'modern' | 'retro' | 'mac' (configs/shared/desktop.lua Styles).
--             nil = Desktop.DefaultStyle. Scripts can override it per open (OpenComputer export).
--   apps      optional app list (ids from configs/shared/desktop.lua Apps). nil = Desktop.DefaultApps.
--             'boss' is added automatically when `boss` is set - you don't need to list it.
--   pin       NOT here - PINs are sensitive and live server-side in configs/server/security.lua.
return {
    -- Location computer: MRPD front desk. Locked to police, manages the police department.
    {
        id = 'mrpd_frontdesk',
        label = 'MRPD Front Desk',
        hostname = 'LSPD-MRPD-FD01',
        coords = vec3(441.2, -978.9, 30.9),
        size = vec3(0.9, 0.7, 0.6),
        rotation = 0.0,
        groups = { police = 0 },
        boss = 'police',
        style = 'retro', -- the station's ageing terminal
        apps = { 'mail', 'logs', 'cmd', 'notepad', 'calculator', 'settings' },
    },

    -- Location computer: Pillbox reception. Locked to EMS, manages the ambulance job.
    {
        id = 'pillbox_reception',
        label = 'Pillbox Reception',
        hostname = 'PILLBOX-RECEP01',
        coords = vec3(310.9, -597.4, 43.4),
        size = vec3(0.9, 0.7, 0.6),
        rotation = 340.0,
        groups = { ambulance = 0 },
        boss = 'ambulance',
        style = 'modern',
    },

    -- Model computer: every office monitor in the city is a public computer. No lock, no
    -- Business Manager - just mail, notes and the command line (practice hacks).
    {
        id = 'public_pc',
        label = 'Computer',
        hostname = 'LS-WORKSTATION',
        model = {
            'prop_monitor_01a', 'prop_monitor_01b', 'prop_monitor_02', 'prop_monitor_03b',
            'prop_monitor_w_large', 'prop_dyn_pc', 'prop_dyn_pc_02', 'prop_pc_01a', 'prop_pc_02a',
        },
        apps = { 'mail', 'logs', 'cmd', 'notepad', 'calculator', 'settings' },
    },

    -- Model computer: business laptops. `boss = true` = whoever signs in manages THEIR OWN job,
    -- if they are its boss (a mechanic boss sees the mechanic roster, a burgershot boss theirs).
    {
        id = 'business_laptop',
        label = 'Business Laptop',
        hostname = 'BIZ-LAPTOP',
        model = { 'prop_laptop_01a', 'p_laptop_02_s', 'prop_laptop_lester', 'prop_laptop_lester2' },
        boss = true,
        style = 'mac',
    },
}
