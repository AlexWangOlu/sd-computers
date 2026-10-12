import type { CSSProperties } from 'react';
import type { Theme } from '@/types';
import { mix, rgba } from '../theme';

/** WCAG relative luminance of a #rrggbb colour (0 black .. 1 white). */
const luminance = (hex: string): number => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = parseInt(m ? m[1] : '0a84ff', 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};

/**
 * Harbor's accent variables. The shared theme.ts darkens (light) / lightens (dark) the accent the
 * way the modern style wants; Harbor fills with the accent itself in both themes, so the desktop
 * container re-declares the variables for everything inside it (windows, menus, dock).
 */
export function macAccentVars(accent: string, theme: Theme): CSSProperties {
  const fill = /^#[0-9a-f]{6}$/i.test(accent) ? accent : '#0a84ff';
  const bright = luminance(fill) > 0.45;
  const dark = theme === 'dark';
  return {
    '--accent-fill': fill,
    '--accent-fill-hover': mix(fill, dark ? '#ffffff' : '#000000', 0.08),
    '--accent-on': bright ? '#1d1d1f' : '#ffffff',
    '--accent-text': dark ? mix(fill, '#ffffff', bright ? 0 : 0.2) : mix(fill, '#000000', bright ? 0.45 : 0.1),
    '--accent-soft': rgba(fill, dark ? 0.26 : 0.15),
    '--mac-accent-top': mix(fill, '#ffffff', 0.16),
    '--mac-focus': rgba(fill, 0.42),
    '--mac-nav-sel': rgba(fill, dark ? 0.32 : 0.18),
  } as CSSProperties;
}
