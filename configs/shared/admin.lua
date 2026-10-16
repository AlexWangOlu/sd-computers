-- Admin panel + placement tool. Both are the ones sd-bombs and sd-scooters use, so they look and handle the same.
return {
    Command = 'computeradmin', -- chat command that opens the panel; the ace it grants is command.computeradmin
    Group = 'group.admin', -- ace principal with full access: the command, every read and every change
    ViewGroup = false, -- optional ace principal (e.g. 'group.mod') that can open the panel and look, but not change anything
    EditAce = 'sd_computers.edit', -- the ace every change needs; granted to Group automatically, add it to other principals to let them edit

    -- A new placement starts on the desk, counter or floor you are looking at when that is within this
    -- many metres of you; looking anywhere else (a wall, across the room), it starts a step in front of you.
    PlaceReach = 6.0,
    Placement = { -- the placement gizmo
        SnapMove = 0.25, -- metres per step while snapping is on (X)
        SnapTurn = 15.0, -- degrees per step while snapping is on
        Nudge = 0.05, -- metres per frame the arrow keys / Page Up / Page Down move it (Shift x5)
        TurnStep = 5.0, -- degrees per mouse-wheel notch (Shift + wheel: 15, Ctrl + wheel: 1)
    },

    RefreshMs = 5000, -- ms between snapshot refreshes while the panel is open (who is sitting at which computer)
    SpawnDistance = 60.0, -- metres from a placed computer its prop is spawned at (every client spawns its own)
    MaxLabel = 48, -- longest name a placed computer can be given
    MaxCustomProps = 64, -- most props that can be added from the panel (see Props below)

    -- Whether the monitors and laptops the game already has are computers on their own: the
    -- `model` entries of configs/shared/computers.lua. false = they are not, and a computer is one
    -- you placed or picked in the panel (or a location in computers.lua). This is where the switch at
    -- the top of the panel's Automatic tab starts: once an admin flips it there, that is kept in the
    -- database and wins over this line.
    Automatic = false,

    -- The props a computer can be placed as. `kind` only picks the icon the panel falls back to when a
    -- prop has no picture: 'monitor' | 'tower' | 'laptop'. The picture is web/public/props/<model>.jpg
    -- (the ones here are photographs taken in the game; rebuild the UI after adding one), or set
    -- `image = 'https://...'` to use any other. Add any streamed prop here; a model the game does not
    -- have is refused when placed.
    -- A prop that is ALSO a model computer in configs/shared/computers.lua is fine: a placed one answers as itself only.
    -- These are also the props "Pick existing prop" takes from the world (with every model computers.lua
    -- lists), and one here that no computers.lua entry lists is offered in the Automatic tab as an extra.
    -- Admins can add more from the panel itself ("Add prop": a model name, a label and a kind); those are
    -- kept in the database, and show their icon until a picture is added here under the same model.
    -- A prop only has a screen drawn on it (and the camera going up to it) when configs/shared/screens.lua
    -- has a rectangle for its model; without one it is still a computer, opening fullscreen.
    Props = {
        { model = 'prop_monitor_01a', label = '平面显示器', kind = 'monitor' },
        { model = 'prop_monitor_01b', label = '平面显示器（关机）', kind = 'monitor' },
        { model = 'prop_monitor_02', label = '高清显示器', kind = 'monitor' },
        { model = 'prop_monitor_03b', label = 'CRT 显示器', kind = 'monitor' },
        { model = 'prop_monitor_w_large', label = '宽屏显示器', kind = 'monitor' },
        { model = 'prop_monitor_01c', label = '高清显示器（桌面）', kind = 'monitor' },
        { model = 'prop_monitor_01d', label = '平面显示器（弹窗）', kind = 'monitor' },
        { model = 'prop_monitor_li', label = '平面显示器（Lifeinvader）', kind = 'monitor' },
        { model = 'tr_prop_tr_monitor_01a', label = '平面显示器（灰色）', kind = 'monitor' },
        { model = 'prop_monitor_04a', label = '宽屏显示器（网页）', kind = 'monitor' },
        { model = 'xm_prop_x17_computer_02', label = '宽屏显示器（灰色）', kind = 'monitor' },
        { model = 'prop_ld_monitor_01', label = '小型显示器', kind = 'monitor' },
        { model = 'v_serv_ct_monitor01', label = '控制室显示器', kind = 'monitor' },
        { model = 'v_serv_ct_monitor02', label = '控制室显示器（终端）', kind = 'monitor' },
        { model = 'ex_prop_monitor_01_ex', label = '一体机', kind = 'monitor' },
        { model = 'sm_prop_smug_monitor_01', label = '一体机（小型）', kind = 'monitor' },
        -- Tower PCs are left out: a computer is something with a screen. Take the dashes off to offer
        -- them as well (or add one from the panel) - they have no screen, so they open fullscreen.
        -- { model = 'prop_dyn_pc', label = 'Tower PC', kind = 'tower' },
        -- { model = 'prop_dyn_pc_02', label = 'Tower PC (dark)', kind = 'tower' },
        -- { model = 'prop_pc_01a', label = 'Tower PC (beige)', kind = 'tower' },
        -- { model = 'prop_pc_02a', label = 'Tower PC (silver)', kind = 'tower' },
        -- { model = 'hei_prop_heist_pc_01', label = 'Tower PC (black)', kind = 'tower' },
        -- { model = 'v_res_pctower', label = 'Tower PC (rounded)', kind = 'tower' },
        { model = 'prop_laptop_01a', label = '笔记本', kind = 'laptop' },
        { model = 'p_laptop_02_s', label = '笔记本（白色键盘）', kind = 'laptop' },
        { model = 'prop_laptop_lester', label = '笔记本（浏览网页）', kind = 'laptop' },
        { model = 'prop_laptop_lester2', label = '笔记本（待机）', kind = 'laptop' },
        { model = 'prop_laptop_jimmy', label = '笔记本（Lifeinvader）', kind = 'laptop' },
        { model = 'ex_prop_ex_laptop_01a', label = '笔记本（办公）', kind = 'laptop' },
        { model = 'xm_prop_x17_laptop_lester_01', label = '游戏笔记本', kind = 'laptop' },
        { model = 'p_cs_laptop_02', label = '笔记本（黑色）', kind = 'laptop' },
        { model = 'v_ind_ss_laptop', label = '加固笔记本', kind = 'laptop' },
    },
}
