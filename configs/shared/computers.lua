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
--             OFF OUT OF THE BOX: model computers only work once they are switched on, with the
--             switch at the top of the /computeradmin panel's Automatic tab (or Automatic = true
--             in configs/shared/admin.lua). Until then a computer is a location below, or one
--             placed or picked in the panel. The same tab can switch one model computer off, or
--             single models of it, and give it (or one model of it) a style: what it changes is
--             kept in the database and wins over this list and the `style` below.
--
--   groups    optional job/gang lock, ox_target style: { police = 0, sheriff = 2 } (name = min
--             grade). nil = anyone can use it. Checked server-side on open AND on every action.
--   boss      optional Business Manager: a job name ('police') manages THAT job's employees and
--             funds; true manages whatever job the signed-in player has. Only that job's bosses
--             ever see the app. nil = no Business Manager on this computer.
--   style     optional look: 'modern' | 'retro' | 'mac' (configs/shared/desktop.lua Styles).
--             nil = Desktop.DefaultStyle. Scripts can override it per open (OpenComputer export).
--   apps      optional app list (ids from configs/shared/desktop.lua Apps). nil = Desktop.DefaultApps.
--             'boss' is added automatically when `boss` is set - you don't need to list it. Nor
--             the apps that are for a player rather than a computer: the Company Board (anyone
--             with a job), Security Cameras (anyone allowed to watch a camera here) and the
--             phone apps (Messages, Notes, Photos, Contacts, while sd-phone is linked). Those
--             appear on every computer; list one here only to choose where it sits.
--   board     false = no Company Board on this computer (configs/shared/board.lua).
--   cameras   false = no Security Cameras on this computer (configs/shared/cameras.lua).
--   phone     false = none of the phone apps on this computer, and no Phone Link to link a phone
--             to it with (configs/shared/phone.lua).
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
        style = 'modern',
        apps = { 'mail', 'files', 'browser', 'bank', 'logs', 'cmd', 'notepad', 'calculator', 'settings' },
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

    -- Model computer: every office monitor in the city is a public computer (once model computers
    -- are switched on - see `model` above). No lock, no Business Manager - just mail, notes and the
    -- command line (practice hacks). Monitors only: a tower PC has no screen, so none is listed
    -- (add 'prop_dyn_pc' and the like here if the towers should be computers too).
    {
        id = 'public_pc',
        label = 'Computer',
        hostname = 'LS-WORKSTATION',
        model = {
            'prop_monitor_01a', 'prop_monitor_01b', 'prop_monitor_02', 'prop_monitor_03b',
            'prop_monitor_w_large', 'prop_monitor_01c', 'prop_monitor_01d', 'prop_monitor_li',
            'tr_prop_tr_monitor_01a', 'prop_monitor_04a', 'xm_prop_x17_computer_02', 'prop_ld_monitor_01',
            'v_serv_ct_monitor01', 'v_serv_ct_monitor02', 'ex_prop_monitor_01_ex', 'sm_prop_smug_monitor_01',
        },
        apps = { 'mail', 'files', 'browser', 'bank', 'logs', 'cmd', 'notepad', 'calculator', 'games', 'settings' },
    },

    -- Model computer: business laptops. `boss = true` = whoever signs in manages THEIR OWN job,
    -- if they are its boss (a mechanic boss sees the mechanic roster, a burgershot boss theirs).
    {
        id = 'business_laptop',
        label = 'Business Laptop',
        hostname = 'BIZ-LAPTOP',
        model = {
            'prop_laptop_01a', 'p_laptop_02_s', 'prop_laptop_lester', 'prop_laptop_lester2',
            'prop_laptop_jimmy', 'ex_prop_ex_laptop_01a', 'xm_prop_x17_laptop_lester_01', 'p_cs_laptop_02', 'v_ind_ss_laptop',
        },
        boss = true,
        style = 'mac',
    },
}
