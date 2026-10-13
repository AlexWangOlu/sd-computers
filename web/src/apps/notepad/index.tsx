import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppProps } from '../registry';
import { useOS, selectActiveId, setCloseGuard } from '@/store/os';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { fmtShortDate, fmtTime } from '@/lib/format';
import { Button, Dialog, InfoBar, Spinner } from '@/ui/controls';
import {
  MAX_BODY,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  asNotes,
  blankTab,
  deriveTitle,
  isDirty,
  isPristine,
  lineCol,
  loadPrefs,
  savePrefs,
  tabFromNote,
  tabTitle,
  type Note,
  type Tab,
  type ViewPrefs,
} from './model';
import TabStrip from './TabStrip';
import MenuBar, { type MenuDef } from './MenuBar';
import StatusBar from './StatusBar';
import OpenDialog from './OpenDialog';
import { PrintSlot, askPrint, usePrinting } from '@/os/print/PrintDialog';

// `closing`: the prompt came from closing the whole window - resolving it carries on closing.
type DialogState = { kind: 'open' } | { kind: 'unsaved'; key: string; closing?: boolean } | { kind: 'delete'; key: string } | null;

interface Caret {
  start: number;
  end: number;
  /** the moving end of the selection - what Ln/Col reports */
  pos: number;
}

/** Text from our own Cut/Copy: Paste falls back to it when the clipboard API is unavailable. */
let internalClipboard = '';

/**
 * Notepad with tabs, editing the character's roaming notes. No autosave (real Notepad
 * has none): Ctrl+S saves, closing a dirty tab asks first. Every tab keeps its own <textarea>
 * (hidden when inactive) so caret, scroll position and native undo survive tab switches.
 */
export default function Notepad({ win }: AppProps) {
  const clock24 = useOS(s => s.payload?.desktop.clock24 ?? false);
  const active = useOS(selectActiveId) === win.id;
  const printing = usePrinting();

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<ViewPrefs>(loadPrefs);
  const [caret, setCaret] = useState<Caret>({ start: 0, end: 0, pos: 0 });

  const editors = useRef(new Map<string, HTMLTextAreaElement>());
  const editorBox = useRef<HTMLDivElement>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeRef = useRef(active);
  activeRef.current = active;

  const tab = tabs.find(x => x.key === activeKey) ?? null;
  const editor = (): HTMLTextAreaElement | null => (activeKey ? editors.current.get(activeKey) ?? null : null);

  // First open: the most recently edited note, or an empty Untitled tab.
  useEffect(() => {
    let alive = true;
    void rpc<Note[]>('notes:list').then(r => {
      if (!alive) return;
      if (!r.ok) setError(r.error ?? t('ui.common.error'));
      const latest = r.ok ? asNotes(r.data)[0] : undefined;
      const first = latest ? tabFromNote(latest) : blankTab();
      setTabs([first]);
      setActiveKey(first.key);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => savePrefs(prefs), [prefs]);

  // Closing the WINDOW (title-bar X, Alt+F4) with unsaved tabs asks per tab first, like Notepad.
  // Tabs the user chose "Don't save" for are remembered so the re-check doesn't ask again.
  const discarded = useRef(new Set<string>());
  useEffect(() => {
    setCloseGuard(win.id, () => {
      const dirty = tabsRef.current.find(x => isDirty(x) && !discarded.current.has(x.key));
      if (!dirty) return true;
      setActiveKey(dirty.key);
      setDialog({ kind: 'unsaved', key: dirty.key, closing: true });
      return false;
    });
    return () => setCloseGuard(win.id, null);
  }, [win.id]);

  /** After resolving one tab of a window-close prompt, try closing again (next dirty tab, or done). */
  const continueClosing = () => window.setTimeout(() => useOS.getState().close(win.id), 30);

  const syncCaret = (el: HTMLTextAreaElement) => {
    const pos = el.selectionDirection === 'backward' ? el.selectionStart : el.selectionEnd;
    setCaret(c => (c.start === el.selectionStart && c.end === el.selectionEnd && c.pos === pos ? c : { start: el.selectionStart, end: el.selectionEnd, pos }));
  };

  // Switching tabs (or closing a dialog) puts the caret back in the visible editor.
  useEffect(() => {
    if (dialog || !activeKey) return;
    const el = editors.current.get(activeKey);
    if (!el) return;
    syncCaret(el);
    if (activeRef.current) el.focus({ preventScroll: true });
  }, [activeKey, dialog]);

  // Ctrl + mouse wheel zooms, like Notepad (native listener: React's wheel handlers are passive).
  useEffect(() => {
    const box = editorBox.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => box.removeEventListener('wheel', onWheel);
  }, [loading]);

  const setBody = (key: string, body: string) => setTabs(ts => ts.map(x => (x.key === key ? { ...x, body: body.slice(0, MAX_BODY) } : x)));

  // ── tabs ────────────────────────────────────────────────────────────────

  const newTab = () => {
    const tb = blankTab();
    setTabs(ts => [...ts, tb]);
    setActiveKey(tb.key);
  };

  const openNote = (n: Note) => {
    setDialog(null);
    const id = String(n.id);
    const existing = tabsRef.current.find(x => x.id === id);
    if (existing) {
      setActiveKey(existing.key);
      return;
    }
    const tb = tabFromNote(n);
    const cur = tabsRef.current.find(x => x.key === activeKey);
    setTabs(ts => (cur && isPristine(cur) ? ts.map(x => (x.key === cur.key ? tb : x)) : [...ts, tb]));
    setActiveKey(tb.key);
  };

  /** Remove a tab; the last one closing closes Notepad (unless `keepWindow`, which leaves a blank tab). */
  const dropTab = (key: string, keepWindow = false) => {
    const ts = tabsRef.current;
    const i = ts.findIndex(x => x.key === key);
    if (i < 0) return;
    const rest = ts.filter(x => x.key !== key);
    if (rest.length === 0) {
      if (!keepWindow) {
        useOS.getState().close(win.id);
        return;
      }
      rest.push(blankTab());
    }
    editors.current.delete(key);
    setTabs(rest);
    if (key === activeKey || !rest.some(x => x.key === activeKey)) setActiveKey(rest[Math.min(i, rest.length - 1)].key);
  };

  const closeTab = (key: string) => {
    const tb = tabsRef.current.find(x => x.key === key);
    if (!tb) return;
    if (isDirty(tb)) {
      setActiveKey(key);
      setDialog({ kind: 'unsaved', key });
    } else dropTab(key);
  };

  const cycleTab = (d: number) => {
    const ts = tabsRef.current;
    if (ts.length < 2) return;
    const i = ts.findIndex(x => x.key === activeKey);
    setActiveKey(ts[(i + d + ts.length) % ts.length].key);
  };

  // ── server ──────────────────────────────────────────────────────────────

  const save = async (key: string): Promise<boolean> => {
    const tb = tabsRef.current.find(x => x.key === key);
    if (!tb || busy) return false;
    const body = tb.body;
    const title = tb.title ?? deriveTitle(body);
    setBusy(true);
    const r = await rpc<Note>('notes:save', { note: { id: tb.id ?? undefined, title, body } });
    setBusy(false);
    if (!r.ok || !r.data) {
      setError(r.error ?? t('ui.common.error'));
      return false;
    }
    const n = r.data;
    setError(null);
    setTabs(ts => ts.map(x => (x.key === key ? { ...x, id: String(n.id), title: n.title || title, saved: body } : x)));
    return true;
  };

  const remove = async (key: string) => {
    const tb = tabsRef.current.find(x => x.key === key);
    if (!tb?.id) return;
    setBusy(true);
    const r = await rpc('notes:delete', { id: tb.id });
    setBusy(false);
    setDialog(null);
    if (!r.ok) {
      setError(r.error ?? t('ui.common.error'));
      return;
    }
    setError(null);
    dropTab(key, true);
  };

  // ── edit ────────────────────────────────────────────────────────────────

  const insertText = (text: string) => {
    const el = editor();
    if (!el || !activeKey) return;
    el.focus();
    if (!document.execCommand('insertText', false, text)) {
      const a = el.selectionStart;
      const v = el.value.slice(0, a) + text + el.value.slice(el.selectionEnd);
      setBody(activeKey, v);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = Math.min(a + text.length, MAX_BODY);
        syncCaret(el);
      });
    }
  };

  const selectedText = (): string => {
    const el = editor();
    return el ? el.value.slice(el.selectionStart, el.selectionEnd) : '';
  };

  const editCmd = (cmd: 'undo' | 'cut' | 'copy') => {
    const el = editor();
    if (!el) return;
    el.focus();
    if (cmd !== 'undo') internalClipboard = selectedText() || internalClipboard;
    const done = document.execCommand(cmd);
    if (!done && cmd === 'cut') document.execCommand('delete');
  };

  const paste = async () => {
    let text: string | null = null;
    try {
      text = (await navigator.clipboard?.readText?.()) ?? null;
    } catch {
      text = null;
    }
    if (!text) text = internalClipboard;
    if (text) insertText(text);
    else editor()?.focus();
  };

  const selectAll = () => {
    const el = editor();
    if (!el) return;
    el.focus();
    el.select();
    syncCaret(el);
  };

  const insertTimeDate = () => {
    const now = new Date();
    insertText(`${fmtTime(now, clock24)} ${fmtShortDate(now)}`);
  };

  const zoomBy = (d: number) => setPrefs(p => ({ ...p, zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, p.zoom + d)) }));
  const zoomReset = () => setPrefs(p => ({ ...p, zoom: 100 }));

  // ── keyboard (only while this window is focused) ────────────────────────

  /** Print the tab as it is on the screen, saved or not. */
  const print = () => {
    if (tab && printing) askPrint('notepad', { source: 'text', title: tabTitle(tab), data: { title: tabTitle(tab), body: tab.body } });
  };

  // The listener is bound once per focus change and reads the latest handlers/state from here.
  const live = { newTab, closeTab, save, cycleTab, zoomBy, zoomReset, insertTimeDate, print, dialog, activeKey, busy };
  const keys = useRef(live);
  keys.current = live;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const os = useOS.getState();
      if (os.start || os.flyout) return;
      const k = keys.current;
      if (e.key === 'Escape') {
        if (k.dialog && !k.busy) {
          e.preventDefault();
          setDialog(null);
        }
        return;
      }
      if (k.dialog || !k.activeKey) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === 'F5' && !ctrl && !e.altKey) {
        e.preventDefault();
        k.insertTimeDate();
        return;
      }
      if (!ctrl || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'n' && !e.shiftKey) k.newTab();
      else if (key === 'o') setDialog({ kind: 'open' });
      else if (key === 's') void k.save(k.activeKey);
      else if (key === 'p') k.print();
      else if (key === 'w') k.closeTab(k.activeKey);
      else if (key === '=' || key === '+') k.zoomBy(ZOOM_STEP);
      else if (key === '-' || key === '_') k.zoomBy(-ZOOM_STEP);
      else if (key === '0') k.zoomReset();
      else if (key === 'tab') k.cycleTab(e.shiftKey ? -1 : 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  // ── menus ───────────────────────────────────────────────────────────────

  const hasSel = caret.end > caret.start;
  const menus: MenuDef[] = [
    {
      id: 'file',
      label: t('ui.notepad.menu_file'),
      items: [
        { kind: 'item', label: t('ui.notepad.file_new'), accel: t('ui.notepad.key_new'), onClick: newTab },
        { kind: 'item', label: t('ui.notepad.file_open'), accel: t('ui.notepad.key_open'), onClick: () => setDialog({ kind: 'open' }) },
        { kind: 'item', label: t('ui.notepad.file_save'), accel: t('ui.notepad.key_save'), onClick: () => activeKey && void save(activeKey), disabled: !tab || busy },
        ...(printing ? [{ kind: 'item' as const, label: t('ui.print.menu'), accel: t('ui.print.key'), onClick: print, disabled: !tab || tab.body.trim() === '' }] : []),
        { kind: 'sep' },
        { kind: 'item', label: t('ui.notepad.file_delete'), onClick: () => activeKey && setDialog({ kind: 'delete', key: activeKey }), disabled: !tab?.id || busy },
        { kind: 'sep' },
        { kind: 'item', label: t('ui.notepad.file_close'), accel: t('ui.notepad.key_close'), onClick: () => activeKey && closeTab(activeKey), disabled: !tab },
      ],
    },
    {
      id: 'edit',
      label: t('ui.notepad.menu_edit'),
      items: [
        { kind: 'item', label: t('ui.notepad.edit_undo'), accel: t('ui.notepad.key_undo'), onClick: () => editCmd('undo'), disabled: !tab },
        { kind: 'sep' },
        { kind: 'item', label: t('ui.notepad.edit_cut'), accel: t('ui.notepad.key_cut'), onClick: () => editCmd('cut'), disabled: !hasSel },
        { kind: 'item', label: t('ui.notepad.edit_copy'), accel: t('ui.notepad.key_copy'), onClick: () => editCmd('copy'), disabled: !hasSel },
        { kind: 'item', label: t('ui.notepad.edit_paste'), accel: t('ui.notepad.key_paste'), onClick: () => void paste(), disabled: !tab },
        { kind: 'sep' },
        { kind: 'item', label: t('ui.notepad.edit_select_all'), accel: t('ui.notepad.key_select_all'), onClick: selectAll, disabled: !tab },
        { kind: 'item', label: t('ui.notepad.edit_time_date'), accel: t('ui.notepad.key_time_date'), onClick: insertTimeDate, disabled: !tab },
      ],
    },
    {
      id: 'view',
      label: t('ui.notepad.menu_view'),
      items: [
        {
          kind: 'sub',
          label: t('ui.notepad.view_zoom'),
          items: [
            { kind: 'item', label: t('ui.notepad.zoom_in'), accel: t('ui.notepad.key_zoom_in'), onClick: () => zoomBy(ZOOM_STEP), disabled: prefs.zoom >= ZOOM_MAX },
            { kind: 'item', label: t('ui.notepad.zoom_out'), accel: t('ui.notepad.key_zoom_out'), onClick: () => zoomBy(-ZOOM_STEP), disabled: prefs.zoom <= ZOOM_MIN },
            { kind: 'item', label: t('ui.notepad.zoom_reset'), accel: t('ui.notepad.key_zoom_reset'), onClick: zoomReset },
          ],
        },
        { kind: 'item', label: t('ui.notepad.view_status'), checked: prefs.status, onClick: () => setPrefs(p => ({ ...p, status: !p.status })) },
        { kind: 'item', label: t('ui.notepad.view_wrap'), checked: prefs.wrap, onClick: () => setPrefs(p => ({ ...p, wrap: !p.wrap })) },
      ],
    },
  ];

  // ── render ──────────────────────────────────────────────────────────────

  const pos = useMemo(() => lineCol(tab?.body ?? '', Math.min(caret.pos, tab?.body.length ?? 0)), [tab?.body, caret.pos]);
  const fontSize = (14 * prefs.zoom) / 100;
  const openIds = useMemo(() => new Set(tabs.map(x => x.id).filter((x): x is string => !!x)), [tabs]);
  const dialogTab = dialog && dialog.kind !== 'open' ? tabs.find(x => x.key === dialog.key) ?? null : null;

  return (
    <div className="relative h-full w-full flex flex-col bg-win overflow-hidden">
      <TabStrip tabs={tabs} activeKey={activeKey} onSelect={setActiveKey} onClose={closeTab} onNew={newTab} />

      <div className="flex-1 min-h-0 flex flex-col bg-layer">
        <MenuBar menus={menus} />
        {error && (
          <div className="shrink-0 px-3 pt-2">
            <InfoBar severity="error" onClose={() => setError(null)}>
              {error}
            </InfoBar>
          </div>
        )}
        <div ref={editorBox} className="relative flex-1 min-h-0">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner size={28} />
            </div>
          ) : (
            tabs.map(tb => (
              <textarea
                key={tb.key}
                ref={el => {
                  if (el) editors.current.set(tb.key, el);
                }}
                value={tb.body}
                maxLength={MAX_BODY}
                spellCheck={false}
                autoComplete="off"
                wrap={prefs.wrap ? 'soft' : 'off'}
                aria-label={tabTitle(tb)}
                onChange={e => {
                  setBody(tb.key, e.target.value);
                  syncCaret(e.target);
                }}
                onSelect={e => syncCaret(e.currentTarget)}
                onKeyDown={e => {
                  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    e.preventDefault();
                    insertText('\t');
                  }
                }}
                onCopy={e => {
                  internalClipboard = e.currentTarget.value.slice(e.currentTarget.selectionStart, e.currentTarget.selectionEnd) || internalClipboard;
                }}
                onCut={e => {
                  internalClipboard = e.currentTarget.value.slice(e.currentTarget.selectionStart, e.currentTarget.selectionEnd) || internalClipboard;
                }}
                className={`absolute inset-0 w-full h-full resize-none border-0 outline-none bg-layer text-t1 font-mono px-4 py-3 os-scroll ${tb.key === activeKey ? 'fade-in' : 'hidden'}`}
                style={{
                  fontFamily: 'var(--notepad-font, "JetBrains Mono Variable", "Courier New", monospace)',
                  fontSize,
                  lineHeight: 1.4,
                  tabSize: 8,
                  whiteSpace: prefs.wrap ? 'pre-wrap' : 'pre',
                  overflowWrap: prefs.wrap ? 'break-word' : 'normal',
                  overflowX: prefs.wrap ? 'hidden' : 'auto',
                }}
              />
            ))
          )}
        </div>
      </div>

      {prefs.status && (
        <StatusBar ln={pos.ln} col={pos.col} chars={tab?.body.length ?? 0} selected={caret.end - caret.start} zoom={prefs.zoom} busy={busy} />
      )}

      {dialog?.kind === 'open' && <OpenDialog openIds={openIds} onOpen={openNote} onClose={() => setDialog(null)} />}

      {dialog?.kind === 'unsaved' && dialogTab && (
        <Dialog
          title={t('ui.notepad.unsaved_title')}
          onClose={() => !busy && setDialog(null)}
          actions={
            <>
              <Button
                variant="accent"
                disabled={busy}
                onClick={() => {
                  const closing = dialog.closing;
                  void save(dialogTab.key).then(ok => {
                    if (!ok) return;
                    setDialog(null);
                    if (closing) continueClosing();
                    else dropTab(dialogTab.key);
                  });
                }}
              >
                {t('ui.common.save')}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  setDialog(null);
                  if (dialog.closing) {
                    discarded.current.add(dialogTab.key);
                    continueClosing();
                  } else dropTab(dialogTab.key);
                }}
              >
                {t('ui.notepad.dont_save')}
              </Button>
              <Button disabled={busy} onClick={() => setDialog(null)}>
                {t('ui.common.cancel')}
              </Button>
            </>
          }
        >
          {t('ui.notepad.unsaved_body', tabTitle(dialogTab))}
        </Dialog>
      )}

      {dialog?.kind === 'delete' && dialogTab && (
        <Dialog
          title={t('ui.notepad.delete_title')}
          onClose={() => !busy && setDialog(null)}
          actions={
            <>
              <Button variant="danger" disabled={busy} onClick={() => void remove(dialogTab.key)}>
                {t('ui.common.delete')}
              </Button>
              <Button disabled={busy} onClick={() => setDialog(null)}>
                {t('ui.common.cancel')}
              </Button>
            </>
          }
        >
          {t('ui.notepad.delete_body', tabTitle(dialogTab))}
        </Dialog>
      )}

      <PrintSlot app="notepad" />
    </div>
  );
}
