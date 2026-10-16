import { useOS } from '@/store/os';
import { fmtShortDate, fmtTime, useNow } from '@/lib/format';
import { t } from '@/i18n';
import type { Filter } from './types';

// What is laid over a camera's picture, in the window and expanded alike (.cam-* in styles.css).
// None of it takes the pointer: the picture under it is what is dragged.

/** The security-monitor look the page adds to the picture: scan lines, a slow rolling band, dark corners. */
export function Tint({ filter }: { filter: Filter }) {
  if (filter === 'none') return null;
  return (
    <>
      <div className="cam-lines" />
      <div className="cam-roll" />
      <div className="cam-vignette" />
    </>
  );
}

/**
 * Snow, with a line of text on it: no picture yet (connecting), or not any more. It comes at once
 * and goes slowly, so a picture fades in from under it.
 */
export function Static({ on, children }: { on: boolean; children?: string }) {
  return (
    <div className={`cam-static ${on ? 'is-on' : ''}`} aria-hidden={!on}>
      {children && <span className="cam-osd">{children}</span>}
    </div>
  );
}

/** The time burnt into a recording: the date and the time to the second. */
export function useStamp(): string {
  const clock24 = useOS(s => s.payload?.desktop.clock24 ?? false);
  const now = useNow();
  return `${fmtShortDate(now)}  ${fmtTime(now, clock24)}`;
}

/** The recording light. */
export function Rec() {
  return (
    <span className="cam-rec">
      <span className="cam-rec-dot" />
      {t('ui.cameras.rec')}
    </span>
  );
}
