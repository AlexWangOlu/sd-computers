return {
    -- The target option on every computer (location zones and prop models alike).
    Target = {
        label = 'Use Computer',
        icon = 'fas fa-desktop',
        distance = 1.8, -- metres from the zone/prop the option shows at
    },

    -- How far the player may drift from the computer before it closes itself (metres). The
    -- server re-checks the same distance (+ a little slack) on every action.
    MaxDistance = 2.5,

    -- How the desktop is shown while a computer is in use:
    --   'screen'     - the camera goes up to the prop and the desktop sits inside its screen, framed
    --                  by the prop's own bezel, with the room still there around it
    --   'fullscreen' - the desktop covers the whole game window
    -- A computer with no screen to go to is fullscreen either way: a tower PC, a zone with no
    -- monitor standing in it, a laptop opened from a script with no prop. Which props have a screen,
    -- and where on them it is, is configs/shared/screens.lua (Models).
    View = 'screen',

    -- The camera of the 'screen' view.
    Camera = {
        Fill = 0.76, -- how much of the window's height the prop's screen takes (0.3-0.95): the rest is bezel and room
        Fov = 40.0, -- field of view, degrees: the wider it is, the more of the room is in the picture
        Ease = 600, -- ms the camera takes to get to the screen, and back
        HideRadar = true, -- put the minimap away while at the screen
    },

    -- Typing animation while the computer is open (flag 49 = upper body, so the player can still
    -- turn). false = no animation.
    Anim = {
        dict = 'anim@heists@prison_heiststation@cop_reactions',
        clip = 'cop_b_idle',
    },

    -- Debug-only helper (config.Debug = true): `/computer_pos` copies the coords you're aiming at
    -- to the clipboard as a ready-to-paste `coords = vec3(...)` line for computers.lua.
    PosCommand = 'computer_pos',
    -- The same for a security camera (configs/shared/cameras.lua): `/computer_cam` copies where
    -- your view is and the way it faces as a ready-to-paste `coords = ..., rot = ..., fov = ...` line.
    CamCommand = 'computer_cam',
}
