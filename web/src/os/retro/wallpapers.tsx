import type { CSSProperties, ReactNode } from 'react';

// The retro style's desktop patterns, generated as tiny SVG tiles (data URIs, no image files) and
// tiled with image-rendering: pixelated so every pattern pixel lands as a hard 2-3px block - the way
// a 16-colour display painted its desktop. Ids match configs/shared/desktop.lua Styles.retro.

const uri = (w: number, h: number, body: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' shape-rendering='crispEdges'>${body}</svg>`)}")`;

const px = (x: number, y: number, c: string, w = 1, h = 1): string => `<rect x='${x}' y='${y}' width='${w}' height='${h}' fill='${c}'/>`;

/** Teal: the 2x2 ordered dither 16-colour VGA used to fake a mid teal. */
const TEAL = uri(2, 2, px(0, 0, '#008080', 2, 2) + px(0, 0, '#006666') + px(1, 1, '#006666'));

/** Midnight: the same dither in deep navy. */
const NAVY = uri(2, 2, px(0, 0, '#000058', 2, 2) + px(0, 0, '#00003c') + px(1, 1, '#00003c'));

/** Weave: a wicker basket weave - blocks of horizontal strands alternating with vertical ones. */
const WEAVE = (() => {
  const L = '#b48c58';
  const D = '#6e4e2c';
  let s = '';
  for (let by = 0; by < 2; by++)
    for (let bx = 0; bx < 2; bx++) {
      const horiz = (bx + by) % 2 === 0;
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          const lit = horiz ? y % 2 === 0 : x % 2 === 0;
          s += px(bx * 4 + x, by * 4 + y, lit ? L : D);
        }
    }
  // A dark pinhole where four blocks meet sells the over-under.
  s += px(3, 3, '#3a2814') + px(7, 7, '#3a2814');
  return uri(8, 8, s);
})();

/** Bricks: running bond, 3-unit courses with a highlight row, a shadow row and pale mortar. */
const BRICKS = (() => {
  const mortar = '#c8bca8';
  let s = px(0, 0, mortar, 16, 8);
  for (let course = 0; course < 2; course++) {
    const y0 = course * 4;
    const joints = course === 0 ? [7, 15] : [3, 11];
    s += px(0, y0, '#c25a40', 16) + px(0, y0 + 1, '#a8402c', 16) + px(0, y0 + 2, '#8a3020', 16);
    for (const j of joints) s += px(j, y0, mortar, 1, 3);
    // A few chipped pixels so the wall doesn't look printed.
    s += px(course === 0 ? 2 : 6, y0 + 1, '#b4503a') + px(course === 0 ? 12 : 9, y0 + 2, '#7a2818');
  }
  return uri(16, 8, s);
})();

/** Deterministic PRNG so the starfield is the same on every machine. */
const prng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
};

const STAR_COLOURS = ['#ffffff', '#c0c0c0', '#808080', '#55ffff', '#ffff55', '#c0c0c0', '#808080'];

/** Starfield: scattered single-pixel stars plus a few bright crosses on a near-black field. */
const stars = (size: number, count: number, seed: number, bg: string | null): string => {
  const rnd = prng(seed);
  let s = bg ? px(0, 0, bg, size, size) : '';
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * size);
    const y = Math.floor(rnd() * size);
    const c = STAR_COLOURS[Math.floor(rnd() * STAR_COLOURS.length)];
    if (rnd() < 0.08 && x > 0 && y > 0 && x < size - 1 && y < size - 1) {
      s += px(x - 1, y, '#808080', 3, 1) + px(x, y - 1, '#808080', 1, 3) + px(x, y, '#ffffff');
    } else s += px(x, y, c);
  }
  return uri(size, size, s);
};
const STARS = stars(96, 46, 1031, '#00000e');
const TWINKLE = stars(140, 12, 7311, null);

const layer = (image: string, size: number, extra?: CSSProperties): ReactNode => (
  <div
    className="absolute inset-0"
    style={{ backgroundImage: image, backgroundSize: `${size}px ${size}px`, backgroundRepeat: 'repeat', imageRendering: 'pixelated', ...extra }}
  />
);

/** The retro style's generated wallpapers by id (null = not one of ours). */
export function retroWallpaper(id: string, _accent: string): ReactNode | null {
  switch (id) {
    case 'retro-teal':
      return layer(TEAL, 2, { backgroundColor: '#008080' });
    case 'retro-navy':
      return layer(NAVY, 2, { backgroundColor: '#00004a' });
    case 'retro-weave':
      return layer(WEAVE, 24, { backgroundColor: '#6e4e2c' });
    case 'retro-bricks':
      return (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: '#a8402c', backgroundImage: BRICKS, backgroundSize: '48px 24px', imageRendering: 'pixelated' }}
        />
      );
    case 'retro-starfield':
      return (
        <>
          {layer(STARS, 192, { backgroundColor: '#00000e' })}
          <div className="absolute inset-0 rt-twinkle" style={{ backgroundImage: TWINKLE, backgroundSize: '280px 280px', imageRendering: 'pixelated' }} />
        </>
      );
    default:
      return null;
  }
}
