import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Lock, LogOut, Power, Search as SearchIcon } from 'lucide-react';
import { useOS } from '@/store/os';
import type { AppId } from '@/types';
import { t } from '@/i18n';
import { useExitFx } from '@/hooks/useExitFx';
import { lockSession } from '../session';
import { MacIcon } from './MacIcon';

interface Result {
  key: string;
  label: string;
  kind: string;
  icon: ReactNode;
  run: () => void;
}

/**
 * Search: a centred translucent field over the desktop. Empty, it lists every app on this computer
 * (it doubles as the launcher); typing filters apps and the session actions. Up/Down + Enter, or
 * click. Open while `useOS.start` is set (menu-bar magnifier, Ctrl+Space, Ctrl+Escape).
 */
export default function SearchOverlay() {
  const payload = useOS(s => s.payload)!;
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const exitRef = useExitFx('fade-out');

  useEffect(() => {
    const h = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(h);
  }, []);

  const s = useOS.getState();
  const close = () => s.setStart(false);
  const q = query.trim().toLowerCase();

  const apps: Result[] = payload.computer.apps
    .filter(a => !q || a.label.toLowerCase().includes(q) || a.id.includes(q))
    .map(a => ({
      key: a.id,
      label: a.label,
      kind: t('ui.mac.search_app'),
      icon: <MacIcon app={a.id} size={26} />,
      run: () => s.openApp(a.id as AppId),
    }));

  const actionDefs: { key: string; label: string; icon: ReactNode; run: () => void }[] = [
    { key: 'lock', label: t('ui.mac.sys_lock'), icon: <Lock size={16} />, run: () => { lockSession(); s.setPhase('lock'); } },
    { key: 'logout', label: t('ui.mac.search_logout'), icon: <LogOut size={16} />, run: () => { lockSession(); s.closeAll(); s.setPhase('lock'); } },
    { key: 'shutdown', label: t('ui.mac.search_shutdown'), icon: <Power size={16} />, run: () => s.setPhase('shutdown') },
  ];
  const actions: Result[] = q
    ? actionDefs
        .filter(a => a.label.toLowerCase().includes(q))
        .map(a => ({ ...a, kind: t('ui.mac.search_action'), icon: <span className="mac-search-glyph">{a.icon}</span> }))
    : [];

  const results = [...apps, ...actions];
  const index = Math.min(sel, Math.max(0, results.length - 1));

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const launch = (r: Result | undefined) => {
    if (!r) return;
    close();
    r.run();
  };

  const section = (title: string, list: Result[], offset: number) =>
    list.length > 0 && (
      <div>
        <div className="mac-search-head">{title}</div>
        {list.map((r, i) => (
          <button
            key={r.key}
            type="button"
            data-idx={offset + i}
            className={`mac-search-row ${offset + i === index ? 'is-selected' : ''}`}
            onMouseMove={() => setSel(offset + i)}
            onClick={() => launch(r)}
          >
            {r.icon}
            <span className="flex-1 min-w-0 truncate text-left">{r.label}</span>
            <span className="mac-search-kind">{r.kind}</span>
          </button>
        ))}
      </div>
    );

  return (
    <div ref={exitRef} className="absolute inset-0" style={{ zIndex: 60 }} onMouseDown={close}>
      <div className="mac-search mac-search-in" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 h-[54px] px-4">
          <SearchIcon size={22} strokeWidth={2} className="shrink-0 text-t2" />
          <input
            ref={inputRef}
            value={query}
            spellCheck={false}
            autoComplete="off"
            placeholder={t('ui.mac.search_placeholder')}
            onChange={e => {
              setQuery(e.target.value);
              setSel(0);
            }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel(Math.min(results.length - 1, index + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel(Math.max(0, index - 1));
              } else if (e.key === 'Enter') {
                launch(results[index]);
              } else if (e.key === 'Escape') {
                // Handled here so the OS-level Escape (stand up from an empty desktop) never sees it.
                e.stopPropagation();
                close();
              }
            }}
            className="mac-search-input"
          />
        </div>
        <div ref={listRef} className="mac-search-list os-scroll">
          {results.length === 0 ? (
            <div className="px-4 py-5 text-[13px] text-t2">{t('ui.mac.search_none', query.trim())}</div>
          ) : (
            <>
              {section(t('ui.mac.search_apps'), apps, 0)}
              {section(t('ui.mac.search_actions'), actions, apps.length)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
