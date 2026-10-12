return {
    -- Optional sd-phone link. sd-computers is complete on its own: with no sd-phone on the server
    -- (or sd-phone stopped) every computer keeps its built-in Mail and nothing below does anything.
    -- When sd-phone IS started, the computer becomes another screen for the character's phone:
    --   Mail     - the Mail app opens the phone's mail accounts (same addresses, same inbox, same
    --              phone notifications) instead of sd-computers' own lsmail addresses
    --   Messages - a Messages app: the phone's text conversations, read and reply from the desk
    --   Notes    - a Notes app: the phone's notes, edited from the desk and synced back
    -- Needs sd-phone's link file (server/compat/computers.lua, loaded by its fxmanifest). Checked
    -- live on every open, so starting or stopping sd-phone mid-session just works.
    Enabled = 'auto', -- 'auto' = link whenever sd-phone is started; false = never link
    Resource = 'sd-phone', -- resource name, if you renamed it

    Mail = true, -- Mail app uses the phone's mail (false = keep sd-computers' own Mail even with sd-phone)
    Messages = true, -- add the Messages app (phone texts)
    Notes = true, -- add the Notes app (phone notes)

    -- Messages/Notes are the character's PHONE, so by default they only appear for a player who
    -- is carrying one (sd-phone's hasPhone). false = show them to everyone.
    RequirePhone = true,

    -- Computers can opt out one by one with `phone = false` in configs/shared/computers.lua (no
    -- Messages/Notes there - a police terminal, say). Mail follows the server-wide switch above so a
    -- player never sees two different inboxes.
}
