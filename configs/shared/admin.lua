-- Admin panel + placement tool. Both are the ones sd-bombs and sd-scooters use, so they look and handle the same.
return {
    Command = 'computeradmin', -- chat command that opens the panel; the ace it grants is command.computeradmin
    Group = 'group.admin', -- ace principal with full access: the command, every read and every change
    ViewGroup = false, -- optional ace principal (e.g. 'group.mod') that can open the panel and look, but not change anything
    EditAce = 'sd_computers.edit', -- the ace every change needs; granted to Group automatically, add it to other principals to let them edit

    PlaceReach = 25.0, -- metres ahead of the camera a new placement starts when nothing closer is in view
    Placement = { -- the placement gizmo
        SnapMove = 0.25, -- metres per step while snapping is on (X)
        SnapTurn = 15.0, -- degrees per step while snapping is on
        Nudge = 0.05, -- metres per frame the arrow keys / Page Up / Page Down move it (Shift x5)
        TurnStep = 5.0, -- degrees per mouse-wheel notch (Shift + wheel: 15, Ctrl + wheel: 1)
    },

    RefreshMs = 5000, -- ms between snapshot refreshes while the panel is open (who is sitting at which computer)
    SpawnDistance = 60.0, -- metres from a placed computer its prop is spawned at (every client spawns its own)
    MaxLabel = 48, -- longest name a placed computer can be given

    -- The props a computer can be placed as. `kind` only picks the icon the panel falls back to when a
    -- prop has no picture: 'monitor' | 'tower' | 'laptop'. The picture is web/public/props/<model>.jpg
    -- (the ones here are photographs taken in the game; rebuild the UI after adding one), or set
    -- `image = 'https://...'` to use any other. Add any streamed prop here; a model the game does not
    -- have is refused when placed.
    -- A prop that is ALSO a model computer in configs/shared/computers.lua is fine: a placed one answers as itself only.
    Props = {
        { model = 'prop_monitor_01a', label = 'Flat monitor', kind = 'monitor' },
        { model = 'prop_monitor_01b', label = 'Flat monitor (off)', kind = 'monitor' },
        { model = 'prop_monitor_02', label = 'HD monitor', kind = 'monitor' },
        { model = 'prop_monitor_03b', label = 'CRT monitor', kind = 'monitor' },
        { model = 'prop_monitor_w_large', label = 'Widescreen monitor', kind = 'monitor' },
        { model = 'prop_dyn_pc', label = 'Tower PC', kind = 'tower' },
        { model = 'prop_dyn_pc_02', label = 'Tower PC (dark)', kind = 'tower' },
        { model = 'prop_pc_01a', label = 'Tower PC (beige)', kind = 'tower' },
        { model = 'prop_pc_02a', label = 'Tower PC (silver)', kind = 'tower' },
        { model = 'prop_laptop_01a', label = 'Laptop', kind = 'laptop' },
        { model = 'p_laptop_02_s', label = 'Laptop (white keys)', kind = 'laptop' },
        { model = 'prop_laptop_lester', label = 'Laptop (browsing)', kind = 'laptop' },
        { model = 'prop_laptop_lester2', label = 'Laptop (idle)', kind = 'laptop' },
    },
}
