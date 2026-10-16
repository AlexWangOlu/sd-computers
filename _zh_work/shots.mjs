// 用 Playwright + Edge 对本地 dev 服务器批量截图，验收中文界面。
//   node _zh_work/shots.mjs [baseUrl] [outDir]
// playwright-core 装在 web/ 里，本脚本在 _zh_work/ 下，按绝对路径 require。
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire('D:/FIVEMDEV/sd-computers/web/package.json');
const { chromium } = require('playwright-core');

const base = process.argv[2] || 'http://localhost:5173';
const outDir = process.argv[3] || 'D:/FIVEMDEV/sd-computers/_zh_work/shots';
mkdirSync(outDir, { recursive: true });

const app = (style, hash) => `/os.html?style=${style}#${hash}`;

const scenes = [
  ['modern-desktop', app('modern', 'desktop')],
  ['modern-mail', app('modern', 'mail')],
  ['modern-logs', app('modern', 'logs')],
  ['modern-cmd', app('modern', 'cmd')],
  ['modern-settings', app('modern', 'settings')],
  ['modern-files', app('modern', 'files')],
  ['modern-boss', app('modern', 'boss')],
  ['modern-browser', app('modern', 'browser')],
  ['modern-bank', app('modern', 'bank')],
  ['modern-games', app('modern', 'games')],
  ['modern-board', app('modern', 'board')],
  ['modern-cameras', app('modern', 'cameras')],
  ['modern-notepad', app('modern', 'notepad')],
  ['modern-contacts', app('modern', 'contacts')],
  ['modern-photos', app('modern', 'photos')],
  ['modern-calculator', app('modern', 'calculator')],
  ['modern-messages', app('modern', 'messages')],
  ['modern-notes', app('modern', 'notes')],
  ['retro-desktop', app('retro', 'desktop')],
  ['retro-cmd', app('retro', 'cmd')],
  ['retro-games', app('retro', 'games')],
  ['mac-desktop', app('mac', 'desktop')],
  ['mac-mail', app('mac', 'mail')],
  ['mac-settings', app('mac', 'settings')],
  ['paper', '/os.html?style=modern#paper&kind=statement'],
  ['libhack', '/os.html?style=modern#lib'],
  ['admin', '/admin.html'],
];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

let bad = 0;
for (const [name, path] of scenes) {
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error') problems.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => problems.push('pageerror: ' + String(e.message).slice(0, 200)));
  try {
    await page.goto(base + path, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${outDir}/${name}.png` });
    const text = (await page.evaluate(() => document.body.innerText || '')).replace(/\s+/g, ' ').slice(0, 90);
    console.log(`${name.padEnd(18)} ${problems.length ? 'ERR ' + problems.slice(0, 2).join(' | ') : 'ok '}  ${text}`);
    if (problems.length) bad++;
  } catch (e) {
    console.log(`${name.padEnd(18)} FAILED ${String(e).slice(0, 160)}`);
    bad++;
  }
  await page.close();
}
await browser.close();
console.log(`\n${scenes.length} 场景，${bad} 个有问题 → ${outDir}`);
