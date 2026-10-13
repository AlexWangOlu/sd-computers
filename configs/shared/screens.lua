-- Screens: what a computer shows on its prop, out in the world. Every computer whose prop has a
-- screen gets one drawn on it: its style's lock face while nobody is using it, and a live copy of
-- the desktop while somebody is - so people standing nearby can see what is happening on it.
-- Tower PCs have no screen and are left alone; a location computer (a box zone) shows on the
-- screen prop standing inside its zone, when there is one.
return {
    Enabled = true, -- false = no screens at all: props keep their stock look and nothing of a session is shared

    Distance = 12.0, -- metres a screen is drawn from (the server checks the same distance before it shares a session)
    MaxScreens = 12, -- most screens drawn at once, nearest first
    MaxLive = 3, -- most computers IN USE mirrored at once, nearest first (each one is a browser of its own)
    Resolution = { w = 1024, h = 576 }, -- texture every screen is drawn at (px): lower is cheaper, higher is sharper up close

    -- What a computer nobody is using shows:
    --   'lock' - its style's lock face (one shared browser per style, however many screens show it)
    --   'off'  - nothing: the prop keeps its stock texture until somebody sits down at it
    Idle = 'lock',

    -- The live copy of a computer in use. PIN and password fields are always masked, and the
    -- /computeradmin panel is never part of it.
    Mirror = {
        Enabled = true, -- false = a computer in use keeps showing its lock face (nothing of the session leaves the player's game)
        CanvasFps = 3, -- frames a second the hack minigames are sampled at (0 = their window shows, the game inside it does not)
        MaxWatchers = 12, -- most players one session is shared with at a time
        Self = false, -- also draw your OWN session on the prop, for testing with one client (needs Interact.View = 'fullscreen': at the screen, your own prop is behind your desktop)
    },

    -- Where the screen is on each prop: a flat rectangle, measured from the prop's origin with the
    -- screen facing you (x = right, y = away from you, z = up). A model that is not listed gets no
    -- screen. For a prop of your own there is no need to measure anything: /computeradmin > Props >
    -- "Draw screen" opens a tool that draws the rectangle on the prop with the mouse. What is drawn
    -- there is kept in the database and wins over this list; C in the tool copies it as a line for
    -- this list, should it belong in the file instead.
    -- By hand: put it ON the glass (in front of it, it floats when
    -- seen from the side) and, where the glass sits back in a bezel, make it a few millimetres too
    -- large: the bezel hides the overlap, and none of the prop's own screen shows around the edge.
    --   centre   vec3 - the middle of the lit area
    --   size     vec2 - its width and height, metres
    --   tilt     number - degrees the screen leans back (a laptop lid, a monitor on its stand). default 0
    --   heading  number - degrees the screen is turned from the prop's front, for a model that faces another way. default 0
    Models = {
        prop_monitor_01a = { centre = vec3(-0.0015, -0.066, 0.313), size = vec2(0.429, 0.315), tilt = 4.9 },
        prop_monitor_01b = { centre = vec3(-0.0023, -0.066, 0.3124), size = vec2(0.4786, 0.3235), tilt = 4.9 },
        prop_monitor_02 = { centre = vec3(-0.0027, -0.064, 0.2773), size = vec2(0.4145, 0.3124), tilt = 4.8 },
        prop_monitor_03b = { centre = vec3(0.0018, -0.2765, 0.2771), size = vec2(0.43, 0.314) },
        prop_monitor_w_large = { centre = vec3(0.0013, -0.075, 0.3977), size = vec2(0.7714, 0.4681) },
        prop_laptop_01a = { centre = vec3(-0.0005, 0.0648, 0.1378), size = vec2(0.334, 0.201), tilt = 15.8 },
        p_laptop_02_s = { centre = vec3(-0.0026, 0.068, 0.1395), size = vec2(0.3405, 0.2055), tilt = 15.4 },
        prop_laptop_lester = { centre = vec3(-0.0021, 0.0672, 0.1367), size = vec2(0.3405, 0.2055), tilt = 15.4 },
        prop_laptop_lester2 = { centre = vec3(-0.0021, 0.0672, 0.1367), size = vec2(0.3405, 0.2055), tilt = 15.4 },

        prop_monitor_01c = { centre = vec3(-0.0017, -0.0621, 0.272), size = vec2(0.4342, 0.2994), tilt = 5.0 },
        prop_monitor_01d = { centre = vec3(-0.0014, -0.0701, 0.2848), size = vec2(0.4244, 0.283), tilt = 5.0 },
        prop_monitor_04a = { centre = vec3(0.001, -0.0815, 0.3997), size = vec2(0.7742, 0.4693), tilt = 2.2 },
        xm_prop_x17_computer_02 = { centre = vec3(0.001, -0.0815, 0.3997), size = vec2(0.7742, 0.4693), tilt = 2.2 },
        prop_ld_monitor_01 = { centre = vec3(0.0, -0.0402, 0.2828), size = vec2(0.4131, 0.2871), tilt = 5.0 },
        -- (the all-in-ones have glass edge to edge: these are their lit area, not an opening in a bezel)
        ex_prop_monitor_01_ex = { centre = vec3(0.0005, -0.0162, 0.3413), size = vec2(0.8075, 0.4521), tilt = 4.8 },
        vw_prop_vw_monitor_01 = { centre = vec3(0.0005, -0.0162, 0.3413), size = vec2(0.8075, 0.4521), tilt = 4.8 },
        sm_prop_smug_monitor_01 = { centre = vec3(0.0004, -0.0265, 0.3415), size = vec2(0.5945, 0.335), tilt = 10.2 },
        p_cs_laptop_02 = { centre = vec3(-0.0009, 0.0652, 0.1975), size = vec2(0.3782, 0.2516), tilt = 10.3 },
        p_amb_lap_top_02 = { centre = vec3(-0.0009, 0.0652, 0.1975), size = vec2(0.3782, 0.2516), tilt = 10.3 },
        v_ind_ss_laptop = { centre = vec3(0.0019, 0.1628, 0.0225), size = vec2(0.4859, 0.2668), tilt = 9.8 },

        -- The control room monitors: one shape, seven things on screen (their origin is mid-screen, not the base).
        v_serv_ct_monitor01 = { centre = vec3(0.0009, -0.0428, 0.0729), size = vec2(0.3656, 0.2761), tilt = 4.6 },
        v_serv_ct_monitor02 = { centre = vec3(0.0009, -0.0428, 0.0729), size = vec2(0.3656, 0.2761), tilt = 4.6 },
        v_serv_ct_monitor03 = { centre = vec3(0.0009, -0.0428, 0.0729), size = vec2(0.3656, 0.2761), tilt = 4.6 },
        v_serv_ct_monitor04 = { centre = vec3(0.0009, -0.0428, 0.0729), size = vec2(0.3656, 0.2761), tilt = 4.6 },
        v_serv_ct_monitor05 = { centre = vec3(0.0009, -0.0428, 0.0729), size = vec2(0.3656, 0.2761), tilt = 4.6 },
        v_serv_ct_monitor06 = { centre = vec3(0.0009, -0.0428, 0.0729), size = vec2(0.3656, 0.2761), tilt = 4.6 },
        v_serv_ct_monitor07 = { centre = vec3(0.0009, -0.0428, 0.0729), size = vec2(0.3656, 0.2761), tilt = 4.6 },

        -- Props the same shape as one above with something else on screen. Some are not on the placing
        -- list (configs/shared/admin.lua > Props), but are measured, so one added from the panel has its screen.
        ch_prop_ch_monitor_01a = { centre = vec3(-0.0015, -0.066, 0.313), size = vec2(0.429, 0.315), tilt = 4.9 }, -- (prop_monitor_01a)
        prop_monitor_li = { centre = vec3(-0.0023, -0.066, 0.3124), size = vec2(0.4786, 0.3235), tilt = 4.9 }, -- (prop_monitor_01b)
        tr_prop_tr_monitor_01a = { centre = vec3(-0.0023, -0.066, 0.3124), size = vec2(0.4786, 0.3235), tilt = 4.9 },
        tr_prop_tr_monitor_01b = { centre = vec3(-0.0023, -0.066, 0.3124), size = vec2(0.4786, 0.3235), tilt = 4.9 },
        prop_laptop_jimmy = { centre = vec3(-0.0021, 0.0672, 0.1367), size = vec2(0.3405, 0.2055), tilt = 15.4 }, -- (prop_laptop_lester)
        ex_prop_ex_laptop_01a = { centre = vec3(-0.0021, 0.0672, 0.1367), size = vec2(0.3405, 0.2055), tilt = 15.4 },
        xm_prop_x17_laptop_lester_01 = { centre = vec3(-0.0021, 0.0672, 0.1367), size = vec2(0.3405, 0.2055), tilt = 15.4 },
        xm_prop_x17_laptop_agent14_01 = { centre = vec3(-0.0021, 0.0672, 0.1367), size = vec2(0.3405, 0.2055), tilt = 15.4 },
        xm_prop_x17_laptop_avon = { centre = vec3(-0.0021, 0.0672, 0.1367), size = vec2(0.3405, 0.2055), tilt = 15.4 },
        gr_prop_gr_laptop_01a = { centre = vec3(-0.0021, 0.0672, 0.1367), size = vec2(0.3405, 0.2055), tilt = 15.4 },
        gr_prop_gr_laptop_01c = { centre = vec3(-0.0021, 0.0672, 0.1367), size = vec2(0.3405, 0.2055), tilt = 15.4 },
        ch_prop_laptop_01a = { centre = vec3(-0.0021, 0.0672, 0.1367), size = vec2(0.3405, 0.2055), tilt = 15.4 },
        m23_1_prop_m31_laptop_01a = { centre = vec3(-0.0005, 0.0648, 0.1378), size = vec2(0.334, 0.201), tilt = 15.8 }, -- (prop_laptop_01a)
        xm3_prop_xm3_laptop_01a = { centre = vec3(-0.0005, 0.0648, 0.1378), size = vec2(0.334, 0.201), tilt = 15.8 },
    },
}
