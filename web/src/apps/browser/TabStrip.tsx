import { Globe, House, Plus, Rss, Unplug, X } from 'lucide-react';
import { t } from '@/i18n';
import { ExitFx } from '@/hooks/useExitFx';
import type { View } from './types';
import { cx } from './model';

export interface TabInfo {
  key: string;
  title: string;
  kind: View['kind'] | 'loading';
}

/** The little mark in front of a tab's title and in the address bar: what kind of page it is. */
export function KindIcon({ kind, size = 14 }: { kind: TabInfo['kind']; size?: number }) {
  if (kind === 'home') return <House size={size} />;
  if (kind === 'missing') return <Unplug size={size} />;
  if (kind === 'live') return <Rss size={size} />;
  return <Globe size={size} />;
}

/**
 * The row of tabs. The open one is a raised chip, the others are bare until hovered; a tab closes
 * from its X (on the open tab, or on hover) or with a middle click. The last tab has no X: closing
 * it would leave the window with nothing in it.
 */
export default function TabStrip({
  tabs,
  activeKey,
  canAdd,
  onSelect,
  onClose,
  onNew,
}: {
  tabs: TabInfo[];
  activeKey: string | null;
  canAdd: boolean;
  onSelect: (key: string) => void;
  onClose: (key: string) => void;
  onNew: () => void;
}) {
  const closable = tabs.length > 1;
  return (
    <div className="shrink-0 h-10 flex items-center gap-1 px-2">
      {/* gap-0.5: a closing tab's way out (.tab-out) closes up exactly that gap. */}
      <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden" role="tablist">
        {tabs.map(tab => {
          const active = tab.key === activeKey;
          return (
            <ExitFx
              exit="tab-out"
              key={tab.key}
              role="tab"
              aria-selected={active}
              title={tab.title}
              onMouseDown={e => {
                if (e.button === 0) onSelect(tab.key);
                else if (e.button === 1) e.preventDefault();
              }}
              onAuxClick={e => {
                if (e.button === 1 && closable) onClose(tab.key);
              }}
              className={cx(
                'group h-8 flex items-center gap-2 pl-2.5 pr-1 rounded-ctl border cursor-default select-none flex-[0_1_200px] min-w-[104px] fade-in',
                active ? 'bg-card border-stroke shadow-card text-t1' : 'border-transparent text-t2 hover:bg-subtle hover:text-t1',
              )}
            >
              <span className={cx('shrink-0', active ? 'text-accent-text' : 'text-t3')}>
                <KindIcon kind={tab.kind} />
              </span>
              <span className="flex-1 min-w-0 truncate text-caption">{tab.title}</span>
              <span className="w-6 h-6 shrink-0 flex items-center justify-center">
                {closable && (
                  <button
                    type="button"
                    tabIndex={-1}
                    title={t('ui.browser.close_tab')}
                    aria-label={t('ui.browser.close_tab')}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => onClose(tab.key)}
                    className={cx('w-6 h-6 items-center justify-center rounded-ctl text-t1 hover:bg-subtle active:bg-control-press', active ? 'flex' : 'hidden group-hover:flex')}
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            </ExitFx>
          );
        })}
      </div>
      {canAdd && (
        <button
          type="button"
          tabIndex={-1}
          title={t('ui.browser.new_tab')}
          aria-label={t('ui.browser.new_tab')}
          onClick={onNew}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-ctl text-t1 hover:bg-subtle active:bg-control-press"
        >
          <Plus size={16} />
        </button>
      )}
    </div>
  );
}
