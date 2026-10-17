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
        mail = { label = '邮件', size = { w = 1060, h = 660 } },
        logs = { label = '事件查看器', size = { w = 1040, h = 620 } },
        cmd = { label = '命令提示符', size = { w = 900, h = 540 } },
        boss = { label = '经营管理', size = { w = 1100, h = 680 } },
        notepad = { label = '记事本', size = { w = 820, h = 560 } },
        calculator = { label = '计算器', size = { w = 340, h = 520 } },
        settings = { label = '设置', size = { w = 900, h = 600 } },
        files = { label = '文件', size = { w = 1180, h = 740 } }, -- the character's documents and their editor (configs/shared/files.lua)
        browser = { label = '浏览器', size = { w = 1100, h = 700 } }, -- the pages in configs/shared/browser.lua
        bank = { label = '银行', size = { w = 940, h = 640 } }, -- balance and statement (configs/shared/bank.lua)
        games = { label = '游戏', size = { w = 860, h = 640 } },
        -- For the player they are for, on every computer (list them in a computer's `apps` to place them):
        --   board   - a job's announcements and who is on duty: anyone with a job (configs/shared/board.lua)
        --   cameras - the cameras that player may watch from that computer (configs/shared/cameras.lua)
        --   photos  - the character's pictures, and the phone's gallery beside them (configs/shared/photos.lua)
        board = { label = '公司公告板', size = { w = 940, h = 620 } },
        cameras = { label = '安防监控', size = { w = 900, h = 600 } },
        photos = { label = '照片', size = { w = 980, h = 640 } },
        -- Phone apps: only installed while sd-phone is linked (configs/shared/phone.lua), on every
        -- computer that doesn't set phone = false. List them in a computer's `apps` to place them.
        -- With Phone.RequireLink they wait for Phone Link: the app that links a character's phone
        -- to that machine with a code sent to the phone. It is there whenever sd-phone is.
        messages = { label = '信息', size = { w = 920, h = 620 } },
        notes = { label = '备忘录', size = { w = 860, h = 580 } },
        contacts = { label = '通讯录', size = { w = 860, h = 600 } },
        phonelink = { label = '手机连接', size = { w = 620, h = 700 } },
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
                { id = 'petals-dark', label = '花瓣（深色）' },
                { id = 'petals-light', label = '花瓣（浅色）' },
                { id = 'nebula', label = '星云' },
                { id = 'dusk', label = '黄昏' },
                { id = 'currents', label = '洋流' },
                { id = 'solid', label = '纯色' },
            },
            DefaultWallpaper = 'petals-dark',
            Accents = { '#4cc2ff', '#60cdff', '#7a7dff', '#c239b3', '#e74856', '#ff8c00', '#16c60c', '#00b7c3' },
            DefaultTheme = 'dark', -- 'dark' | 'light'
            Sounds = true, -- synthesized system sounds (startup, sign-in, windows, clicks, notifications)
        },

        retro = {
            OsName = 'SD Desktop',
            OsBuild = '3.11',
            Wallpapers = {
                { id = 'retro-teal', label = '青绿' },
                { id = 'retro-weave', label = '编织' },
                { id = 'retro-bricks', label = '砖块' },
                { id = 'retro-starfield', label = '星空' },
                { id = 'retro-navy', label = '午夜' },
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
                { id = 'mojave-starry', label = '星空' },
                { id = 'mojave-desert-night', label = '沙漠之夜' },
                { id = 'mojave-multicolor', label = '多彩' },
                { id = 'mojave-purple-flow', label = '紫色流光' },
                { id = 'mojave-purple-glass', label = '紫晶' },
                { id = 'mojave-chroma', label = '霓虹' },
                { id = 'sonoma', label = '索诺玛' },
                -- The four drawn wallpapers are still selectable for characters that saved one.
                { id = 'harbor-dunes', label = '沙丘（绘制）' },
                { id = 'harbor-tide', label = '潮汐（绘制）' },
                { id = 'harbor-aurora', label = '极光（绘制）' },
                { id = 'harbor-graphite', label = '石墨（绘制）' },
            },
            DefaultWallpaper = 'mojave-starry',
            Accents = { '#0a84ff', '#bf5af2', '#ff375f', '#ff9f0a', '#ffd60a', '#30d158', '#8e8e93' },
            DefaultTheme = 'light',
            Sounds = true, -- synthesized system sounds (startup chord, windows, clicks, notifications)
        },
    },
}
