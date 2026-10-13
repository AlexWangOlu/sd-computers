-- Printers. A printer is a prop an admin stands in the world (/computeradmin > Printers), or one
-- the game already has there, picked in the same tab. The computers near it print to it: a page
-- waits in its tray until somebody walks over and takes it, and what they are handed is an item
-- (Item below) that names the page in its tooltip and opens as the page when it is used.
return {
    Enabled = true, -- false = nothing prints: no Print in the apps, nothing to take from a printer

    -- The inventory item a printout is. It has to exist in your inventory (README > Printers has
    -- the entry to paste). Its metadata carries the page's id, its title for the item's name, and
    -- who printed it, when and from which machine for the tooltip.
    Item = 'printed_document',

    Range = 30.0, -- metres from a computer a printer may stand and still be printed to from it
    MaxCopies = 5, -- most copies of a page in one go
    PageSeconds = 2.5, -- seconds each copy takes to come out; it cannot be taken sooner
    TrayLimit = 25, -- copies a printer holds uncollected; a full one prints nothing more
    TrayMinutes = 60, -- minutes an uncollected copy waits before it is thrown away (0 = it waits for ever)
    OwnOnly = false, -- true = only whoever printed a page may take it from the tray
    MaxChars = 20000, -- longest text a page holds
    KeepDays = 0, -- days a page can still be read after it was printed (0 = for ever); past that the item opens faded

    ReadAnimation = true, -- the character looks down at a clipboard while a page is open

    -- A document written in Files can have lines to sign on. Whoever holds the printed page signs a
    -- line (drawn with the mouse or typed, and kept for next time) and hands the page on for the
    -- next. The name and the date under a signature are the server's, not the player's to choose.
    -- false = the lines still print, but nobody can sign them.
    Signatures = true,

    -- The option a printer gets (ox_target / qb-target / qtarget).
    Target = { label = 'Take printouts', icon = 'fas fa-print', distance = 1.8 },

    -- The props a printer can be placed as, and the ones "Pick existing prop" takes from the world.
    -- Add any streamed prop; a model the game does not have is refused when placed. The panel shows
    -- web/public/props/<model>.jpg for each (the ones here are photographs taken in the game; rebuild
    -- the UI after adding one), or set `image = 'https://...'`; with neither it shows an icon.
    Props = {
        { model = 'prop_printer_01', label = 'Laser printer' },
        { model = 'prop_printer_02', label = 'Desktop printer' },
        { model = 'v_res_printer', label = 'Home printer' },
        { model = 'prop_copier_01', label = 'Photocopier' },
    },
}
