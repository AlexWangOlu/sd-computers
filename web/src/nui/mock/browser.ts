import type { MockHandler } from './index';
import { ok } from './index';

// Browser mock for `browser:sites` (server/computers/browser.lua): the network exactly as the
// server sends it for the config that ships (configs/shared/browser.lua) - addresses normalised,
// every block as { type, ... } - plus one `url` site at the end, which the shipped config only has
// as a commented-out example, so the framed path can be seen in dev. Change a page there, change
// it here. What is ON the live sites is mocked in ./web.ts.

const sites = [
  { address: 'weazel.news', title: 'Weazel News', bookmark: true, live: 'news' },
  { address: 'marketplace.ls', title: 'Marketplace', bookmark: true, live: 'market' },
  { address: 'yellowpages.ls', title: 'Yellow Pages', bookmark: true, live: 'pages' },
  { address: 'directory.ls', title: 'Business Directory', bookmark: true, live: 'directory' },
  { address: 'squawk.ls', title: 'Squawk', bookmark: true, live: 'squawk' },
  { address: 'laws.gov', title: 'Laws and Fines', bookmark: true, live: 'laws' },
  { address: 'stocks.ls', title: 'Stock Market', bookmark: true, live: 'stocks' },
  {
    address: 'network.help',
    title: 'How This Network Works',
    bookmark: true,
    blocks: [
      { type: 'heading', text: 'How this network works' },
      {
        type: 'text',
        text: 'This computer is connected to the city network. It is smaller than you might expect: only sites that have been set up on the network can be opened, and nothing here leads outside it.',
      },
      { type: 'subheading', text: 'Opening a site' },
      {
        type: 'list',
        items: [
          'Type its address in the bar at the top, such as weazel.news, and press Enter.',
          'Or pick a bookmark from the row underneath.',
          'Or search by name on the start page. Typing home in the address bar takes you there.',
        ],
      },
      { type: 'subheading', text: 'Finding your way around' },
      {
        type: 'facts',
        rows: [
          { label: 'Back and Forward', value: 'Step through the pages you have visited in this tab' },
          { label: 'Reload', value: 'Load the page again' },
          { label: 'Home', value: 'Go to the page a new tab opens on' },
          { label: 'Tabs', value: 'Keep several pages open at once. The plus button opens another' },
        ],
      },
      { type: 'subheading', text: "When a site can't be reached" },
      {
        type: 'text',
        text: 'That message means the address is not on this network. Check the spelling first. Addresses from anywhere else will not work, however well you remember them.',
      },
      {
        type: 'notice',
        kind: 'warning',
        title: 'On a shared computer',
        text: 'Other people use this computer after you, and anyone standing behind you can read the screen. What you post from here goes up under your own name.',
      },
    ],
  },
  { address: 'rules.city', title: 'Server Rules', bookmark: false, url: 'https://example.com' },
];

const handlers: Record<string, MockHandler> = {
  'browser:sites': () => ok({ home: 'home', sites }),
};

export default handlers;
