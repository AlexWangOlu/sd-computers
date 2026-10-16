import type { MockHandler } from './index';
import { ok } from './index';

// Browser mock for `browser:sites` (server/computers/browser.lua): the network exactly as the
// server sends it for the config that ships (configs/shared/browser.lua) - addresses normalised,
// every block as { type, ... } - plus one `url` site at the end, which the shipped config only has
// as a commented-out example, so the framed path can be seen in dev. Change a page there, change
// it here. What is ON the live sites is mocked in ./web.ts.

const sites = [
  { address: 'weazel.news', title: '威泽尔新闻', bookmark: true, live: 'news' },
  { address: 'marketplace.ls', title: '交易市场', bookmark: true, live: 'market' },
  { address: 'yellowpages.ls', title: '黄页', bookmark: true, live: 'pages' },
  { address: 'directory.ls', title: '商家名录', bookmark: true, live: 'directory' },
  { address: 'squawk.ls', title: '叽喳', bookmark: true, live: 'squawk' },
  { address: 'laws.gov', title: '法律与罚款', bookmark: true, live: 'laws' },
  { address: 'stocks.ls', title: '股票行情', bookmark: true, live: 'stocks' },
  {
    address: 'network.help',
    title: '这个网络如何运作',
    bookmark: true,
    blocks: [
      { type: 'heading', text: '这个网络如何运作' },
      {
        type: 'text',
        text: '这台电脑连接的是城市网络。它比你预想的要小：只有已经在网络上建好的网站才打得开，这里也没有任何东西会通到网络之外。',
      },
      { type: 'subheading', text: '打开网站' },
      {
        type: 'list',
        items: [
          '在顶部的地址栏里输入它的地址，比如 weazel.news，然后按 Enter。',
          '或者从下面那一行里挑一个书签。',
          '也可以在起始页上按名称搜索。在地址栏里输入 home 就会回到那里。',
        ],
      },
      { type: 'subheading', text: '页面导航' },
      {
        type: 'facts',
        rows: [
          { label: '后退与前进', value: '在本标签页里按顺序翻看你访问过的页面。' },
          { label: '刷新', value: '重新加载这个页面。' },
          { label: '主页', value: '打开新标签页时默认显示的页面。' },
          { label: '标签页', value: '可以同时打开多个页面，加号按钮会再开一个。' },
        ],
      },
      { type: 'subheading', text: "网站打不开时" },
      {
        type: 'text',
        text: '出现这句提示，说明这个地址不在本网络上。先检查拼写。别处的地址在这里都用不了，不管你记得多牢。',
      },
      {
        type: 'notice',
        kind: 'warning',
        title: '在共用电脑上',
        text: '你用过之后还有别人会用这台电脑，站在你身后的人也能看到屏幕。你在这里发布的内容都会署你自己的名字。',
      },
    ],
  },
  { address: 'rules.city', title: '服务器规则', bookmark: false, url: 'https://example.com' },
];

const handlers: Record<string, MockHandler> = {
  'browser:sites': () => ok({ home: 'home', sites }),
};

export default handlers;
