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

    -- Typing animation while the computer is open (flag 49 = upper body, so the player can still
    -- turn). false = no animation.
    Anim = {
        dict = 'anim@heists@prison_heiststation@cop_reactions',
        clip = 'cop_b_idle',
    },

    -- Debug-only helper (config.Debug = true): `/computer_pos` copies the coords you're aiming at
    -- to the clipboard as a ready-to-paste `coords = vec3(...)` line for computers.lua.
    PosCommand = 'computer_pos',
}
