-- Browser: the pages a computer can open. It is a closed network - only the sites listed here
-- exist, and an address that is not one of them "can't be reached". Nothing a player types ever
-- reaches the real internet.
--
--   Home      the address a new window (and a new tab) opens on. 'home' = the built-in start
--             page: a search box over every site below, and a tile for each bookmarked one.
--             Any address from Sites works too ('city.gov').
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
--     and ONE of these two:
--
--     blocks    a page written right here. The pieces are shown top to bottom:
--                 { heading = 'The big title' }
--                 { subheading = 'A section title' }
--                 { text = 'A paragraph.' }
--                 { list = { 'First point', 'Second point' } }
--                 { notice = 'A boxed message.', kind = 'warning', title = 'Bold lead-in' }
--                     kind: 'info' (default) | 'success' | 'warning' | 'error'. title is optional.
--                 { facts = { { 'Opens', '8:00' }, { 'Closes', '18:00' } } }
--                     a two-column table: a label and its value on every row.
--                 { links = { 'jobs.city.gov', { 'city.gov/permits', 'Permits', 'Small print' } } }
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
-- An entry with a mistake in it (no address, no title, neither blocks nor an https url, an
-- address used twice) is left out and named in the server console.
return {
    Home = 'home',

    Sites = {
        -- Your own page, embedded. Take the two dashes off and put your address in:
        -- { address = 'rules.city', title = 'Server Rules', bookmark = true, url = 'https://your-community.example/rules' },

        -- City Hall's front page.
        {
            address = 'city.gov',
            title = 'City Services',
            bookmark = true,
            blocks = {
                { heading = 'City Services' },
                { text = 'The front desk of City Hall, without the queue. Find out what the city can do for you, what to bring with you, and where to go next.' },
                { notice = 'Nothing can be paid or handed in through this site. Bring your paperwork to the counter in person.', kind = 'info', title = 'Before you visit' },

                { subheading = 'What we help with' },
                { list = {
                    'Identity cards and replacement documents',
                    'Driving licences and vehicle registration',
                    'Business permits and trading licences',
                    'Fines, invoices and payment plans',
                    'Complaints, compliments and public records',
                } },

                { subheading = 'Opening hours' },
                { facts = {
                    { 'Counter service', 'Every day, 8:00 to 18:00' },
                    { 'Licensing desk', 'Monday to Friday, 9:00 to 16:00' },
                    { 'Records office', 'By appointment' },
                    { 'Where to find us', 'City Hall, main entrance' },
                } },

                { subheading = 'More from the city' },
                { links = {
                    { 'city.gov/permits', 'Permits and licences', 'What each application needs, and how long it takes' },
                    { 'jobs.city.gov', 'Job Centre', 'Open vacancies and how to apply' },
                    { 'emergency.gov', 'Emergency guide', 'Who to call, and what to tell them' },
                } },
            },
        },

        -- A second page of the same site: not bookmarked, reached from the link above.
        {
            address = 'city.gov/permits',
            title = 'Permits and Licences',
            blocks = {
                { heading = 'Permits and licences' },
                { text = 'Most applications are decided at the counter on the day. Bring the right documents the first time and you will not need to come back.' },

                { subheading = 'What to bring' },
                { facts = {
                    { 'Identity card', 'Proof of your name and date of birth' },
                    { 'Driving licence', 'A valid identity card and a passed driving test' },
                    { 'Vehicle registration', 'Proof of ownership and a valid driving licence' },
                    { 'Business permit', 'An identity card, the address of the premises and a short description of the trade' },
                    { 'Firearms licence', 'An identity card and a clean record; decided by the police, not at the counter' },
                } },

                { subheading = 'Good to know' },
                { list = {
                    'A permit belongs to the person named on it. It cannot be lent or sold.',
                    'Tell the licensing desk if your business moves or changes hands.',
                    'A lost document is replaced at the counter for a small fee.',
                } },
                { notice = 'Trading without a permit, or driving without a licence, can cost you a fine and the right to apply again.', kind = 'warning', title = 'Stay on the right side of it' },
            },
        },

        -- The Job Centre.
        {
            address = 'jobs.city.gov',
            title = 'Job Centre',
            bookmark = true,
            blocks = {
                { heading = 'Job Centre' },
                { text = 'Looking for work, or looking for workers? Start here. The Job Centre keeps the list of who is hiring and helps you take the first step.' },

                { subheading = 'Work you can start this week' },
                { text = 'These jobs need no experience. Most ask only for an identity card, and a driving licence if there is a vehicle involved.' },
                { list = {
                    'Delivery and courier driving',
                    'Taxi and private hire',
                    'Refuse and recycling collection',
                    'Vehicle recovery and towing',
                    'Warehouse and dock work',
                } },

                { subheading = 'How to apply' },
                { list = {
                    'Ask at the Job Centre counter for the current list of vacancies.',
                    'Pick the job that suits you and sign on. Bring your identity card.',
                    'Collect your work vehicle or uniform where the job starts.',
                    'You are paid for the work you finish, so there is no harm in trying a few.',
                } },
                { notice = 'The police, the ambulance service and the city\'s mechanics take applications all year. Ask at their front desk for a form.', kind = 'success', title = 'Public services are hiring' },

                { subheading = 'For employers' },
                { text = 'Running a business? You hire, promote and let go of your staff yourself, from the Business Manager on your work computer. The Job Centre can put up a notice for you: speak to the counter.' },
                { links = {
                    { 'city.gov/permits', 'Permits and licences', 'The documents most jobs ask for' },
                    'city.gov',
                } },
            },
        },

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
                    'Type its address in the bar at the top, such as city.gov, and press Enter.',
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

                { notice = 'Other people use this computer after you, and anyone standing behind you can read the screen. Sign out of your accounts before you walk away.', kind = 'warning', title = 'On a shared computer' },
                { links = { 'city.gov', 'jobs.city.gov', 'emergency.gov' } },
            },
        },

        -- What to do in an emergency.
        {
            address = 'emergency.gov',
            title = 'Emergency Guide',
            bookmark = true,
            blocks = {
                { heading = 'Emergency guide' },
                { notice = 'Do not report it here. Call the emergency services from your phone, or shout for help.', kind = 'error', title = 'In danger right now?' },

                { subheading = 'When to call' },
                { list = {
                    'Someone is badly hurt, unconscious or not breathing.',
                    'A crime is happening now, or someone is in danger.',
                    'A fire, a serious crash, or anything else that could hurt more people.',
                } },

                { subheading = 'What to tell them' },
                { facts = {
                    { 'Where', 'The street, and a landmark or business close by' },
                    { 'What', 'What happened, in one sentence' },
                    { 'Who', 'How many people are involved, and how many are hurt' },
                    { 'You', 'Your name, and whether you are safe where you are' },
                } },

                { subheading = 'While you wait' },
                { list = {
                    'Stay on the line until you are told you can hang up.',
                    'Get yourself to safety if you can, and keep other people back.',
                    'Do not move someone who is injured unless they are in danger where they lie.',
                    'Wave the responders down when you see them.',
                } },

                { subheading = 'Not an emergency?' },
                { text = 'For lost property, noise, an old report or a general question, go to the front desk of the nearest police station. It keeps the emergency line free for the people who need it.' },
                { links = { { 'city.gov', 'City Services', 'Opening hours and what City Hall helps with' } } },
            },
        },
    },
}
