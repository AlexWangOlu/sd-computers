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
        { address = 'weazel.news', title = '威泽尔新闻', bookmark = true, live = 'news' },
        { address = 'marketplace.ls', title = '交易市场', bookmark = true, live = 'market' },
        { address = 'yellowpages.ls', title = '黄页', bookmark = true, live = 'pages' },
        { address = 'directory.ls', title = '商家名录', bookmark = true, live = 'directory' },
        { address = 'squawk.ls', title = '叽喳', bookmark = true, live = 'squawk' },
        { address = 'laws.gov', title = '法律与罚款', bookmark = true, live = 'laws' },
        { address = 'stocks.ls', title = '股票行情', bookmark = true, live = 'stocks' },

        -- Help: what this browser is and how to use it.
        {
            address = 'network.help',
            title = '这个网络如何运作',
            bookmark = true,
            blocks = {
                { heading = '这个网络如何运作' },
                { text = '这台电脑连接的是城市网络。它比你预想的要小：只有已经在网络上建好的网站才打得开，这里也没有任何东西会通到网络之外。' },

                { subheading = '打开网站' },
                { list = {
                    '在顶部的地址栏里输入它的地址，比如 weazel.news，然后按 Enter。',
                    '或者从下面那一行里挑一个书签。',
                    '也可以在起始页上按名称搜索。在地址栏里输入 home 就会回到那里。',
                } },

                { subheading = '页面导航' },
                { facts = {
                    { '后退与前进', '在本标签页里按顺序翻看你访问过的页面。' },
                    { '刷新', '重新加载这个页面。' },
                    { '主页', '打开新标签页时默认显示的页面。' },
                    { '标签页', '可以同时打开多个页面，加号按钮会再开一个。' },
                } },

                { subheading = '网站打不开时' },
                { text = '出现这句提示，说明这个地址不在本网络上。先检查拼写。别处的地址在这里都用不了，不管你记得多牢。' },

                { notice = '你用过之后还有别人会用这台电脑，站在你身后的人也能看到屏幕。你在这里发布的内容都会署你自己的名字。', kind = 'warning', title = '在共用电脑上' },
            },
        },
    },
}
