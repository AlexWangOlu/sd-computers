import { useEffect, useRef, useState } from 'react';
import { Globe, Search } from 'lucide-react';
import { t } from '@/i18n';
import { TextInput } from '@/ui/controls';
import type { Network } from './types';
import { cx, searchSites } from './model';
import { Column, SiteCard, type OpenFn } from './parts';

/**
 * 'home', the browser's own start page: a search box over every site on the network (by title or
 * address) and, until something is typed, a tile for each bookmarked one.
 */
export default function StartPage({ net, focus, onOpen }: { net: Network; focus: boolean; onOpen: OpenFn }) {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const q = query.trim();
  const shown = q ? searchSites(net.sites, q) : net.sites.filter(s => s.bookmark);

  // A fresh start page in the tab being looked at is there to be typed into. Only when the page
  // arrives: coming back to the tab later leaves the focus where it was.
  const focusOnArrival = useRef(focus);
  useEffect(() => {
    if (focusOnArrival.current) input.current?.focus({ preventScroll: true });
  }, []);

  return (
    <Column wide>
      <div className="flex flex-col items-center text-center">
        <span className="w-12 h-12 rounded-win flex items-center justify-center bg-[var(--accent-soft)] text-accent-text">
          <Globe size={24} />
        </span>
        <h1 className="mt-4 text-title font-semibold text-t1">{t('ui.browser.start_title')}</h1>
        <p className="mt-1 text-body text-t2">{t('ui.browser.start_hint')}</p>
      </div>

      <div className="relative mt-6 mx-auto w-full max-w-[520px]">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-t3 pointer-events-none" />
        <TextInput
          ref={input}
          value={query}
          maxLength={80}
          autoComplete="off"
          placeholder={t('ui.browser.search')}
          aria-label={t('ui.browser.search')}
          className="!h-10 pl-9"
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && q && shown[0]) onOpen(shown[0].address, e.ctrlKey || e.metaKey);
            if (e.key === 'Escape' && query) {
              e.stopPropagation();
              setQuery('');
            }
          }}
        />
      </div>

      <div className="mt-8">
        {shown.length > 0 ? (
          <>
            <div className="mb-2 text-caption font-semibold text-t2">{q ? t('ui.browser.results', shown.length) : t('ui.browser.bookmarks')}</div>
            <div className={cx('grid gap-2 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]', !q && 'stagger')}>
              {shown.map(s => (
                <SiteCard key={s.address} title={s.title} detail={s.address} onOpen={newTab => onOpen(s.address, newTab)} />
              ))}
            </div>
          </>
        ) : (
          <div className="py-6 text-center">
            <div className="text-body font-semibold text-t1">{q ? t('ui.browser.no_results', q) : t('ui.browser.no_bookmarks')}</div>
            <div className="mt-1 text-caption text-t2">{q ? t('ui.browser.no_results_hint') : t('ui.browser.no_bookmarks_hint')}</div>
          </div>
        )}
      </div>
    </Column>
  );
}
