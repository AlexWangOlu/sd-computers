import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Eye, Loader2, X } from 'lucide-react';
import { useAdmin } from '@/admin/store/admin';
import { close } from '@/admin/nui/api';
import { t } from '@/admin/i18n';
import { Toasts, useExitGhost } from '@/admin/components/shared';
import { ErrorBoundary } from '@/admin/components/ErrorBoundary';
import { TABS } from '@/admin/types';
import type { Tab } from '@/admin/types';
import { OverviewTab } from './overview/OverviewTab';
import { ComputersTab } from './computers/ComputersTab';
import { CamerasTab } from './cameras/CamerasTab';
import { AutomaticTab, autoCount } from './automatic/AutomaticTab';
import { PropsTab } from './props/PropsTab';
import { StylesTab } from './styles/StylesTab';

// The panel shell is sd-bombs' own (and sd-scooters' before it), tab for tab: same frame, same
// header, same sliding underline.

const typing = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

export const AdminPanel = () => {
  const snapshot = useAdmin(s => s.snapshot);
  const tab = useAdmin(s => s.tab);
  const setTab = useAdmin(s => s.setTab);
  const busy = useAdmin(s => s.busy);

  const root = useRef<HTMLDivElement>(null);
  useExitGhost(root, 'animate-panelOut', 180);
  // Which way the tabs moved: the new one comes in from the side it sits on. The class stays with that tab (a snapshot
  // refresh mid-slide must not cut it short); the first tab shown just appears with the panel.
  const enter = useRef<{ tab: Tab; cls: string }>({ tab, cls: '' });
  if (enter.current.tab !== tab) {
    enter.current = { tab, cls: TABS.indexOf(tab) > TABS.indexOf(enter.current.tab) ? 'animate-tabFromRight' : 'animate-tabFromLeft' };
  }

  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = tabRefs.current[tab];
    if (!el) return;
    setUnderline({ left: el.offsetLeft + 10, width: Math.max(0, el.offsetWidth - 20) });
  }, [tab, snapshot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || typing()) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= TABS.length && !document.querySelector('[data-modal]')) setTab(TABS[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTab]);

  if (!snapshot) return null;

  const counts: Partial<Record<Tab, number>> = {
    computers: snapshot.computers.filter(c => !c.removed).length,
    cameras: snapshot.cameras.list.filter(c => !c.removed).length,
    automatic: autoCount(snapshot.auto),
    props: snapshot.props.length,
    styles: snapshot.styles.length,
  };

  return (
    <div ref={root} className="fixed inset-0 flex items-center justify-center font-sans animate-fadeIn" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div
        className="relative flex flex-col overflow-hidden animate-panelIn"
        style={{
          width: 1180,
          maxWidth: '94vw',
          height: '88vh',
          borderRadius: 14,
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--hairline-strong)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
        }}
      >
        <div className="flex items-center gap-3 pl-5 pr-3 h-14 flex-shrink-0">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span className="text-[14.5px] font-semibold tracking-[-0.01em]">{t('title')}</span>
            <span className="text-[12.5px] truncate" style={{ color: 'var(--text-3)' }}>
              {t('subtitle')}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!snapshot.canEdit && (
              <span className="flex items-center gap-1.5 h-6 px-2 rounded-[6px] text-[12px]" title={t('common.view_only_hint')} style={{ color: 'var(--text-2)', background: 'rgba(255,255,255,0.05)' }}>
                <Eye size={13} />
                {t('common.view_only')}
              </span>
            )}
            {busy && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-3)' }} />}
            <button type="button" className="sc-btn sc-btn--icon" onClick={() => void close()} aria-label={t('actions.close')}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="relative flex items-center px-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--hairline)' }}>
          {TABS.map((id, i) => (
            <button
              key={id}
              type="button"
              ref={el => {
                tabRefs.current[id] = el;
              }}
              data-on={tab === id}
              title={`${i + 1}`}
              onClick={() => setTab(id)}
              className="sc-tab"
            >
              {t(`tabs.${id}`)}
              {counts[id] != null && <span className="sc-tab__count">{counts[id]}</span>}
            </button>
          ))}
          {underline && <span className="sc-tab-underline absolute -bottom-px h-[1.5px] rounded-full" style={{ left: underline.left, width: underline.width, backgroundColor: 'var(--text-1)' }} />}
        </div>

        <div className="relative flex-1 min-h-0 overflow-hidden">
          <ErrorBoundary resetKey={tab}>
            <div key={tab} className={`absolute inset-0 ${enter.current.cls}`}>
              {tab === 'overview' && <OverviewTab />}
              {tab === 'computers' && <ComputersTab />}
              {tab === 'cameras' && <CamerasTab />}
              {tab === 'automatic' && <AutomaticTab />}
              {tab === 'props' && <PropsTab />}
              {tab === 'styles' && <StylesTab />}
            </div>
          </ErrorBoundary>
        </div>

        <Toasts />
      </div>
    </div>
  );
};
