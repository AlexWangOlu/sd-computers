import { useEffect, type ReactNode } from 'react';
import { Eye, Radio } from 'lucide-react';
import { rpc } from '@/nui/rpc';
import { fmtLongDate, useNow } from '@/lib/format';
import { t } from '@/i18n';
import { cx, part, under } from '../model';
import { asNews, type Article } from './data';
import { useLive } from './useLive';
import { A, Failed, Nothing, Picture, Site, Waiting, type LiveProps } from './parts';
import Newsroom from './Newsroom';

// Weazel News: the phone's paper, as the paper's own site - a black date line, the red masthead,
// the sections along a red bar, the breaking line, and pages set in a serif. Its front page (the
// lead, the latest beside it, the rest below), a page for each story, and - under /newsroom, for
// the players the phone counts as its staff - where they are written (Newsroom.tsx).

function Ticker({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  const run = lines.join('   ●   ');
  return (
    <div className="wz-ticker">
      <span className="wz-ticker-flag">
        <Radio size={13} />
        {t('ui.browser.news_breaking')}
      </span>
      <div className="flex-1 min-w-0 overflow-hidden py-2">
        {/* (the line twice over, slid half its length: where it ends it has already begun again) */}
        <div className="inline-block whitespace-nowrap" style={{ animation: `wzTicker ${Math.max(18, run.length / 5)}s linear infinite` }}>
          <span className="px-5">{run}</span>
          <span className="px-5" aria-hidden>
            {run}
          </span>
        </div>
      </div>
    </div>
  );
}

/** The phone's short age for a story ('38m', '2d', 'now'), as a paper prints it. */
const ago = (time: string): string => (!time ? '' : time === 'now' ? t('ui.browser.news_just_now') : t('ui.browser.news_ago', time));
const byline = (a: Article): string => [a.author && t('ui.browser.news_by', a.author), ago(a.time)].filter(Boolean).join('  ·  ');

function Card({ a, to, onOpen }: { a: Article; to: string; onOpen: LiveProps['onOpen'] }) {
  return (
    <A to={to} onOpen={onOpen} className="flex flex-col gap-2 min-w-0">
      {a.image && <Picture src={a.image} className="w-full h-36" />}
      <span className="wz-kicker">{a.category}</span>
      <span className="wz-headline text-[19px]">{a.headline}</span>
      {a.dek && <span className="s-muted text-[13px] line-clamp-2">{a.dek}</span>}
      <span className="s-faint text-[11px]">{byline(a)}</span>
    </A>
  );
}

function Story({ a, more, props }: { a: Article; more: Article[]; props: LiveProps }) {
  const { site, onOpen } = props;
  // (told once for each time the story is opened: the phone itself counts one reader once)
  useEffect(() => {
    void rpc('web:news:view', { id: a.id });
  }, [a.id]);

  return (
    <div className="flex gap-10">
      <article className="flex-1 min-w-0 max-w-[660px]">
        <A to={under(site, 'section', a.category)} onOpen={onOpen} className="wz-kicker hover:underline">
          {a.category}
        </A>
        <h1 className="wz-headline mt-2 text-[36px] select-text">{a.headline}</h1>
        {a.dek && <p className="s-muted mt-3 text-[18px] leading-snug select-text">{a.dek}</p>}
        <div className="s-rule mt-4 py-2.5 border-y flex items-center gap-4 text-[12px]">
          <span className="font-semibold">{a.author}</span>
          {a.time && <span className="s-faint">{ago(a.time)}</span>}
          <span className="flex-1" />
          <span className="s-faint inline-flex items-center gap-1.5">
            <Eye size={13} />
            {t('ui.browser.news_reads', a.views)}
          </span>
        </div>
        {a.image && <Picture src={a.image} className="mt-5 w-full max-h-[380px]" />}
        <div className="wz-body mt-5 flex flex-col gap-4 select-text">
          {a.body.map((para, i) => (
            <p key={i} className="whitespace-pre-line">
              {para}
            </p>
          ))}
        </div>
      </article>

      {more.length > 0 && (
        <aside className="shrink-0 w-[250px]">
          <div className="wz-section">{t('ui.browser.news_more')}</div>
          <div className="flex flex-col">
            {more.map(m => (
              <A key={m.id} to={under(site, 'story', m.id)} onOpen={onOpen} className="s-rule py-3 border-b flex flex-col gap-1">
                <span className="wz-kicker">{m.category}</span>
                <span className="wz-headline text-[16px]">{m.headline}</span>
                <span className="s-faint text-[11px]">{ago(m.time)}</span>
              </A>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

export default function News(props: LiveProps) {
  const { site, path, shown, onOpen } = props;
  const news = useLive('web:news', undefined, asNews, shown);
  const today = useNow(60000);
  const d = news.data;

  const inRoom = path[0] === 'newsroom';
  const section = path[0] === 'section' ? part(path, 1) : '';
  // (the sections there are stories in, in the order they first come up)
  const sections = d ? [...new Set(d.articles.map(a => a.category).filter(Boolean))] : [];

  const page = (children: ReactNode) => (
    <Site brand="weazel">
      <div className="wz-top">
        <div className="mx-auto max-w-[1040px] px-6 h-7 flex items-center gap-4">
          <span>{fmtLongDate(today)}</span>
          <span className="opacity-60">Los Santos</span>
          <span className="flex-1" />
          {d?.canManage && (
            <A to={under(site, 'newsroom')} onOpen={onOpen} className="text-white font-bold hover:underline">
              {t('ui.browser.news_newsroom')}
            </A>
          )}
        </div>
      </div>
      <header className="mx-auto w-full max-w-[1040px] px-6 py-4 flex items-end gap-4">
        <A to={site.address} onOpen={onOpen} className="wz-logo" title={site.title}>
          <span>Weazel</span>
          <span>News</span>
        </A>
        <span className="s-faint pb-2 text-[12px] italic">{t('ui.browser.news_tagline')}</span>
      </header>
      <nav className="wz-nav">
        <div className="mx-auto max-w-[1040px] px-6 flex flex-wrap">
          <A to={site.address} onOpen={onOpen} className={cx(path.length === 0 && 'is-on')}>
            {t('ui.browser.news_all')}
          </A>
          {sections.map(c => (
            <A key={c} to={under(site, 'section', c)} onOpen={onOpen} className={cx(section === c.toLowerCase() && 'is-on')}>
              {c}
            </A>
          ))}
          {inRoom && (
            <A to={under(site, 'newsroom')} onOpen={onOpen} className="is-on ml-auto">
              {t('ui.browser.news_newsroom')}
            </A>
          )}
        </div>
      </nav>
      {d && !inRoom && <Ticker lines={d.ticker} />}
      <main className="flex-1 mx-auto w-full max-w-[1040px] px-6 py-7 page-in">{children}</main>
      <footer className="wz-foot">
        <div className="mx-auto max-w-[1040px] px-6 py-4 flex items-center gap-4">
          <span className="font-bold text-white">WEAZEL NEWS NETWORK</span>
          <span>{t('ui.browser.news_foot')}</span>
        </div>
      </footer>
    </Site>
  );

  if (!d) return page(news.error ? <Failed error={news.error} onRetry={() => void news.reload()} /> : <Waiting />);
  if (inRoom) return page(<Newsroom {...props} news={d} onChanged={() => void news.reload()} />);

  if (path[0] === 'story') {
    const a = d.articles.find(x => x.id === part(path, 1));
    if (!a) return page(<Nothing title={t('ui.browser.news_gone')}>{t('ui.browser.news_gone_hint')}</Nothing>);
    return page(<Story key={a.id} a={a} more={d.articles.filter(x => x.id !== a.id).slice(0, 5)} props={props} />);
  }

  const stories = section ? d.articles.filter(a => a.category.toLowerCase() === section) : d.articles;
  if (stories.length === 0) return page(<Nothing title={t('ui.browser.news_empty')}>{t('ui.browser.news_empty_hint')}</Nothing>);

  // The lead: the one the newsroom featured, else simply the newest.
  const lead = stories.find(a => a.featured) ?? stories[0];
  const latest = stories.filter(a => a !== lead).slice(0, 4);
  const rest = stories.filter(a => a !== lead && !latest.includes(a));

  return page(
    <>
      {section && <div className="wz-section">{stories[0].category}</div>}
      <div className="flex gap-8">
        <A to={under(site, 'story', lead.id)} onOpen={onOpen} className="flex-1 min-w-0 flex flex-col gap-3">
          {lead.image && <Picture src={lead.image} className="w-full h-[300px]" />}
          <span className="wz-kicker">{lead.category}</span>
          <span className="wz-headline text-[34px]">{lead.headline}</span>
          {lead.dek && <span className="s-muted text-[16px] leading-snug">{lead.dek}</span>}
          <span className="s-faint text-[12px]">{byline(lead)}</span>
        </A>
        {latest.length > 0 && (
          <aside className="shrink-0 w-[300px]">
            <div className="wz-section">{t('ui.browser.news_latest')}</div>
            <div className="flex flex-col">
              {latest.map(a => (
                <A key={a.id} to={under(site, 'story', a.id)} onOpen={onOpen} className="s-rule py-3 border-b flex gap-3">
                  <span className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="wz-kicker">{a.category}</span>
                    <span className="wz-headline text-[16px]">{a.headline}</span>
                    <span className="s-faint text-[11px]">{ago(a.time)}</span>
                  </span>
                  {a.image && <Picture src={a.image} className="shrink-0 w-[84px] h-[64px]" />}
                </A>
              ))}
            </div>
          </aside>
        )}
      </div>

      {rest.length > 0 && (
        <section className="mt-9">
          <div className="wz-section">{t('ui.browser.news_more')}</div>
          <div className="grid gap-x-7 gap-y-8 grid-cols-3">
            {rest.map(a => (
              <Card key={a.id} a={a} to={under(site, 'story', a.id)} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}
    </>,
  );
}
