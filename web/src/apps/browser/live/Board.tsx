import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowDownWideNarrow, Clock, Gift, LayoutGrid, Pencil, Plus, Search, ShoppingBag, Tag as TagIcon, Trash2, UserRound } from 'lucide-react';
import { fmtMoney, fmtTime } from '@/lib/format';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { cx, part, under } from '../model';
import { asAd, asBoard, type Ad, type Board as BoardData, type BoardKind } from './data';
import { act, forget, useLive, type Live } from './useLive';
import { A, Area, Btn, Contact, Failed, Field, Input, Modal, Note, Nothing, PhotoField, Picture, Site, Tag, Waiting, fmtNumber, type LiveProps } from './parts';

// The two classified boards - Marketplace (things for sale, with a price) and the Yellow Pages
// (adverts, without one). On the phone they are one app twice; here they are two sites that share
// what they do and nothing of how they look. Marketplace is the grey-and-white kind of page where
// the picture and the price come first: a search bar across the top, filters down the side, a
// grid of cards. The Yellow Pages are the phone book: yellow and black, one advert a row, and the
// number where the eye lands. Both show every ad that is up, a page for each, and for the player
// at the desk their own - to put up, change and take down, under the phone's limits. An ad queued
// on the phone for later shows among their own with its time; changing one from here would send
// it out at once, so those are only taken down.

/** The board's own wording: ui.browser.market_* / ui.browser.pages_*. */
const word = (kind: BoardKind, key: string, ...args: unknown[]): string => t(`ui.browser.${kind}_${key}`, ...args);

const priceOf = (kind: BoardKind, a: Ad): string | null => (kind !== 'market' ? null : a.price === undefined ? t('ui.browser.market_wanted') : a.price === 0 ? t('ui.browser.market_free') : fmtMoney(a.price));

/** What was last typed in each board's search: a page is drawn afresh as the tab moves, the search should not be. */
const typed: Record<BoardKind, string> = { market: '', pages: '' };

type Show = 'all' | 'sale' | 'wanted' | 'free';
type Sort = 'new' | 'low' | 'high';

// ── What both boards do ────────────────────────────────────────────────────────────────────

/** Take one of the player's own ads down, after asking. Returns the button and the question. */
function useTakeDown(kind: BoardKind, board: Live<BoardData>, after: () => void) {
  const [asking, setAsking] = useState<Ad | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async (a: Ad) => {
    setAsking(null);
    setBusy(true);
    const res = await act('web:ads:delete', { board: kind, id: a.id });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    forget('web:ads');
    if (board.data) board.put({ ...board.data, items: board.data.items.filter(x => x.id !== a.id) });
    after();
  };

  const question = asking && (
    <Modal
      title={t('ui.browser.ads_delete_title')}
      onClose={() => setAsking(null)}
      actions={
        <>
          <Btn onClick={() => setAsking(null)}>{t('ui.common.cancel')}</Btn>
          <Btn kind="danger" onClick={() => void remove(asking)}>
            {t('ui.browser.ads_take_down')}
          </Btn>
        </>
      }
    >
      {t('ui.browser.ads_delete_body', asking.title)}
    </Modal>
  );
  return { ask: setAsking, busy, error, clearError: () => setError(null), question };
}

/** The form an ad is written in: a new one, or one of the player's own being changed. */
function AdForm({ kind, editing, board, props }: { kind: BoardKind; editing?: Ad; board: Live<BoardData>; props: LiveProps }) {
  const { site, onOpen } = props;
  const data = board.data;
  const limits = data?.limits;
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [price, setPrice] = useState(editing?.price !== undefined ? String(editing.price) : '');
  const [images, setImages] = useState<string[]>(editing?.images ?? []);
  const [number, setNumber] = useState(editing ? editing.number ?? '' : data?.number ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data || !limits) return null;

  const digits = number.replace(/\D/g, '');
  const amount = price.trim() === '' ? undefined : Math.min(limits.price, Math.max(0, Math.floor(Number(price) || 0)));
  const ready = title.trim() !== '' && body.trim() !== '' && (digits !== '' || email.trim() !== '');

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await act<{ item?: unknown }>('web:ads:save', { board: kind, id: editing?.id, title: title.trim(), body: body.trim(), price: amount, images, number: digits, email: email.trim() });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    forget('web:ads');
    const item = res.data?.item ? asAd(res.data.item) : null;
    if (item) {
      board.put({ ...data, items: [item, ...data.items.filter(x => x.id !== item.id)] });
      onOpen(under(site, 'item', item.id));
    } else {
      onOpen(under(site, 'mine'));
    }
  };

  return (
    <div className={cx('mx-auto w-full max-w-[640px]', kind === 'market' && 'mk-panel p-6')}>
      <h1 className={cx('mb-5', kind === 'market' ? 'text-[22px] font-bold' : 'yp-name !text-[26px]')}>{word(kind, editing ? 'edit' : 'new')}</h1>

      {error && (
        <div className="mb-4">
          <Note tone="error" onClose={() => setError(null)}>
            {error}
          </Note>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Field label={t('ui.browser.ads_f_title')} aside={`${title.length} / ${limits.title}`}>
          <Input value={title} maxLength={limits.title} onChange={e => setTitle(e.target.value)} autoFocus />
        </Field>
        {kind === 'market' && (
          <div className="w-48">
            <Field label={t('ui.browser.ads_f_price')}>
              <Input value={price} inputMode="numeric" maxLength={12} onChange={e => setPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder={t('ui.browser.ads_f_price_hint')} />
            </Field>
          </div>
        )}
        <Field label={t('ui.browser.ads_f_body')} aside={`${body.length} / ${limits.body}`}>
          <Area value={body} maxLength={limits.body} onChange={e => setBody(e.target.value)} className="h-32" />
        </Field>
        <div>
          <span className="s-label">{t('ui.browser.ads_f_photos', limits.images)}</span>
          <PhotoField images={images} max={limits.images} onChange={setImages} />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <Field label={t('ui.browser.ads_f_number')}>
              <Input value={number} inputMode="tel" maxLength={limits.contact} onChange={e => setNumber(e.target.value)} />
            </Field>
          </div>
          <div className="flex-1">
            <Field label={t('ui.browser.ads_f_email')}>
              <Input value={email} maxLength={128} onChange={e => setEmail(e.target.value)} />
            </Field>
          </div>
        </div>
        <p className="s-faint -mt-2 text-[12px]">{t('ui.browser.ads_f_contact_hint')}</p>

        <div className="flex items-center gap-2 pt-1">
          <Btn kind="primary" className={kind === 'market' ? 'mk-pill' : undefined} disabled={busy || !ready} onClick={() => void save()}>
            {t(editing ? 'ui.common.save' : 'ui.browser.ads_put_up')}
          </Btn>
          <Btn kind="ghost" disabled={busy} onClick={() => onOpen(editing ? under(site, 'item', editing.id) : site.address)}>
            {t('ui.common.cancel')}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/** The player's own ads: what is up, and what is queued on their phone. */
function Mine({ kind, data, board, props }: { kind: BoardKind; data: BoardData; board: Live<BoardData>; props: LiveProps }) {
  const { site, onOpen } = props;
  const clock24 = useOS(s => s.payload?.desktop.clock24 ?? false);
  const down = useTakeDown(kind, board, () => {});
  const mine = data.items.filter(a => a.mine);
  const full = mine.length >= data.limits.perPlayer;

  return (
    <div className={cx('mx-auto w-full max-w-[760px]', kind === 'market' && 'mk-panel p-6')}>
      <div className="mb-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className={kind === 'market' ? 'text-[22px] font-bold' : 'yp-name !text-[26px]'}>{word(kind, 'mine')}</h1>
          <p className="s-muted text-[13px]">{t('ui.browser.ads_mine_count', mine.length, data.limits.perPlayer)}</p>
        </div>
        <Btn kind="primary" className={kind === 'market' ? 'mk-pill' : undefined} icon={<Plus size={14} />} disabled={full} title={full ? t('ui.browser.ads_full') : undefined} onClick={() => onOpen(under(site, 'post'))}>
          {word(kind, 'new')}
        </Btn>
      </div>
      {down.error && (
        <div className="mb-3">
          <Note tone="error" onClose={down.clearError}>
            {down.error}
          </Note>
        </div>
      )}
      {mine.length === 0 ? (
        <Nothing title={t('ui.browser.ads_mine_none')}>{word(kind, 'mine_hint')}</Nothing>
      ) : (
        <div className="flex flex-col">
          {mine.map(a => {
            const queued = a.publishAt !== undefined;
            return (
              <div key={a.id} className="s-rule flex items-center gap-3 py-3 border-t">
                <Picture src={a.images[0]} className="shrink-0 w-14 h-14" />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold truncate">{a.title}</div>
                  <div className="s-faint text-[12px]">
                    {queued && a.publishAt !== undefined ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {t('ui.browser.ads_queued', `${new Date(a.publishAt * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${fmtTime(new Date(a.publishAt * 1000), clock24)}`)}
                      </span>
                    ) : (
                      <span className="truncate">{[priceOf(kind, a), a.date].filter(Boolean).join('  ·  ')}</span>
                    )}
                  </div>
                </div>
                {!queued && (
                  <>
                    <Btn small disabled={down.busy} onClick={() => onOpen(under(site, 'item', a.id))}>
                      {t('ui.browser.ads_view')}
                    </Btn>
                    <Btn small icon={<Pencil size={12} />} disabled={down.busy} onClick={() => onOpen(under(site, 'edit', a.id))}>
                      {t('ui.browser.live_edit')}
                    </Btn>
                  </>
                )}
                <Btn small kind="ghost" icon={<Trash2 size={13} />} disabled={down.busy} onClick={() => down.ask(a)}>
                  {t('ui.browser.ads_take_down')}
                </Btn>
              </div>
            );
          })}
        </div>
      )}
      {down.question}
    </div>
  );
}

/** What the owner of an ad can do with it, under the ad. */
function Own({ kind, a, board, props }: { kind: BoardKind; a: Ad; board: Live<BoardData>; props: LiveProps }) {
  const { site, onOpen } = props;
  const down = useTakeDown(kind, board, () => onOpen(under(site, 'mine')));
  return (
    <div className="s-rule mt-5 pt-4 border-t">
      {down.error && (
        <div className="mb-3">
          <Note tone="error" onClose={down.clearError}>
            {down.error}
          </Note>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Tag>{t('ui.browser.ads_yours')}</Tag>
        <span className="flex-1" />
        <Btn small icon={<Pencil size={13} />} disabled={down.busy} onClick={() => onOpen(under(site, 'edit', a.id))}>
          {t('ui.browser.live_edit')}
        </Btn>
        <Btn small icon={<Trash2 size={13} />} disabled={down.busy} onClick={() => down.ask(a)}>
          {t('ui.browser.ads_take_down')}
        </Btn>
      </div>
      {down.question}
    </div>
  );
}

// ── Marketplace ────────────────────────────────────────────────────────────────────────────

function MarketItem({ a, board, props }: { a: Ad; board: Live<BoardData>; props: LiveProps }) {
  const { site, onOpen } = props;
  const [at, setAt] = useState(0);
  return (
    <div className="mx-auto w-full max-w-[940px]">
      <A to={site.address} onOpen={onOpen} className="s-link mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold">
        <ArrowLeft size={14} />
        {t('ui.browser.market_all')}
      </A>
      <div className="mk-panel flex overflow-hidden">
        <div className="flex-1 min-w-0 bg-black flex flex-col">
          <Picture src={a.images[at] ?? a.images[0]} className="w-full h-[380px] !object-contain" />
          {a.images.length > 1 && (
            <div className="p-2 flex justify-center gap-2 bg-[#111]">
              {a.images.map((src, i) => (
                <button key={src} type="button" onClick={() => setAt(i)} className="w-14 h-14 overflow-hidden cursor-pointer" style={{ borderRadius: 6, outline: i === at ? '2px solid #fff' : 'none', opacity: i === at ? 1 : 0.6 }}>
                  <Picture src={src} className="w-full h-full" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 w-[340px] p-5">
          <h1 className="text-[22px] font-bold leading-tight select-text">{a.title}</h1>
          <div className="mt-1 text-[20px] font-semibold">{priceOf('market', a)}</div>
          <div className="s-faint mt-1 text-[12px]">{t('ui.browser.market_listed', a.date)}</div>

          <div className="s-rule mt-4 pt-4 border-t">
            <div className="mb-1.5 text-[15px] font-bold">{t('ui.browser.market_details')}</div>
            <p className="text-[14px] whitespace-pre-line select-text">{a.body}</p>
          </div>
          <div className="s-rule mt-4 pt-4 border-t">
            <div className="mb-2 text-[15px] font-bold">{t('ui.browser.market_seller')}</div>
            <Contact number={a.number} email={a.email} subject={a.title} />
          </div>
          {a.mine && <Own kind="market" a={a} board={board} props={props} />}
        </div>
      </div>
    </div>
  );
}

function MarketList({ data, query, props }: { data: BoardData; query: string; props: LiveProps }) {
  const { site, onOpen } = props;
  const [show, setShow] = useState<Show>('all');
  const [sort, setSort] = useState<Sort>('new');

  const up = data.items.filter(a => a.publishAt === undefined);
  const q = query.trim().toLowerCase();
  let found = up.filter(a => (!q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q)) && (show === 'all' || (show === 'wanted' ? a.price === undefined : show === 'free' ? a.price === 0 : (a.price ?? 0) > 0)));
  if (sort !== 'new') {
    found = [...found].sort((a, b) => {
      // (an ad with no price is somebody looking, not selling: last, whichever way the prices run)
      if (a.price === undefined || b.price === undefined) return Number(a.price === undefined) - Number(b.price === undefined);
      return sort === 'low' ? a.price - b.price : b.price - a.price;
    });
  }

  const shows: { id: Show; icon: ReactNode }[] = [
    { id: 'all', icon: <LayoutGrid size={17} /> },
    { id: 'sale', icon: <TagIcon size={17} /> },
    { id: 'wanted', icon: <Search size={17} /> },
    { id: 'free', icon: <Gift size={17} /> },
  ];

  return (
    <div className="flex gap-5">
      <aside className="mk-side shrink-0 w-[210px]">
        <div className="px-2 mb-2 text-[20px] font-bold">{t('ui.browser.market_browse')}</div>
        {shows.map(s => (
          <button key={s.id} type="button" className={cx(show === s.id && 'is-on')} onClick={() => setShow(s.id)}>
            {s.icon}
            {t(`ui.browser.market_show_${s.id}`)}
          </button>
        ))}
        <div className="s-rule my-3 border-t" />
        <div className="s-muted px-2 mb-1 text-[12px] font-semibold flex items-center gap-1.5">
          <ArrowDownWideNarrow size={13} />
          {t('ui.browser.market_sort')}
        </div>
        {(['new', 'low', 'high'] as const).map(s => (
          <button key={s} type="button" className={cx(sort === s && 'is-on')} onClick={() => setSort(s)}>
            {t(`ui.browser.market_sort_${s}`)}
          </button>
        ))}
        <div className="s-rule my-3 border-t" />
        <button type="button" onClick={() => onOpen(under(site, 'mine'))}>
          <UserRound size={17} />
          {t('ui.browser.market_mine')}
        </button>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="mb-3 flex items-baseline gap-3">
          <h1 className="text-[18px] font-bold">{q ? t('ui.browser.market_results', query.trim()) : t('ui.browser.market_picks')}</h1>
          <span className="s-faint text-[12px]">{t('ui.browser.market_count', found.length)}</span>
        </div>
        {found.length === 0 ? (
          <div className="mk-panel">
            <Nothing title={q ? t('ui.browser.ads_no_match', query.trim()) : t('ui.browser.market_empty')}>{q ? undefined : t('ui.browser.market_empty_hint')}</Nothing>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
            {found.map(a => (
              <A key={a.id} to={under(site, 'item', a.id)} onOpen={onOpen} className="mk-card">
                <Picture src={a.images[0]} className="w-full aspect-square" />
                <span className="p-3 flex flex-col min-w-0">
                  <span className="text-[16px] font-bold">{priceOf('market', a)}</span>
                  <span className="text-[14px] truncate">{a.title}</span>
                  <span className="s-faint mt-0.5 text-[12px] truncate">{a.date}</span>
                </span>
              </A>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Yellow Pages ───────────────────────────────────────────────────────────────────────────

function PagesItem({ a, board, props }: { a: Ad; board: Live<BoardData>; props: LiveProps }) {
  const { site, onOpen } = props;
  return (
    <div className="mx-auto w-full max-w-[860px]">
      <A to={site.address} onOpen={onOpen} className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-bold underline">
        <ArrowLeft size={14} />
        {t('ui.browser.pages_all')}
      </A>
      <div className="flex gap-8">
        <div className="flex-1 min-w-0">
          <h1 className="yp-name !text-[30px] select-text">{a.title}</h1>
          <div className="mt-2 h-1.5 w-20 bg-[#ffd400]" />
          <div className="s-faint mt-3 text-[12px]">{t('ui.browser.pages_listed', a.date)}</div>
          <p className="mt-4 text-[16px] leading-7 whitespace-pre-line select-text">{a.body}</p>
          {a.images.length > 0 && (
            <div className="mt-5 flex gap-3">
              {a.images.map(src => (
                <Picture key={src} src={src} className="h-40 flex-1 min-w-0 max-w-[260px] border-2 border-[#141414]" />
              ))}
            </div>
          )}
          {a.mine && <Own kind="pages" a={a} board={board} props={props} />}
        </div>
        <aside className="shrink-0 w-[270px] self-start p-5 bg-[#ffd400] border-2 border-[#141414]">
          <div className="mb-3 text-[11px] font-extrabold tracking-[0.14em] uppercase">{t('ui.browser.pages_touch')}</div>
          <Contact number={a.number} email={a.email} subject={a.title} />
        </aside>
      </div>
    </div>
  );
}

function PagesList({ data, query, props }: { data: BoardData; query: string; props: LiveProps }) {
  const { site, onOpen } = props;
  const up = data.items.filter(a => a.publishAt === undefined);
  const q = query.trim().toLowerCase();
  const found = q ? up.filter(a => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q)) : up;

  return (
    <div className="mx-auto w-full max-w-[900px]">
      <div className="yp-count">{q ? t('ui.browser.pages_results', found.length, query.trim()) : t('ui.browser.pages_count', found.length)}</div>
      {found.length === 0 ? (
        <Nothing title={q ? t('ui.browser.ads_no_match', query.trim()) : t('ui.browser.pages_empty')}>{q ? undefined : t('ui.browser.pages_empty_hint')}</Nothing>
      ) : (
        found.map(a => (
          <A key={a.id} to={under(site, 'item', a.id)} onOpen={onOpen} className="yp-row">
            {a.images[0] && <Picture src={a.images[0]} className="shrink-0 w-24 h-24" />}
            <span className="flex-1 min-w-0 flex flex-col gap-1">
              <span className="yp-name">{a.title}</span>
              <span className="s-muted text-[14px] line-clamp-2 whitespace-pre-line">{a.body}</span>
              <span className="s-faint text-[12px]">{a.date}</span>
            </span>
            {(a.number || a.email) && (
              <span className="yp-call self-start">
                <small>{t(a.number ? 'ui.browser.pages_call' : 'ui.browser.pages_write')}</small>
                <b className={a.number ? 'tabular-nums' : '!text-[13px] truncate'}>{a.number ? fmtNumber(a.number) : a.email}</b>
              </span>
            )}
          </A>
        ))
      )}
    </div>
  );
}

// ── The two sites ──────────────────────────────────────────────────────────────────────────

export default function Board(props: LiveProps & { kind: BoardKind }) {
  const { kind, site, path, shown, onOpen } = props;
  const board = useLive('web:ads', { board: kind }, asBoard, shown);
  const [query, setQueryState] = useState(typed[kind]);
  const d = board.data;
  const onList = path.length === 0;

  const setQuery = (v: string) => {
    typed[kind] = v;
    setQueryState(v);
  };
  /** Enter in the search, from a page that is not the list: go to the list, where what was typed is waiting. */
  const toList = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !onList) onOpen(site.address);
  };

  const content = (): ReactNode => {
    if (!d) return board.error ? <Failed error={board.error} onRetry={() => void board.reload()} /> : <Waiting />;
    if (path[0] === 'post') return <AdForm kind={kind} board={board} props={props} />;
    if (path[0] === 'mine') return <Mine kind={kind} data={d} board={board} props={props} />;
    if (path[0] === 'item' || path[0] === 'edit') {
      const a = d.items.find(x => x.id === part(path, 1));
      const gone = <Nothing title={t('ui.browser.ads_gone')}>{t('ui.browser.ads_gone_hint')}</Nothing>;
      if (!a) return gone;
      if (path[0] === 'edit') {
        // (only what is the player's own and already up can be changed from a desk)
        if (!a.mine || a.publishAt !== undefined) return gone;
        return <AdForm key={a.id} kind={kind} editing={a} board={board} props={props} />;
      }
      return kind === 'market' ? <MarketItem key={a.id} a={a} board={board} props={props} /> : <PagesItem key={a.id} a={a} board={board} props={props} />;
    }
    return kind === 'market' ? <MarketList data={d} query={query} props={props} /> : <PagesList data={d} query={query} props={props} />;
  };

  if (kind === 'market') {
    return (
      <Site brand="market">
        <div className="mk-bar">
          <div className="mx-auto max-w-[1140px] h-14 px-5 flex items-center gap-4">
            <A to={site.address} onOpen={onOpen} className="shrink-0 flex items-center gap-2.5" title={site.title}>
              <span className="mk-logo flex items-center justify-center">
                <ShoppingBag size={19} />
              </span>
              <span className="text-[20px] font-bold tracking-tight">{site.title}</span>
            </A>
            <div className="mk-search relative flex-1 max-w-[440px]">
              <Search size={16} className="s-faint absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input value={query} maxLength={60} placeholder={t('ui.browser.market_search')} aria-label={t('ui.browser.market_search')} onChange={e => setQuery(e.target.value)} onKeyDown={toList} />
            </div>
            <span className="flex-1" />
            <Btn kind="ghost" className="mk-pill" onClick={() => onOpen(under(site, 'mine'))}>
              {t('ui.browser.market_mine')}
            </Btn>
            <Btn kind="primary" className="mk-pill" icon={<Plus size={15} />} onClick={() => onOpen(under(site, 'post'))}>
              {t('ui.browser.market_new')}
            </Btn>
          </div>
        </div>
        <div className="flex-1 mx-auto w-full max-w-[1140px] px-5 py-5 page-in">{content()}</div>
      </Site>
    );
  }

  return (
    <Site brand="pages">
      <header className="yp-head">
        <div className="mx-auto max-w-[940px] px-6 pt-5 pb-5">
          <div className="flex items-center gap-4">
            <A to={site.address} onOpen={onOpen} className="yp-logo" title={site.title}>
              <span>YP</span>
              <span>{site.title}</span>
            </A>
            <span className="text-[12px] font-bold italic">{t('ui.browser.pages_tagline')}</span>
            <span className="flex-1" />
            <A to={under(site, 'mine')} onOpen={onOpen} className="text-[13px] font-bold underline">
              {t('ui.browser.pages_mine')}
            </A>
            <Btn kind="primary" icon={<Plus size={15} />} onClick={() => onOpen(under(site, 'post'))}>
              {t('ui.browser.pages_new')}
            </Btn>
          </div>
          <div className="yp-find mt-4 flex">
            <Input value={query} maxLength={60} placeholder={t('ui.browser.pages_search')} aria-label={t('ui.browser.pages_search')} onChange={e => setQuery(e.target.value)} onKeyDown={toList} />
            <Btn kind="primary" icon={<Search size={15} />} onClick={() => !onList && onOpen(site.address)}>
              {t('ui.browser.pages_find')}
            </Btn>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full px-6 py-6 page-in">{content()}</main>
      <footer className="yp-foot">
        <div className="mx-auto max-w-[940px] px-6 py-3">{t('ui.browser.pages_foot')}</div>
      </footer>
    </Site>
  );
}
