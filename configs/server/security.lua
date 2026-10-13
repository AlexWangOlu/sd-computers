-- Server-only sign-in security. Never shipped to clients.
return {
    -- Per-computer PIN, keyed by the computers.lua `id`. OPTIONAL, and none is set out of the box:
    -- a computer's `groups` (its job lock) already decides who can use it, and only they are
    -- offered it. A computer listed here ALSO shows a PIN box on its sign-in screen; computers
    -- not listed sign straight in with the character's name. PINs are compared server-side only -
    -- the client never learns them.
    Pins = {
        -- mrpd_frontdesk = '1031',
        -- pillbox_reception = '4242',
    },

    -- Wrong-PIN lockout: after MaxAttempts wrong PINs in a row, that player is locked out of that
    -- computer for Lockout seconds (every failure is also written to its System Logs).
    MaxAttempts = 3,
    Lockout = 60,
}
