return {
    -- The look a computer gets when its configs/shared/computers.lua entry has no `style`:
    --   'modern' - SD OS Pro: centred taskbar, Start menu, rounded translucent windows
    --   'retro'  - SD Desktop 3.11: a 1991 shell inside a CRT monitor - teal desktop, bevelled grey
    --              windows that snap open in chunky steps, DOS boot, synthesized period sounds
    --   'mac'    - SD OS Harbor: top menu bar, magnifying dock, traffic-light window buttons
    -- Every style runs the same apps against the same server; only the presentation changes.
    -- Scripts can also force a style when opening: exports['sd-computers']:OpenComputer(id, coords, { style = 'retro' }).
    DefaultStyle = 'modern',

    Boot = true, -- boot sequence before the lock screen on every open (each style has its own)
    Clock24 = false, -- clocks: true = 18:05, false = 6:05 PM

    -- Every app the OS knows. `size` is the window's default (and the window can be resized).
    -- Labels are what menus, taskbar/dock tooltips and title bars show. Icons are drawn by the NUI
    -- from the app id - add a new app here AND in web/src/apps/registry.tsx.
    Apps = {
        mail = { label = 'Mail', size = { w = 1060, h = 660 } },
        logs = { label = 'Event Viewer', size = { w = 1040, h = 620 } },
        cmd = { label = 'Command Prompt', size = { w = 900, h = 540 } },
        boss = { label = 'Business Manager', size = { w = 1100, h = 680 } },
        notepad = { label = 'Notepad', size = { w = 820, h = 560 } },
        calculator = { label = 'Calculator', size = { w = 340, h = 520 } },
        settings = { label = 'Settings', size = { w = 900, h = 600 } },
        files = { label = 'Files', size = { w = 980, h = 620 } }, -- the character's documents (configs/shared/files.lua)
        browser = { label = 'Browser', size = { w = 1100, h = 700 } }, -- the pages in configs/shared/browser.lua
        bank = { label = 'Bank', size = { w = 940, h = 640 } }, -- balance and statement (configs/shared/bank.lua)
        games = { label = 'Games', size = { w = 860, h = 640 } },
        -- For the player they are for, on every computer (list them in a computer's `apps` to place them):
        --   board   - a job's announcements and who is on duty: anyone with a job (configs/shared/board.lua)
        --   cameras - the cameras that player may watch from that computer (configs/shared/cameras.lua)
        board = { label = 'Company Board', size = { w = 940, h = 620 } },
        cameras = { label = 'Security Cameras', size = { w = 900, h = 600 } },
        -- Phone apps: only installed while sd-phone is linked (configs/shared/phone.lua), on every
        -- computer that doesn't set phone = false. List them in a computer's `apps` to place them.
        -- With Phone.RequireLink they wait for Phone Link: the app that links a character's phone
        -- to that machine with a code sent to the phone. It is there whenever sd-phone is.
        messages = { label = 'Messages', size = { w = 920, h = 620 } },
        notes = { label = 'Notes', size = { w = 860, h = 580 } },
        photos = { label = 'Photos', size = { w = 980, h = 640 } },
        contacts = { label = 'Contacts', size = { w = 860, h = 600 } },
        phonelink = { label = 'Phone Link', size = { w = 620, h = 700 } },
    },

    -- Apps a computer gets when its configs/shared/computers.lua entry has no `apps` list.
    DefaultApps = { 'mail', 'files', 'browser', 'bank', 'logs', 'cmd', 'notepad', 'calculator', 'games', 'settings' },

    -- Taskbar (modern) / dock (mac) pins, in order - only the apps the computer actually has.
    Pinned = { 'mail', 'messages', 'browser', 'files', 'boss', 'cmd', 'logs', 'notepad' },

    -- Desktop icons, in order (again filtered to the computer's apps).
    DesktopIcons = { 'mail', 'messages', 'notes', 'files', 'browser', 'bank', 'board', 'boss', 'cameras', 'photos', 'contacts', 'phonelink', 'logs', 'cmd', 'notepad', 'calculator', 'games', 'settings' },

    -- Per-style identity. Wallpaper ids are drawn by the NUI (no image files shipped); any other
    -- value is used as an image URL (https://...). Each character's wallpaper / accent / light-dark
    -- choice is remembered PER STYLE, so a retro desk and a modern laptop keep their own looks.
    Styles = {
        modern = {
            OsName = 'SD OS Pro', -- shown by `ver`, `systeminfo` and Settings > About
            OsBuild = '4.2.2610',
            Wallpapers = {
                { id = 'petals-dark', label = 'Petals (dark)' },
                { id = 'petals-light', label = 'Petals (light)' },
                { id = 'nebula', label = 'Nebula' },
                { id = 'dusk', label = 'Dusk' },
                { id = 'currents', label = 'Currents' },
                { id = 'solid', label = 'Solid colour' },
            },
            DefaultWallpaper = 'petals-dark',
            Accents = { '#4cc2ff', '#60cdff', '#7a7dff', '#c239b3', '#e74856', '#ff8c00', '#16c60c', '#00b7c3' },
            DefaultTheme = 'dark', -- 'dark' | 'light'
        },

        retro = {
            OsName = 'SD Desktop',
            OsBuild = '3.11',
            Wallpapers = {
                { id = 'retro-teal', label = 'Teal' },
                { id = 'retro-weave', label = 'Weave' },
                { id = 'retro-bricks', label = 'Bricks' },
                { id = 'retro-starfield', label = 'Starfield' },
                { id = 'retro-navy', label = 'Midnight' },
            },
            DefaultWallpaper = 'retro-teal',
            Accents = { '#000080', '#008080', '#800000', '#008000', '#800080', '#404040' }, -- active title bar colour
            DefaultTheme = 'light', -- retro is always the classic grey; kept for completeness
            Monitor = true, -- draw the desktop inside a beige CRT monitor (false = full screen)
            Sounds = true, -- synthesized period sounds (power-on, fan hum, window clicks)
        },

        mac = {
            OsName = 'SD OS Harbor',
            OsBuild = '2.6',
            Wallpapers = {
                { id = 'harbor-dunes', label = 'Dunes' },
                { id = 'harbor-tide', label = 'Tide' },
                { id = 'harbor-aurora', label = 'Aurora' },
                { id = 'harbor-graphite', label = 'Graphite' },
            },
            DefaultWallpaper = 'harbor-dunes',
            Accents = { '#0a84ff', '#bf5af2', '#ff375f', '#ff9f0a', '#ffd60a', '#30d158', '#8e8e93' },
            DefaultTheme = 'light',
        },
    },
}
