import { useEffect, useState } from 'react';

// Date/number formatting shared by every app. The OS clock is the player's real local clock.

/** "6:05 PM" / "18:05". */
export const fmtTime = (d: Date, clock24: boolean): string =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: !clock24 });

/** "10/5/2026" (taskbar style). */
export const fmtShortDate = (d: Date): string => d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

/** "Monday, October 5". */
export const fmtLongDate = (d: Date): string => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

/** Unix seconds -> "10/5/2026 6:05:12 PM" (Event Viewer style). */
export const fmtStamp = (ts: number, clock24 = false): string => {
  const d = new Date(ts * 1000);
  return `${fmtShortDate(d)} ${d.toLocaleTimeString('en-US', { hour12: !clock24 })}`;
};

/** Unix seconds -> "6:05 PM" today, "Yesterday", "Mon", or "10/5/2026" (mail list style). */
export const fmtMailDate = (ts: number, clock24 = false): string => {
  const d = new Date(ts * 1000);
  const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days <= 0) return fmtTime(d, clock24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return fmtShortDate(d);
};

/** Unix seconds -> "5 min ago" style. */
export const fmtAgo = (ts: number): string => {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

/** 12345.6 -> "$12,346". */
export const fmtMoney = (n: number): string => '$' + Math.round(n).toLocaleString('en-US');

/** Seconds -> "1:05:09" / "4:09". */
export const fmtDuration = (secs: number): string => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

/** A Date that re-renders the caller every `ms` (clocks). */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
