-- Photos: the character's pictures, on every computer. A picture is added by its link, roams
-- with the character to every other computer (like their documents), and is what Files puts into a
-- document. With sd-phone linked, the phone's gallery shows beside them
-- (configs/shared/phone.lua > Photos).
return {
    Enabled = true, -- false = no Photos app, and no pictures in documents
    MaxPhotos = 200, -- most pictures one character can keep

    -- The hosts a picture may be linked from. A linked picture is fetched by the game of everyone who
    -- looks at it - and a document with a picture in it can be printed and handed to anybody - so an
    -- open list would let a player learn another player's IP address by handing them a page. Keep
    -- this to image hosts you trust. A host also covers its subdomains. false = any https address.
    -- (The phone's own gallery is always allowed: those pictures were uploaded by your server.)
    Hosts = {
        'imgur.com',
        'fivemanage.com',
        'fmfile.com',
        'discordapp.com',
        'discordapp.net',
        'ibb.co',
        'postimg.cc',
        'catbox.moe',
        'gyazo.com',
    },
}
