import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { AppProps } from '../registry';
import { useOS, selectActiveId } from '@/store/os';
import { t } from '@/i18n';
import { Button, InfoBar, Spinner } from '@/ui/controls';
import type { Network, Tab } from './types';
import { HOME, MAX_TABS, currentAddress, cx, launchAddress, makeTab, normalizeAddress, resolve, step, viewTitle, visit } from './model';
import { useSites } from './useSites';
import { LoadBar, type OpenFn } from './parts';
import TabStrip, { type TabInfo } from './TabStrip';
import Toolbar, { BookmarksBar } from './Toolbar';
import StartPage from './StartPage';
import SitePage from './SitePage';
import FramePage from './FramePage';
import NotFound from './NotFound';

/**
 * One tab's page. Every tab stays mounted and the ones not being looked at are only hidden, so a
 * framed site keeps its place and a page its scroll position. Going anywhere (or Reload) draws
 * the page afresh: that is what the key is for.
 */
function PageLayer({ tab, net, shown, winActive, onOpen }: { tab: Tab; net: Network; shown: boolean; winActive: boolean; onOpen: OpenFn }) {
  const address = currentAddress(tab);
  const view = resolve(address, net);
  const key = `${tab.at}:${tab.nonce}:${address}`;
  return (
    <div className={cx('absolute inset-0', !shown && 'invisible pointer-events-none')} aria-hidden={!shown}>
      {view.kind === 'home' && <StartPage key={key} net={net} focus={shown && winActive} onOpen={onOpen} />}
      {view.kind === 'page' && <SitePage key={key} site={view.site} blocks={view.blocks} net={net} onOpen={onOpen} />}
      {view.kind === 'frame' && <FramePage key={key} site={view.site} url={view.url} covered={!winActive} />}
      {view.kind === 'missing' && <NotFound key={key} address={view.address} net={net} onOpen={onOpen} />}
    </div>
  );
}

/**
 * Browser: the closed network of configs/shared/browser.lua. Tabs, a toolbar (Back, Forward,
 * Reload, Home, the address bar) and the bookmarks sit on the window; the page lies under them.
 * An address is looked up in the list the server sent and nowhere else - a built-in page is drawn
 * from its blocks, a `url` site is framed, and anything the list does not have "can't be reached".
 */
export default function Browser({ win }: AppProps) {
  const winActive = useOS(selectActiveId) === win.id;
  const { net, loading, error, reload } = useSites();

  // What the window was opened with: a page another app asked for, or nothing (Home).
  const [launch] = useState(() => launchAddress(win.props));
  const [tabs, setTabs] = useState<Tab[]>(() => [makeTab(launch ?? HOME)]);
  const [activeKey, setActiveKey] = useState(() => tabs[0].key);
  const addressInput = useRef<HTMLInputElement>(null);

  // Where Home is, only the network knows. The first tab was opened on the start page before it
  // loaded: if Home turns out to be a site, the tab moves there before anything is drawn.
  const [homed, setHomed] = useState(false);
  if (net && !homed) {
    setHomed(true);
    if (launch === null && net.home !== HOME) {
      setTabs(list => list.map(x => (x.stack.length === 1 && x.stack[0] === HOME ? { ...x, stack: [net.home] } : x)));
    }
  }

  const tab = tabs.find(x => x.key === activeKey) ?? tabs[0];
  const address = currentAddress(tab);
  const view = net ? resolve(address, net) : null;

  const patch = (key: string, fn: (x: Tab) => Tab) => setTabs(list => list.map(x => (x.key === key ? fn(x) : x)));

  /** Go to an address: in the tab being looked at, or (Ctrl-click, middle click) in one of its own. */
  const open: OpenFn = (raw, newTab = false) => {
    const to = normalizeAddress(raw);
    if (!to) return;
    if (newTab && tabs.length < MAX_TABS) {
      const next = makeTab(to);
      setTabs(list => [...list, next]);
      setActiveKey(next.key);
    } else {
      patch(tab.key, x => visit(x, to));
    }
  };

  const back = () => patch(tab.key, x => step(x, -1));
  const forward = () => patch(tab.key, x => step(x, 1));

  /** Reload asks the server for the network again and draws the page from scratch. */
  const reloadPage = () => {
    patch(tab.key, x => ({ ...x, nonce: x.nonce + 1 }));
    void reload();
  };

  const newTab = () => {
    if (net && tabs.length < MAX_TABS) open(net.home, true);
  };

  /** Close a tab; the one beside it takes over. Closing the last one closes the window. */
  const closeTab = (key: string) => {
    const i = tabs.findIndex(x => x.key === key);
    if (i < 0) return;
    if (tabs.length === 1) {
      useOS.getState().close(win.id);
      return;
    }
    const rest = tabs.filter(x => x.key !== key);
    setTabs(rest);
    if (key === tab.key) setActiveKey(rest[Math.min(i, rest.length - 1)].key);
  };

  // Opening the Browser again with an address (openApp replaces props) shows it in a new tab,
  // so the page being read is not lost.
  const lastProps = useRef(win.props);
  useEffect(() => {
    if (win.props === lastProps.current) return;
    lastProps.current = win.props;
    const to = launchAddress(win.props);
    if (to) open(to, true);
  }, [win.props]);

  // Shortcuts, while this is the window in front. The ref keeps the handler on this render's tab.
  const keys = useRef({ back, forward, reloadPage, newTab, closeTab, key: tab.key });
  keys.current = { back, forward, reloadPage, newTab, closeTab, key: tab.key };
  useEffect(() => {
    if (!winActive) return;
    const onKey = (e: KeyboardEvent) => {
      const os = useOS.getState();
      if (os.start || os.flyout) return;
      const k = keys.current;
      const ctrl = e.ctrlKey || e.metaKey;
      const letter = ctrl && !e.altKey ? e.key.toLowerCase() : '';
      if (e.altKey && !ctrl && e.key === 'ArrowLeft') k.back();
      else if (e.altKey && !ctrl && e.key === 'ArrowRight') k.forward();
      else if ((e.key === 'F5' && !ctrl && !e.altKey) || letter === 'r') k.reloadPage();
      else if (letter === 'l') {
        addressInput.current?.focus();
        addressInput.current?.select();
      } else if (letter === 't') k.newTab();
      else if (letter === 'w') k.closeTab(k.key);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [winActive]);

  const infos: TabInfo[] = tabs.map(x => {
    const v = net ? resolve(currentAddress(x), net) : null;
    return { key: x.key, title: v ? viewTitle(v) : win.title, kind: v ? v.kind : 'loading' };
  });
  const bookmarks = net ? net.sites.filter(s => s.bookmark) : [];

  return (
    <div className="relative h-full w-full flex flex-col bg-win overflow-hidden">
      <TabStrip tabs={infos} activeKey={tab.key} canAdd={net !== null && tabs.length < MAX_TABS} onSelect={setActiveKey} onClose={closeTab} onNew={newTab} />
      <Toolbar
        address={address}
        kind={view ? view.kind : 'loading'}
        ready={net !== null}
        canBack={net !== null && tab.at > 0}
        canForward={net !== null && tab.at < tab.stack.length - 1}
        inputRef={addressInput}
        onBack={back}
        onForward={forward}
        onReload={reloadPage}
        onHome={() => net && open(net.home)}
        onGo={open}
      />
      {bookmarks.length > 0 && <BookmarksBar sites={bookmarks} current={address} onOpen={open} />}

      <div className="relative flex-1 min-h-0 flex flex-col bg-layer border-t border-stroke">
        {!net ? (
          loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 fade-in">
              <Spinner />
              <span className="text-caption text-t2">{t('ui.browser.connecting')}</span>
            </div>
          ) : (
            <div className="p-6 flex flex-col items-start gap-3 max-w-[560px]">
              <div className="w-full">
                <InfoBar severity="error" title={t('ui.browser.load_failed')}>
                  {error ?? t('ui.common.error')}
                </InfoBar>
              </div>
              <Button icon={<RefreshCw size={16} />} onClick={() => void reload()}>
                {t('ui.common.retry')}
              </Button>
            </div>
          )
        ) : (
          <>
            {/* (A framed site draws its own bar until the frame has loaded.) */}
            {loading && view?.kind !== 'frame' && <LoadBar />}
            {error && (
              <div className="shrink-0 px-6 pt-4">
                <InfoBar severity="error" title={t('ui.browser.refresh_failed')}>
                  {error}{' '}
                  <button type="button" className="text-accent-text hover:underline ml-1" onClick={() => void reload()}>
                    {t('ui.common.retry')}
                  </button>
                </InfoBar>
              </div>
            )}
            <div className="relative flex-1 min-h-0">
              {tabs.map(x => (
                <PageLayer key={x.key} tab={x} net={net} shown={x.key === tab.key} winActive={winActive} onOpen={open} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
