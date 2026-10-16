import { useRef, useState, type ReactNode } from 'react';
import { Search, Wifi } from 'lucide-react';
import { useOS, selectActiveId } from '@/store/os';
import type { AppId } from '@/types';
import { fmtTime, fmtWeekdayDate, useNow } from '@/lib/format';
import { t } from '@/i18n';
import { lockSession } from '../session';
import { MarkMono } from './MacIcon';
import { MenuPanel, useDismiss, type MenuEntry } from './Menu';
import { MENU_H } from './layout';

/** Is the element a text field the Edit menu can act on? */
const editable = (el: Element | null): boolean =>
  !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !(el as HTMLInputElement).readOnly) || (el as HTMLElement).isContentEditable);

/** Edit menu: run a clipboard/undo command on whatever text field has focus (menus never take it). */
const editCommand = (cmd: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll'): void => {
  try {
    if (document.execCommand(cmd) || cmd !== 'paste') return;
    void navigator.clipboard
      ?.readText()
      .then(text => {
        if (text) document.execCommand('insertText', false, text);
      })
      .catch(() => undefined);
  } catch {
    /* clipboard blocked - nothing to do */
  }
};

/** A stable pseudo battery level for this computer (60-98%), draining 1% every 5 minutes. */
const batteryStart = (seed: string): number => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return 60 + (h % 39);
};

/**
 * The top menu bar: the SD mark (system menu), the focused app's name in bold, File / Edit / View /
 * Window / Help, and the status area (battery, Wi-Fi, Search, date + time). Menus open on click and
 * follow the pointer across the bar while one is open.
 */
export default function MenuBar() {
  const payload = useOS(s => s.payload)!;
  const windows = useOS(s => s.windows);
  const activeId = useOS(selectActiveId);
  const start = useOS(s => s.start);
  const now = useNow(5000);
  const [open, setOpen] = useState<string | null>(null);
  const [since] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open !== null, () => setOpen(null), ref);

  const s = useOS.getState();
  const osName = payload.desktop.osName;
  const has = (id: AppId) => payload.computer.apps.some(a => a.id === id);
  const active = windows.find(w => w.id === activeId) ?? null;
  const live = windows.filter(w => w.exit !== 'close');
  const others = live.filter(w => w.id !== activeId && !w.min);
  const fieldFocused = editable(document.activeElement);

  const about = () => s.openApp('settings', { page: 'system' });
  const lock = () => {
    lockSession();
    s.setPhase('lock');
  };
  const logout = () => {
    lockSession();
    s.closeAll();
    s.setPhase('lock');
  };

  const systemMenu: MenuEntry[] = [
    { label: t('ui.mac.sys_about'), onSelect: about, disabled: !has('settings') },
    { label: t('ui.mac.sys_settings'), onSelect: () => s.openApp('settings'), disabled: !has('settings') },
    { sep: true },
    { label: t('ui.mac.sys_lock'), onSelect: lock },
    { label: t('ui.mac.sys_logout', payload.user.name), onSelect: logout },
    { label: t('ui.mac.sys_shutdown'), onSelect: () => s.setPhase('shutdown') },
  ];

  const appMenu: MenuEntry[] = active
    ? [
        { label: t('ui.mac.app_hide', active.title), onSelect: () => s.minimize(active.id) },
        { label: t('ui.mac.app_hide_others'), onSelect: () => others.forEach(w => s.minimize(w.id)), disabled: others.length === 0 },
        { sep: true },
        { label: t('ui.mac.app_quit', active.title), shortcut: 'Alt+F4', onSelect: () => s.close(active.id) },
      ]
    : [
        { label: t('ui.mac.sys_about'), onSelect: about, disabled: !has('settings') },
        { sep: true },
        { label: t('ui.mac.desk_wallpaper'), onSelect: () => s.openApp('settings', { page: 'personalization' }), disabled: !has('settings') },
        { label: t('ui.mac.view_search'), shortcut: 'Ctrl+Space', onSelect: () => s.setStart(true) },
      ];

  const fileMenu: MenuEntry[] = [
    { label: t('ui.mac.file_open'), shortcut: 'Ctrl+Space', onSelect: () => s.setStart(true) },
    { sep: true },
    { label: t('ui.mac.file_close_window'), shortcut: 'Alt+F4', onSelect: () => active && s.close(active.id), disabled: !active },
    { label: t('ui.mac.file_close_all'), onSelect: () => live.forEach(w => s.close(w.id)), disabled: live.length === 0 },
  ];

  const editMenu: MenuEntry[] = [
    { label: t('ui.mac.edit_undo'), shortcut: 'Ctrl+Z', onSelect: () => editCommand('undo'), disabled: !fieldFocused },
    { label: t('ui.mac.edit_redo'), shortcut: 'Ctrl+Y', onSelect: () => editCommand('redo'), disabled: !fieldFocused },
    { sep: true },
    { label: t('ui.mac.edit_cut'), shortcut: 'Ctrl+X', onSelect: () => editCommand('cut'), disabled: !fieldFocused },
    { label: t('ui.mac.edit_copy'), shortcut: 'Ctrl+C', onSelect: () => editCommand('copy') },
    { label: t('ui.mac.edit_paste'), shortcut: 'Ctrl+V', onSelect: () => editCommand('paste'), disabled: !fieldFocused },
    { sep: true },
    { label: t('ui.mac.edit_select_all'), shortcut: 'Ctrl+A', onSelect: () => editCommand('selectAll') },
  ];

  const viewMenu: MenuEntry[] = [
    {
      label: active?.max ? t('ui.mac.view_exit_fullscreen') : t('ui.mac.view_fullscreen'),
      onSelect: () => active && s.toggleMax(active.id),
      disabled: !active || !active.resizable,
    },
    { sep: true },
    { label: t('ui.mac.view_show_desktop'), onSelect: () => live.forEach(w => !w.min && s.minimize(w.id)), disabled: !live.some(w => !w.min) },
    { label: t('ui.mac.view_search'), shortcut: 'Ctrl+Space', onSelect: () => s.setStart(true) },
  ];

  const windowMenu: MenuEntry[] = [
    { label: t('ui.mac.win_minimize'), onSelect: () => active && s.minimize(active.id), disabled: !active },
    { label: t('ui.mac.win_zoom'), onSelect: () => active && s.toggleMax(active.id), disabled: !active || !active.resizable },
    { label: t('ui.mac.win_restore_all'), onSelect: () => live.forEach(w => w.min && s.restore(w.id)), disabled: !live.some(w => w.min) },
    { sep: true },
    ...(live.length === 0
      ? [{ label: t('ui.mac.win_none'), disabled: true }]
      : live.map<MenuEntry>(w => ({
          label: w.title,
          mark: w.id === activeId ? 'check' : w.min ? 'diamond' : undefined,
          onSelect: () => (w.min ? s.restore(w.id) : s.focus(w.id)),
        }))),
  ];

  const helpMenu: MenuEntry[] = [
    { label: t('ui.mac.help_shortcuts'), onSelect: () => s.toast({ app: 'system', title: t('ui.mac.shortcuts_title'), body: t('ui.mac.shortcuts_body') }) },
    { sep: true },
    { label: t('ui.mac.help_about', osName), onSelect: about, disabled: !has('settings') },
  ];

  const menus: { key: string; label: ReactNode; className?: string; items: MenuEntry[] }[] = [
    { key: 'system', label: <MarkMono size={16} />, className: 'mac-mb-mark', items: systemMenu },
    { key: 'app', label: active ? active.title : osName, className: 'font-semibold', items: appMenu },
    { key: 'file', label: t('ui.mac.menu_file'), items: fileMenu },
    { key: 'edit', label: t('ui.mac.menu_edit'), items: editMenu },
    { key: 'view', label: t('ui.mac.menu_view'), items: viewMenu },
    { key: 'window', label: t('ui.mac.menu_window'), items: windowMenu },
    { key: 'help', label: t('ui.mac.menu_help'), items: helpMenu },
  ];

  const battery = Math.max(12, batteryStart(payload.computer.id) - Math.floor((now.getTime() - since) / 300000));
  const day = fmtWeekdayDate(now);

  return (
    <div
      ref={ref}
      className="mac-menubar mac-menubar-in absolute left-0 right-0 top-0 flex items-center"
      style={{ height: MENU_H, zIndex: 50 }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center h-full pl-2 min-w-0">
        {menus.map(m => (
          <div key={m.key} className="relative h-full flex items-center shrink-0">
            <button
              type="button"
              className={`mac-mb-item ${m.className ?? ''} ${open === m.key ? 'is-open' : ''}`}
              onMouseDown={e => {
                e.preventDefault();
                setOpen(o => (o === m.key ? null : m.key));
              }}
              onMouseEnter={() => {
                if (open !== null && open !== m.key) setOpen(m.key);
              }}
            >
              {m.label}
            </button>
            {open === m.key && <MenuPanel items={m.items} onClose={() => setOpen(null)} className="absolute left-0 min-w-[230px]" style={{ top: MENU_H - 2 }} />}
          </div>
        ))}
      </div>
      <div className="flex-1" />
      <div className="flex items-center h-full pr-2 gap-0.5 shrink-0">
        <span className="mac-mb-status" title={t('ui.mac.battery', battery)}>
          <span className="tabular-nums">{battery}%</span>
          <svg width="25" height="12" viewBox="0 0 25 12" aria-hidden>
            <rect x="0.5" y="0.5" width="21" height="11" rx="3.2" fill="none" stroke="currentColor" strokeOpacity="0.5" />
            <rect x="2" y="2" width={Math.max(1.5, (18 * battery) / 100)} height="8" rx="1.8" fill="currentColor" />
            <path d="M23 4.2v3.6c.8-.3 1.3-1 1.3-1.8s-.5-1.5-1.3-1.8z" fill="currentColor" fillOpacity="0.5" />
          </svg>
        </span>
        <span className="mac-mb-status" title={t('ui.mac.wifi')}>
          <Wifi size={15} strokeWidth={2.2} />
        </span>
        <button
          type="button"
          className={`mac-mb-item ${start ? 'is-open' : ''}`}
          title={t('ui.mac.search')}
          aria-label={t('ui.mac.search')}
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            setOpen(null);
            s.setStart(!useOS.getState().start);
          }}
        >
          <Search size={14} strokeWidth={2.4} />
        </button>
        <span className="mac-mb-status mac-mb-clock">
          <span>{day}</span>
          <span>{fmtTime(now, payload.desktop.clock24)}</span>
        </span>
      </div>
    </div>
  );
}
