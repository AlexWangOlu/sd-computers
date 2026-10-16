import { useEffect, useState } from 'react';
import { t } from '@/i18n';

// Date/number formatting shared by every app. The OS clock is the player's real local clock.
//
// The locale is the UI's, not the machine's: a Chinese desktop on an English Windows still reads
// "2026/10/16 上午10:10" and 昨天. This fork ships cn; setFormatLocale lets a caller line the
// formats up with another locale's strings.
let formatLocale = 'zh-CN';
export const setFormatLocale = (locale: string): void => { formatLocale = locale; };

/** "6:05 PM" / "18:05" (上午6:05 in Chinese). */
export const fmtTime = (d: Date, clock24: boolean): string =>
  d.toLocaleTimeString(formatLocale, { hour: 'numeric', minute: '2-digit', hour12: !clock24 });

/** "10/5/2026" (taskbar style; "2026/10/5" in Chinese). */
export const fmtShortDate = (d: Date): string => d.toLocaleDateString(formatLocale, { month: 'numeric', day: 'numeric', year: 'numeric' });

/** "Monday, October 5" ("10月5日星期一" in Chinese). */
export const fmtLongDate = (d: Date): string => d.toLocaleDateString(formatLocale, { weekday: 'long', month: 'long', day: 'numeric' });

/** Unix seconds -> "10/5/2026 6:05:12 PM" (Event Viewer style). */
export const fmtStamp = (ts: number, clock24 = false): string => {
  const d = new Date(ts * 1000);
  return `${fmtShortDate(d)} ${d.toLocaleTimeString(formatLocale, { hour12: !clock24 })}`;
};

/** Unix seconds -> "6:05 PM" today, "Yesterday", "Mon", or "10/5/2026" (mail list style). */
export const fmtMailDate = (ts: number, clock24 = false): string => {
  const d = new Date(ts * 1000);
  const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days <= 0) return fmtTime(d, clock24);
  if (days === 1) return t('ui.common.yesterday');
  if (days < 7) return d.toLocaleDateString(formatLocale, { weekday: 'short' });
  return fmtShortDate(d);
};

/** Unix seconds -> "5 min ago" style. */
export const fmtAgo = (ts: number): string => {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return t('ui.common.just_now');
  if (s < 3600) return t('ui.common.minutes_ago', Math.floor(s / 60));
  if (s < 86400) return t('ui.common.hours_ago', Math.floor(s / 3600));
  return t('ui.common.days_ago', Math.floor(s / 86400));
};

/** 12345.6 -> "$12,346". */
export const fmtMoney = (n: number): string => '$' + Math.round(n).toLocaleString(formatLocale);

/** Seconds -> "1:05:09" / "4:09". */
export const fmtDuration = (secs: number): string => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

/** "Fri 16 Oct" / "周五 10月16日" (menu bar style). */
export const fmtWeekdayDate = (d: Date): string =>
  `${d.toLocaleDateString(formatLocale, { weekday: 'short' })} ${d.toLocaleDateString(formatLocale, { month: 'short', day: 'numeric' })}`;

/** "Monday 5 October" / "星期一 10月5日" (lock screen style). */
export const fmtWeekdayLongDate = (d: Date): string =>
  `${d.toLocaleDateString(formatLocale, { weekday: 'long' })} ${d.toLocaleDateString(formatLocale, { month: 'long', day: 'numeric' })}`;

/** "Oct 6" / "10月6日" (chart axis). */
export const fmtMonthDay = (d: Date): string => d.toLocaleDateString(formatLocale, { month: 'short', day: 'numeric' });

/** "October 2026" / "2026年10月" (calendar header). */
export const fmtMonthYear = (d: Date): string => d.toLocaleDateString(formatLocale, { month: 'long', year: 'numeric' });

/** Calendar column headers, Sunday first: ["Sun","Mon",…] / ["周日","周一",…]. */
export const fmtWeekdayInitials = (): string[] => {
  const out: string[] = [];
  const sunday = new Date(2024, 0, 7); // a known Sunday; only its weekday names are wanted
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
    out.push(d.toLocaleDateString(formatLocale, { weekday: 'short' }));
  }
  return out;
};

/** "Friday, October 5, 2026" / "2026年10月5日星期五" (long forms: settings, `date`). */
export const fmtLongDateFull = (d: Date): string =>
  d.toLocaleDateString(formatLocale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

/** "Fri" / "周五". */
export const fmtWeekdayShort = (d: Date): string => d.toLocaleDateString(formatLocale, { weekday: 'short' });

/** "Friday" / "星期五". */
export const fmtWeekdayLong = (d: Date): string => d.toLocaleDateString(formatLocale, { weekday: 'long' });

/** "Fri, Oct 5" ("10月5日周五" in Chinese). */
export const fmtWeekdayMonthDay = (d: Date): string =>
  d.toLocaleDateString(formatLocale, { weekday: 'short', month: 'short', day: 'numeric' });

/** "Fri, Oct 5, 2026, 6:05 PM" (a mail's header). */
export const fmtWeekdayFullStamp = (d: Date, clock24: boolean): string =>
  `${d.toLocaleDateString(formatLocale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}, ${fmtTime(d, clock24)}`;

/** The locale every format above uses, for a caller building its own (collation, ...). */
export const getFormatLocale = (): string => formatLocale;

/** A Date that re-renders the caller every `ms` (clocks). */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
