import { t } from '@/i18n';
import { fmtLongDate, fmtTime } from '@/lib/format';
import type { Photo } from './types';

// Photos' data helpers: what comes off the wire, the day groups, the dates. No state in here.

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/** Lua encodes an empty table as `{}`, so every array off the wire goes through this. */
export const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** An address the desk can draw: a web URL, or (stills only) an inline image as browser dev uses. */
export const drawable = (p: Pick<Photo, 'url' | 'video'>): boolean => /^https?:\/\//i.test(p.url) || (!p.video && /^data:image\//i.test(p.url));

/** A photos:list row, defensively (null when it has no id or no address). */
function normPhoto(raw: unknown): Photo | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<Record<keyof Photo, unknown>>;
  const id = typeof o.id === 'string' ? o.id : typeof o.id === 'number' ? String(o.id) : '';
  const url = typeof o.url === 'string' ? o.url : '';
  if (!id || !url) return null;
  const ts = Math.floor(Number(o.ts) || 0);
  return { id, url, ts: ts > 0 ? ts : 0, video: o.video === true, favorite: o.favorite === true };
}

/** The whole list: one row per id, newest first (same-second photos keep the phone's order, undated ones go last). */
export function normList(raw: unknown): Photo[] {
  const seen = new Set<string>();
  const out: Photo[] = [];
  for (const row of asArray<unknown>(raw)) {
    const p = normPhoto(row);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out.sort((a, b) => b.ts - a.ts);
}

// ── Days ────────────────────────────────────────────────────────────────────────────────────

/** The photos taken on one calendar day, in the player's own time zone. */
export interface DayGroup {
  key: string;
  /** that day's local midnight in ms (0 = the photos the phone has no time for) */
  day: number;
  photos: Photo[];
}

const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Split a newest-first list into its days (a day's photos are next to each other in it). */
export function groupByDay(photos: Photo[]): DayGroup[] {
  const out: DayGroup[] = [];
  let cur: DayGroup | null = null;
  for (const p of photos) {
    const day = p.ts > 0 ? startOfDay(p.ts * 1000) : 0;
    if (!cur || cur.day !== day) {
      cur = { key: day ? String(day) : 'undated', day, photos: [] };
      out.push(cur);
    }
    cur.photos.push(p);
  }
  return out;
}

/** "Monday, October 5", with the year once it isn't this one. */
function longDate(ms: number): string {
  const d = new Date(ms);
  return d.getFullYear() === new Date().getFullYear() ? fmtLongDate(d) : `${fmtLongDate(d)}, ${d.getFullYear()}`;
}

/** A day's heading: "Today" / "Yesterday" with the date beside it, the date alone further back. */
export function dayHeading(g: DayGroup): { title: string; sub?: string } {
  if (!g.day) return { title: t('ui.photos.undated') };
  const ago = Math.round((startOfDay(Date.now()) - g.day) / 86400000);
  const date = longDate(g.day);
  if (ago === 0) return { title: t('ui.photos.today'), sub: date };
  if (ago === 1) return { title: t('ui.photos.yesterday'), sub: date };
  return { title: date };
}

/** "Monday, October 5 at 6:05 PM" ('' when the phone has no time for it). */
export function takenAt(p: Photo, clock24: boolean): string {
  if (!p.ts) return '';
  const ms = p.ts * 1000;
  return t('ui.photos.date_at_time', longDate(ms), fmtTime(new Date(ms), clock24));
}

/** "12 photos", "12 photos, 2 videos", "1 video". */
export function countLabel(photos: Photo[]): string {
  let videos = 0;
  for (const p of photos) if (p.video) videos++;
  const stills = photos.length - videos;
  const parts: string[] = [];
  if (stills > 0 || videos === 0) parts.push(stills === 1 ? t('ui.photos.photos_one') : t('ui.photos.photos_many', stills));
  if (videos > 0) parts.push(videos === 1 ? t('ui.photos.videos_one') : t('ui.photos.videos_many', videos));
  return parts.join(', ');
}
