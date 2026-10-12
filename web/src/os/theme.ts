import type { CSSProperties } from 'react';
import type { Theme } from '@/types';

/** #rrggbb -> [r, g, b] (0-255). Falls back to Windows blue on bad input. */
const rgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = parseInt(m ? m[1] : '0078d4', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (c: [number, number, number]): string =>
  '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Linear mix of two colours: t=0 -> a, t=1 -> b. (No CSS color-mix: FiveM's CEF predates it.) */
export const mix = (a: string, b: string, t: number): string => {
  const x = rgb(a);
  const y = rgb(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
};

/** rgba() string from a hex colour. */
export const rgba = (hex: string, a: number): string => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/** WCAG relative luminance (0 black .. 1 white). */
const luminance = (hex: string): number => {
  const ch = rgb(hex).map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};

/**
 * The accent CSS variables for a theme, derived like Windows does: dark mode fills with a LIGHTER
 * shade (black text on it), light mode with a DARKER one (white text).
 */
export function accentVars(accent: string, theme: Theme): CSSProperties {
  const fill = theme === 'dark' ? mix(accent, '#ffffff', 0.3) : mix(accent, '#000000', 0.28);
  const hover = theme === 'dark' ? mix(fill, '#000000', 0.1) : mix(fill, '#ffffff', 0.12);
  const on = luminance(fill) > 0.4 ? '#000000' : '#ffffff';
  const text = theme === 'dark' ? mix(accent, '#ffffff', 0.4) : mix(accent, '#000000', 0.32);
  return {
    '--accent': accent,
    '--accent-fill': fill,
    '--accent-fill-hover': hover,
    '--accent-on': on,
    '--accent-text': text,
    '--accent-soft': rgba(accent, theme === 'dark' ? 0.22 : 0.16),
  } as CSSProperties;
}
