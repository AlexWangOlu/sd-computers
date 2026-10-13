import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { History, Menu } from 'lucide-react';
import type { AppProps } from '../registry';
import { useOS, selectActiveId } from '@/store/os';
import { t } from '@/i18n';
import { IconButton } from '@/ui/controls';
import { useExitFx } from '@/hooks/useExitFx';
import { initialState, reduce, displayText, type MemOp } from './engine';
import { errorText, exprText } from './expr';
import { KEY_BY_ID, UNLOCKED, mapKey, type KeyDef } from './keys';
import { useSize } from './useSize';
import Display from './Display';
import Keypad from './Keypad';
import HistoryPanel from './HistoryPanel';

const MEM_KEYS: { id: MemOp; label: string }[] = [
  { id: 'mc', label: 'MC' },
  { id: 'mr', label: 'MR' },
  { id: 'mplus', label: 'M+' },
  { id: 'mminus', label: 'M−' },
  { id: 'ms', label: 'MS' },
];

/** Wide enough to dock History beside the keypad (Windows does the same). */
const DOCK_AT = 560;

/**
 * Calculator, Standard mode. All the arithmetic lives in engine.ts (exact decimals,
 * Windows' chaining / repeat-equals / percent rules); this file is layout + input. The keyboard
 * works only while this window is the focused one, and never steals keys from a text field.
 */
export default function Calculator({ win }: AppProps) {
  const [s, dispatch] = useReducer(reduce, initialState);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyExit = useExitFx('fly-out');
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(rootRef);
  const active = useOS(selectActiveId) === win.id;

  const docked = w >= DOCK_AT;
  const calcW = docked ? w - Math.min(320, Math.round(w * 0.4)) : w;
  const compact = h > 0 && (h < 430 || calcW < 300);
  const resultSize = Math.max(30, Math.min(72, Math.round((h || 488) * 0.095)));
  const locked = s.error !== null;

  const press = useCallback((k: KeyDef) => dispatch(k.action), []);

  const lightUp = (id: string) => {
    setFlash(id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 110);
  };
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const historyRef = useRef(historyOpen);
  historyRef.current = historyOpen;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  /** As C leaves it: nothing typed, nothing pending, no result and no error on the display. */
  const clearedRef = useRef(true);
  clearedRef.current =
    s.entry === initialState.entry && s.value === initialState.value && s.term === null && s.acc === null && s.op === null && s.expr === null && s.last === null && !s.done && s.error === null;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const os = useOS.getState();
      if (os.start || os.flyout) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      // Escape is C. With nothing on the display to clear and no History to shut it is nobody's
      // here: it is left to the OS, which stands the player up.
      if (e.key === 'Escape' && clearedRef.current && !historyRef.current) return;
      const hit = mapKey(e);
      if (!hit) return;
      e.preventDefault();
      if ('history' in hit) {
        setHistoryOpen(o => !o);
        return;
      }
      if ('mem' in hit) {
        dispatch({ type: 'mem', m: hit.mem });
        return;
      }
      if (hit.key === 'c' && e.key === 'Escape' && historyRef.current) {
        setHistoryOpen(false);
        return;
      }
      const def = KEY_BY_ID[hit.key];
      if (!def || (lockedRef.current && !UNLOCKED.has(def.id))) return;
      dispatch(def.action);
      lightUp(def.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const recall = (id: number) => {
    dispatch({ type: 'recall', id });
    setHistoryOpen(false);
  };

  const history = (
    <HistoryPanel items={s.history} docked={docked} onRecall={recall} onClear={() => dispatch({ type: 'clearHistory' })} />
  );

  return (
    <div ref={rootRef} className="relative h-full w-full flex bg-win overflow-hidden select-none">
      <div className="relative flex-1 min-w-0 flex flex-col">
        <div className="shrink-0 h-10 flex items-center gap-1 px-1">
          <IconButton title={t('ui.calculator.open_nav')} tabIndex={-1} onMouseDown={e => e.preventDefault()}>
            <Menu size={16} />
          </IconButton>
          <span className="ml-1 text-subtitle font-semibold text-t1 truncate">{t('ui.calculator.standard')}</span>
          <span className="flex-1" />
          {!docked && (
            <IconButton
              title={t('ui.calculator.history')}
              tabIndex={-1}
              onMouseDown={e => e.preventDefault()}
              onClick={() => setHistoryOpen(o => !o)}
              className={historyOpen ? 'bg-subtle' : ''}
            >
              <History size={16} />
            </IconButton>
          )}
        </div>

        <Display
          expr={exprText(s.expr)}
          text={s.error ? errorText(s.error) : displayText(s)}
          size={compact ? Math.min(resultSize, 38) : resultSize}
          width={calcW}
          error={locked}
        />

        <div className="relative flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 grid grid-cols-5 gap-0.5 px-[3px] pb-1">
            {MEM_KEYS.map(m => (
              <button
                key={m.id}
                type="button"
                tabIndex={-1}
                title={t(`ui.calculator.mem_${m.id}`)}
                disabled={locked || ((m.id === 'mc' || m.id === 'mr') && s.memory === null)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => dispatch({ type: 'mem', m: m.id })}
                className="h-8 rounded-ctl text-caption font-semibold text-t1 hover:bg-subtle active:bg-control-press active:text-t2 disabled:text-tdis disabled:pointer-events-none transition-colors duration-150"
              >
                {m.label}
              </button>
            ))}
          </div>
          <Keypad onKey={press} locked={locked} flash={flash} compact={compact} />

          {historyOpen && !docked && <div ref={historyExit} className="absolute inset-0 z-10">{history}</div>}
        </div>

        {historyOpen && !docked && (
          <div className="absolute left-0 right-0 top-0 z-[5]" style={{ bottom: 0 }} onMouseDown={() => setHistoryOpen(false)} />
        )}
      </div>

      {docked && <div className="shrink-0 h-full pt-1" style={{ width: Math.min(320, Math.round(w * 0.4)) }}>{history}</div>}
    </div>
  );
}
