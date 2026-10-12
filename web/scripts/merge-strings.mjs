// Merge every app's strings fragment (src/apps/<app>/strings.en.json), every shell style's
// (src/os/<style>/strings.en.json) and the admin panel's (src/admin/strings.en.json) into
// ../locales/en.json under ui.<app> / ui.<style> / ui.admin. Idempotent: re-running always rebuilds each ui.<app> subtree from its fragment.
// Usage (from web/): node scripts/merge-strings.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const localeFile = join(web, '..', 'locales', 'en.json');
const appsDir = join(web, 'src', 'apps');
const osDir = join(web, 'src', 'os');

const en = JSON.parse(readFileSync(localeFile, 'utf8'));
en.ui = en.ui || {};
const merged = [];
for (const dir of [appsDir, osDir]) {
  for (const name of readdirSync(dir)) {
    const frag = join(dir, name, 'strings.en.json');
    if (!existsSync(frag)) continue;
    en.ui[name] = JSON.parse(readFileSync(frag, 'utf8'));
    merged.push(name);
  }
}
const adminFrag = join(web, 'src', 'admin', 'strings.en.json');
if (existsSync(adminFrag)) {
  en.ui.admin = JSON.parse(readFileSync(adminFrag, 'utf8'));
  merged.push('admin');
}
writeFileSync(localeFile, JSON.stringify(en, null, 2) + '\n', 'utf8');
console.log(`merged ui strings for: ${merged.join(', ') || '(none)'}`);
