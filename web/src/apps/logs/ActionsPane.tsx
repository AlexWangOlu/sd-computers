import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import type { MenuItem } from './types';
import { L, cx } from './model';

export interface ActionDef {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Opens a flyout (View ▸, Help ▸) instead of running. */
  submenu?: MenuItem[];
}

function ActionSection({ title, items, onSubmenu }: { title: string; items: ActionDef[]; onSubmenu: (el: HTMLElement, items: MenuItem[]) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-[22px] flex items-center gap-1 pl-2 pr-1 bg-control-hover text-left font-semibold text-t1 hover:bg-control-press"
        title={title}
      >
        <span className="flex-1 truncate">{title}</span>
        {open ? <ChevronUp size={12} className="shrink-0 text-t2" /> : <ChevronDown size={12} className="shrink-0 text-t2" />}
      </button>
      {open && (
        <div className="py-0.5">
          {items.map(a => (
            <button
              key={a.key}
              type="button"
              disabled={a.disabled}
              onClick={e => (a.submenu ? onSubmenu(e.currentTarget, a.submenu) : a.onClick?.())}
              className="w-full h-[22px] flex items-center gap-2 pl-3 pr-1.5 text-left text-t1 hover:bg-subtle disabled:text-tdis disabled:hover:bg-transparent"
            >
              <span className={cx('w-4 h-4 shrink-0 flex items-center justify-center', a.disabled ? 'opacity-50' : 'text-accent-text')}>{a.icon}</span>
              <span className="flex-1 truncate">{a.label}</span>
              {a.submenu && <ChevronRight size={12} className="shrink-0 text-t2" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** MMC's right-hand Actions pane: one section for the selected node, one for the selected event. */
export function ActionsPane({ title, items, eventTitle, eventItems, onSubmenu }: {
  title: string;
  items: ActionDef[];
  eventTitle: string | null;
  eventItems: ActionDef[];
  onSubmenu: (el: HTMLElement, items: MenuItem[]) => void;
}) {
  return (
    <div className="h-full flex flex-col bg-layer text-[12px]">
      <div className="h-[26px] shrink-0 flex items-center px-2 border-b border-stroke font-semibold text-t1">{L('actions')}</div>
      <div className="flex-1 min-h-0 overflow-y-auto os-scroll">
        <ActionSection title={title} items={items} onSubmenu={onSubmenu} />
        {eventTitle && <ActionSection title={eventTitle} items={eventItems} onSubmenu={onSubmenu} />}
      </div>
    </div>
  );
}
