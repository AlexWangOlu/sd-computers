import type { MockHandler } from './index';
import { fail, ok } from './index';
import type { ListData, Photo } from '@/apps/photos/types';

// Browser mock for photos:list (server/computers/photos.lua over sd-phone's getPhotos export):
// the gallery newest first, times in unix seconds, read-only. The pictures are inline SVG so the
// dev page draws them offline; the real ones are https URLs on the server's media host.
//
// Dev switches (browser console, then press Refresh in the app):
//   window.__phoneDown = true               fails like a dropped sd-phone link (as in Messages;
//                                           localStorage['mock:phonelink'] = 'down' works too)
//   localStorage['mock:photos'] = 'empty'   a phone with no photos
//   localStorage['mock:photos'] = 'video'   adds a clip (it can't play offline: the viewer says so)
//   localStorage['mock:photos'] = 'broken'  adds a photo whose picture won't load
//   localStorage['mock:photos'] = 'full'    flags the list as cut off at the phone's page size

const UNAVAILABLE = 'The phone link is unavailable right now.';

const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** The phone's clock: unix seconds. */
const T0 = Math.floor(Date.now() / 1000);
const ago = (secs: number): number => T0 - secs;

// ── Pictures ────────────────────────────────────────────────────────────────────────────────

const svg = (body: string): string =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 400 300">${body}</svg>`);

const sky = (top: string, low: string): string =>
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${low}"/></linearGradient></defs>` +
  '<rect width="400" height="300" fill="url(#g)"/>';

/** The sun going down behind two rows of hills. */
const hills = (top: string, low: string, sun: string, land: string): string =>
  svg(
    sky(top, low) +
      `<circle cx="286" cy="150" r="38" fill="${sun}"/>` +
      `<path d="M0 214l70-58 62 40 78-70 92 78 98-52v148H0z" fill="${land}" opacity=".7"/>` +
      `<path d="M0 248l96-44 84 34 104-50 116 56v56H0z" fill="${land}"/>`,
  );

/** A city block after dark: towers with a few windows lit. */
const city = (top: string, low: string, tower: string, lit: string): string =>
  svg(
    sky(top, low) +
      `<g fill="${tower}"><rect x="18" y="150" width="58" height="150"/><rect x="88" y="96" width="52" height="204"/><rect x="152" y="176" width="70" height="124"/>` +
      '<rect x="234" y="70" width="46" height="230"/><rect x="292" y="132" width="64" height="168"/><rect x="364" y="188" width="36" height="112"/></g>' +
      `<g fill="${lit}"><rect x="30" y="168" width="10" height="12"/><rect x="52" y="204" width="10" height="12"/><rect x="100" y="116" width="10" height="12"/>` +
      '<rect x="118" y="160" width="10" height="12"/><rect x="100" y="214" width="10" height="12"/><rect x="170" y="196" width="10" height="12"/><rect x="198" y="236" width="10" height="12"/>' +
      '<rect x="246" y="92" width="10" height="12"/><rect x="258" y="150" width="10" height="12"/><rect x="246" y="208" width="10" height="12"/><rect x="306" y="152" width="10" height="12"/>' +
      '<rect x="332" y="196" width="10" height="12"/><rect x="374" y="208" width="10" height="12"/></g>',
  );

/** The sea, from the sand. */
const shore = (top: string, low: string, sea: string, sand: string): string =>
  svg(
    sky(top, low) +
      '<circle cx="96" cy="84" r="30" fill="#fff" fill-opacity=".85"/>' +
      `<rect y="150" width="400" height="76" fill="${sea}"/>` +
      '<path d="M0 174h400M40 192h150M230 164h120" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>' +
      `<path d="M0 214c60-14 120 10 200-2s140-8 200 4v84H0z" fill="${sand}"/>`,
  );

/** A car parked side on. */
const car = (wall: string, floor: string, body: string): string =>
  svg(
    `<rect width="400" height="300" fill="${wall}"/><rect y="206" width="400" height="94" fill="${floor}"/>` +
      `<path d="M70 214h262c8 0 12-6 10-14l-8-26c-3-8-10-12-18-13l-44-5-34-38c-6-6-13-9-21-9h-74c-9 0-17 4-22 12l-22 36-22 6c-8 2-13 9-13 17v22c0 7 3 12 6 12z" fill="${body}"/>` +
      '<path d="M146 122h52v36h-74zm66 0h28l30 36h-58z" fill="#fff" fill-opacity=".55"/>' +
      '<circle cx="124" cy="216" r="24" fill="#16161a"/><circle cx="124" cy="216" r="10" fill="#9aa0a8"/>' +
      '<circle cx="282" cy="216" r="24" fill="#16161a"/><circle cx="282" cy="216" r="10" fill="#9aa0a8"/>',
  );

/** Dinner, from above. */
const plate = (table: string, food: string, side: string): string =>
  svg(
    `<rect width="400" height="300" fill="${table}"/>` +
      '<circle cx="200" cy="150" r="104" fill="#f4f1ea"/><circle cx="200" cy="150" r="78" fill="#e7e2d6"/>' +
      `<circle cx="182" cy="140" r="40" fill="${food}"/><circle cx="236" cy="172" r="22" fill="${side}"/>` +
      '<rect x="56" y="60" width="8" height="180" rx="4" fill="#c9ccd1"/><rect x="336" y="60" width="8" height="180" rx="4" fill="#c9ccd1"/>',
  );

// ── The gallery ─────────────────────────────────────────────────────────────────────────────

const photo = (id: string, secsAgo: number, url: string, favorite = false): Photo => ({ id, url, ts: ago(secsAgo), video: false, favorite });

/** Fourteen photos over the last ten days, newest first. */
const photos: Photo[] = [
  photo('k7m2x9q4a1zc', 35 * MIN, hills('#f7a24b', '#e2557a', '#ffd27a', '#3b2a5a'), true),
  photo('b3n8v5c1w6ye', 3 * HOUR, car('#c9d3dc', '#7d8791', '#c8372d')),
  photo('t9r4e2w7q5ud', DAY + 2 * HOUR, city('#141a33', '#3a2a5c', '#0b0e1c', '#ffd66b')),
  photo('h6j1k8l3z0xf', DAY + 5 * HOUR, plate('#6b4a33', '#d9822b', '#5a8f3c')),
  photo('p2o5i8u1y4tg', DAY + 9 * HOUR, shore('#7cc4f2', '#d6efff', '#2f86c4', '#ecd9a6'), true),
  photo('m4n7b0v3c6xh', 2 * DAY + 4 * HOUR, car('#2b2f3a', '#16181d', '#e8b923')),
  photo('q1w4e7r0t3yi', 3 * DAY + HOUR, hills('#6fb1e8', '#cfe9ff', '#fff3c2', '#2f6b4a')),
  photo('a8s5d2f9g6hj', 3 * DAY + 6 * HOUR, plate('#2e3a46', '#c0483b', '#e9c46a')),
  photo('z3x6c9v2b5nk', 5 * DAY + 3 * HOUR, city('#2a1c3d', '#b0476a', '#170f22', '#ff9f5a')),
  photo('l0k3j6h9g2fl', 5 * DAY + 7 * HOUR, shore('#f4a261', '#fde2c0', '#3d6f8f', '#d8b98a')),
  photo('y5t8r1e4w7qm', 6 * DAY + 2 * HOUR, car('#b9c4a8', '#6f7a63', '#2d5f9a'), true),
  photo('u2i5o8p1a4sn', 8 * DAY + 5 * HOUR, hills('#3c2f6b', '#c0568a', '#ffb38a', '#1c1533')),
  photo('d7f0g3h6j9ko', 8 * DAY + 8 * HOUR, plate('#8a8f99', '#7a4b2a', '#b7d08a')),
  photo('c4v7b0n3m6lp', 9 * DAY + 4 * HOUR, city('#0f2433', '#1f5a6b', '#081219', '#9be7ff')),
];

const CLIP: Photo = { id: 'e1r4t7y0u3iq', url: 'https://media.example.invalid/sdphone-clip.webm', ts: ago(12 * MIN), video: true, favorite: false };
const BROKEN: Photo = { id: 'w6q9a2s5d8fr', url: 'data:image/png;base64,AAAA', ts: ago(20 * MIN), video: false, favorite: false };

const linkDown = (): boolean => {
  if ((window as unknown as { __phoneDown?: boolean }).__phoneDown) return true;
  try {
    return window.localStorage.getItem('mock:phonelink') === 'down';
  } catch {
    return false;
  }
};

const variant = (): string => {
  try {
    return window.localStorage.getItem('mock:photos') ?? '';
  } catch {
    return '';
  }
};

const handlers: Record<string, MockHandler> = {
  'photos:list': () => {
    if (linkDown()) return fail(UNAVAILABLE);
    const v = variant();
    let list = v === 'empty' ? [] : [...photos];
    if (v === 'video') list = [CLIP, ...list];
    if (v === 'broken') list = [BROKEN, ...list];
    const data: ListData = { photos: list, capped: v === 'full' };
    return ok(data);
  },
};

export default handlers;
