return {
    -- Optional sd-phone link. sd-computers is complete on its own: with no sd-phone on the server
    -- (or sd-phone stopped) every computer keeps its built-in Mail and nothing below does anything.
    -- When sd-phone IS started, the computer becomes another screen for the character's phone:
    --   Mail     - the Mail app opens the phone's mail accounts (same addresses, same inbox, same
    --              phone notifications) instead of sd-computers' own lsmail addresses
    --   Messages - a Messages app: the phone's text conversations, read and reply from the desk
    --   Notes    - a Notes app: the phone's notes, edited from the desk and synced back
    --   Contacts - a Contacts app: the phone's address book
    --   Photos   - the Photos app (every computer has it) shows the phone's gallery as well
    -- Needs sd-phone's link file (server/compat/computers.lua, loaded by its fxmanifest). Checked
    -- live on every open, so starting or stopping sd-phone mid-session just works.
    Enabled = 'auto', -- 'auto' = link whenever sd-phone is started; false = never link
    Resource = 'sd-phone', -- resource name, if you renamed it

    Mail = true, -- Mail app uses the phone's mail (false = keep sd-computers' own Mail even with sd-phone)
    Messages = true, -- add the Messages app (phone texts)
    Notes = true, -- add the Notes app (phone notes)
    Contacts = true, -- add the Contacts app (the phone's address book)

    -- Apps a computer has anyway, that show the phone's side as well while it is linked:
    Files = true, -- Files also lists the phone's documents
    Photos = true, -- Photos also shows the phone's gallery, to look at and to put into a document
    Bank = true, -- Bank takes its statement from the phone's banking history

    -- Phone Link. The phone's side (Messages, Notes, Contacts, its gallery in Photos and its place in Files)
    -- stay off a computer until the character has linked their phone to THAT machine: the Phone
    -- Link app sends a code to the phone as a notification, and typing it in links the two. It is
    -- remembered per character and per machine until they unlink it there. The Phone Link app is
    -- only on a computer while sd-phone is linked. false = no code and no app: the phone's apps
    -- are simply there, as before.
    RequireLink = true,
    LinkCodeMinutes = 5, -- how long a code works for

    -- Messages/Notes/Contacts and the phone's gallery are the character's PHONE, so by default they only appear for
    -- a player who is carrying one (sd-phone's hasPhone). false = show them to everyone. With
    -- RequireLink, this is whether a machine that is already linked still needs the phone nearby.
    RequirePhone = true,

    -- Computers can opt out one by one with `phone = false` in configs/shared/computers.lua (none
    -- of the phone apps there - a police terminal, say). Mail follows the server-wide switch above
    -- so a player never sees two different inboxes.
}
