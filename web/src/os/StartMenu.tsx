import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Lock, LogOut, Power, Search } from 'lucide-react';
import { useOS } from '@/store/os';
import type { AppId } from '@/types';
import { t } from '@/i18n';
import { fmtAgo } from '@/lib/format';
import { useExitFx } from '@/hooks/useExitFx';
import { AppIcon, Avatar } from './icons';
import { lockSession } from './session';

/**
 * Start menu: search box, Pinned grid (every app this computer has), Recommended (recently
 * opened), and the account/power footer (Lock, Sign out, Shut down). Typing filters to a "Best
 * match" list; Enter opens the top hit.
 */
export default function StartMenu() {
  const payload = useOS(s => s.payload)!;
  const recent = useOS(s => s.recent);
  const { openApp, setStart, setPhase, closeAll } = useOS.getState();
  const [query, setQuery] = useState('');
  const [power, setPower] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useExitFx('fly-out');
  const powerRef = useExitFx('pop-out');

  useEffect(() => {
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  const apps = payload.computer.apps;
  const q = query.trim().toLowerCase();
  const matches = q ? apps.filter(a => a.label.toLowerCase().includes(q) || a.id.includes(q)) : [];

  const open = (id: AppId) => {
    openApp(id);
    setStart(false);
  };

  const lock = () => {
    lockSession();
    setPhase('lock');
  };
  const signOut = () => {
    lockSession();
    closeAll();
    setPhase('lock');
  };

  // Centred with auto margins rather than a translate: fly-up animates the transform.
  return (
    <div
      ref={menuRef}
      className="absolute inset-x-0 mx-auto bottom-[56px] w-[640px] max-h-[calc(100%-72px)] h-[700px] acrylic rounded-win shadow-flyout flex flex-col overflow-hidden fly-up"
      style={{ zIndex: 9100 }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="px-8 pt-8 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-t2" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && matches[0]) open(matches[0].id);
              if (e.key === 'Escape') {
                // (used here: by the time the OS sees the key the menu is shut, and it would stand the player up)
                e.preventDefault();
                setStart(false);
              }
            }}
            placeholder={t('ui.start.search')}
            className="w-full h-9 pl-10 pr-4 rounded-full bg-[var(--input)] border border-stroke-strong border-b-[var(--accent-fill)] border-b-2 text-body text-t1 placeholder:text-t3 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto os-scroll px-8 pb-4">
        {q ? (
          <div key="results" className="page-in">
            <div className="text-body font-semibold text-t1 mt-4 mb-2">{t('ui.start.best_match')}</div>
            {matches.length === 0 && <div className="text-body text-t2 py-6">{t('ui.start.no_results', query)}</div>}
            {matches.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onClick={() => open(a.id)}
                className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-ctl text-left hover:bg-subtle ${i === 0 ? 'bg-subtle' : ''}`}
              >
                <AppIcon app={a.id} size={32} />
                <div>
                  <div className="text-body text-t1">{a.label}</div>
                  <div className="text-caption text-t2">{t('ui.start.app')}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div key="home" className="page-in">
            <div className="flex items-center justify-between mt-4 mb-2 px-2">
              <div className="text-body font-semibold text-t1">{t('ui.start.pinned')}</div>
            </div>
            <div className="grid grid-cols-6 gap-y-1">
              {apps.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => open(a.id)}
                  className="h-[84px] flex flex-col items-center justify-center gap-2 rounded-ctl hover:bg-subtle active:bg-control-press active:scale-95"
                >
                  <AppIcon app={a.id} size={32} />
                  <span className="text-caption text-t1 px-1 truncate max-w-full">{a.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6 mb-2 px-2">
              <div className="text-body font-semibold text-t1">{t('ui.start.recommended')}</div>
            </div>
            {recent.length === 0 ? (
              <div className="text-caption text-t2 px-2 py-4">{t('ui.start.recommended_empty')}</div>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {recent.map(r => {
                  const a = apps.find(x => x.id === r.app);
                  if (!a) return null;
                  return (
                    <button key={r.app} type="button" onClick={() => open(r.app)} className="flex items-center gap-3 px-3 py-2.5 rounded-ctl text-left hover:bg-subtle">
                      <AppIcon app={r.app} size={32} />
                      <div className="min-w-0">
                        <div className="text-body text-t1 truncate">{a.label}</div>
                        <div className="text-caption text-t2">{fmtAgo(Math.floor(r.at / 1000))}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative h-16 shrink-0 flex items-center justify-between px-12 border-t border-stroke bg-[var(--card)]">
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-ctl">
          <Avatar initials={payload.user.initials} size={32} />
          <div className="leading-tight">
            <div className="text-body text-t1">{payload.user.name}</div>
            {payload.user.job && <div className="text-caption text-t2">{payload.user.job}</div>}
          </div>
        </div>
        <button type="button" title={t('ui.power.power')} onClick={() => setPower(p => !p)} className={`w-10 h-10 flex items-center justify-center rounded-ctl hover:bg-subtle text-t1 ${power ? 'bg-subtle' : ''}`}>
          <Power size={18} />
        </button>
        {power && (
          <div ref={powerRef} className="absolute right-8 bottom-14 w-52 acrylic rounded-win shadow-flyout py-1 pop-in origin-bottom-right" style={{ zIndex: 2 }}>
            <MenuRow icon={<Lock size={16} />} label={t('ui.power.lock')} onClick={lock} />
            <MenuRow icon={<LogOut size={16} />} label={t('ui.power.signout')} onClick={signOut} />
            <div className="h-px bg-stroke my-1 mx-2" />
            <MenuRow icon={<Power size={16} />} label={t('ui.power.shutdown')} onClick={() => setPhase('shutdown')} />
          </div>
        )}
      </div>
    </div>
  );
}

function MenuRow({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-[calc(100%-8px)] mx-1 flex items-center gap-3 h-9 px-3 rounded-ctl text-body text-t1 hover:bg-subtle">
      {icon}
      {label}
    </button>
  );
}
