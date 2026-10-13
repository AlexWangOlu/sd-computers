-- Browser: the pages a computer can open. It is a closed network - only the sites listed here
-- exist, and an address that is not one of them "can't be reached". Nothing a player types ever
-- reaches the real internet.
--
--   Home      the address a new window (and a new tab) opens on. 'home' = the built-in start
--             page: a search box over every site below, and a tile for each bookmarked one.
--             Any address from Sites works too ('weazel.news').
--
--   Sites     one entry per page. Field reference:
--
--     address   what is typed, and what the address bar shows: 'city.gov'. It is made up - it
--               does not have to exist anywhere. Lower case, no spaces, no 'https://', no 'www.'.
--               A second page of the same site is simply another entry with a longer address
--               ('city.gov/permits'); it gets a link back up to 'city.gov' by itself.
--     title     the page's name: on its tab, on its bookmark and in search.
--     bookmark  true = on the bookmarks bar and the start page. Left out = reached by typing
--               the address, by searching for it, or through a link on another page.
--
--     and ONE of these three:
--
--     live      one of sd-phone's public apps, as a site. The address and the title are yours;
--               what is on it is whatever the phone shows right now, and it changes as the city
--               does. Each of these needs sd-phone running with its computer link (v2 or newer)
--               and that app switched on there - a site whose app is not there is simply not on
--               the network, and comes back when it is.
--                 'news'       Weazel News: the breaking line, the stories, and - for players the
--                              phone counts as Weazel staff - the newsroom, to write them in.
--                 'market'     Marketplace: every listing, with its price, its photos and how to
--                              reach the seller. Players put up and take down their own.
--                 'pages'      Yellow Pages: the same for adverts (no prices).
--                 'directory'  the companies the phone lists, whether anybody is in, and a box to
--                              write to them (their answer comes to the player's phone).
--                 'squawk'     Squawk (Birdy): the public feed, what is trending, and anybody's
--                              page. To read.
--                 'laws'       the penal code as the police terminal has it: every charge, its
--                              fine and its sentence. Open to everyone here.
--                 'stocks'     the stock market: prices and how they have moved. Only while the
--                              phone's Stocks app is switched on (off, its prices never move).
--               Reading is for anyone; none of it needs a phone. Posting is done as the player at
--               the desk under the phone's own rules. A photo on a post has to come out of their
--               phone's gallery, so the photo picker is only there while their phone is linked to
--               that computer (the Phone Link app), and so are the Message and Email buttons.
--     blocks    a page written right here. The pieces are shown top to bottom:
--                 { heading = 'The big title' }
--                 { subheading = 'A section title' }
--                 { text = 'A paragraph.' }
--                 { list = { 'First point', 'Second point' } }
--                 { notice = 'A boxed message.', kind = 'warning', title = 'Bold lead-in' }
--                     kind: 'info' (default) | 'success' | 'warning' | 'error'. title is optional.
--                 { facts = { { 'Opens', '8:00' }, { 'Closes', '18:00' } } }
--                     a two-column table: a label and its value on every row.
--                 { links = { 'weazel.news', { 'laws.gov', 'The law', 'Small print' } } }
--                     links to other pages by their address. A bare address shows that page's
--                     title; { address, label, small print } says it your own way.
--                 { image = 'https://...', caption = 'A line under the picture' }
--                     https only. caption is optional.
--     url       'https://...' - your OWN real web page (rules, wiki, forum), shown inside the
--               browser. https only. The site must allow being embedded in another page: one
--               that sends an X-Frame-Options or frame-ancestors header (most big sites do)
--               shows up blank or refuses to connect. The address bar keeps showing the in-game
--               `address`. Links on that page work inside the browser; it cannot open windows
--               of its own.
--
-- An entry with a mistake in it (no address, no title, none of live / blocks / an https url, an
-- address used twice) is left out and named in the server console.
return {
    Home = 'home',

    Sites = {
        -- Your own page, embedded. Take the two dashes off and put your address in:
        -- { address = 'rules.city', title = 'Server Rules', bookmark = true, url = 'https://your-community.example/rules' },

        -- The city, live from sd-phone. Rename, re-address or take out any of them.
        { address = 'weazel.news', title = 'Weazel News', bookmark = true, live = 'news' },
        { address = 'marketplace.ls', title = 'Marketplace', bookmark = true, live = 'market' },
        { address = 'yellowpages.ls', title = 'Yellow Pages', bookmark = true, live = 'pages' },
        { address = 'directory.ls', title = 'Business Directory', bookmark = true, live = 'directory' },
        { address = 'squawk.ls', title = 'Squawk', bookmark = true, live = 'squawk' },
        { address = 'laws.gov', title = 'Laws and Fines', bookmark = true, live = 'laws' },
        { address = 'stocks.ls', title = 'Stock Market', bookmark = true, live = 'stocks' },

        -- Help: what this browser is and how to use it.
        {
            address = 'network.help',
            title = 'How This Network Works',
            bookmark = true,
            blocks = {
                { heading = 'How this network works' },
                { text = 'This computer is connected to the city network. It is smaller than you might expect: only sites that have been set up on the network can be opened, and nothing here leads outside it.' },

                { subheading = 'Opening a site' },
                { list = {
                    'Type its address in the bar at the top, such as weazel.news, and press Enter.',
                    'Or pick a bookmark from the row underneath.',
                    'Or search by name on the start page. Typing home in the address bar takes you there.',
                } },

                { subheading = 'Finding your way around' },
                { facts = {
                    { 'Back and Forward', 'Step through the pages you have visited in this tab' },
                    { 'Reload', 'Load the page again' },
                    { 'Home', 'Go to the page a new tab opens on' },
                    { 'Tabs', 'Keep several pages open at once. The plus button opens another' },
                } },

                { subheading = 'When a site can\'t be reached' },
                { text = 'That message means the address is not on this network. Check the spelling first. Addresses from anywhere else will not work, however well you remember them.' },

                { notice = 'Other people use this computer after you, and anyone standing behind you can read the screen. What you post from here goes up under your own name.', kind = 'warning', title = 'On a shared computer' },
            },
        },
    },
}
