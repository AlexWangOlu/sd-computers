import { useId, type ReactNode } from 'react';
import { ArrowLeft, BadgeCheck, BarChart2, Hash, Heart, House, Lock, MessageCircle, Repeat2, Smartphone } from 'lucide-react';
import { fmtAgo } from '@/lib/format';
import { t } from '@/i18n';
import type { Site as SiteDef } from '../types';
import { cx, part, under } from '../model';
import { asSquawkFeed, asSquawkProfile, type Squawk as Post, type SquawkAuthor } from './data';
import { useLive } from './useLive';
import { A, Failed, Nothing, Picture, Site, Waiting, type LiveProps } from './parts';
import type { OpenFn } from '../parts';

// Squawk (the phone's Birdy), as its own site: black, hairlines and one blue. A menu down the
// left, the timeline in the middle, what is trending on the right. Its public feed, the posts
// under a hashtag and anybody's page - to read, and as a visitor: whoever is at the desk, nothing
// here is their own feed and nothing comes from an account that keeps its posts to its followers.
// Posting, liking and following stay on the phone, where the account is.

const TINT = '#1d9bf0';
const BADGE: Record<string, string> = { blue: '#1d9bf0', gold: '#e2b719', grey: '#8b98a5' };

/**
 * Squawk's own mark: the app icon it has on the phone - the white two-feather bird on its
 * periwinkle tile. The same artwork as sd-phone's (web/src/shell/AppIconSVG.tsx > BirdyIcon), so
 * the site and the app are plainly the one thing. Change it there, change it here.
 */
function SquawkIcon({ size = 44 }: { size?: number }) {
  const id = useId();
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} style={{ borderRadius: Math.round(size * 0.24), display: 'block' }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#6b8ff5" />
          <stop offset="0.55" stopColor="#5570e8" />
          <stop offset="1" stopColor="#4353d4" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill={`url(#${id})`} />
      {/* (centred on the artwork's own box: x 8-95, y 19-96 of its 100-wide frame) */}
      <g transform="translate(37,11.5) scale(4.25)">
        <path
          fill="#fff"
          d="M95 25 C89 29 83 33 78 35 C82 43 84 52 80 58 C74 78 60 95 37 95 C28 96 18 94 8 90 C18 84 26 80 32 76 C23 75 16 69 14 60 C19 62 24 62 28 61 C17 55 10 42 13 28 C20 38 30 43 41 44 C42 36 46 29 52 25 C57 20 65 19 70 22 C75 24 79 25 82 26 C86 26 90 25 95 25 Z"
        />
        <circle cx="67" cy="30" r="4" fill="#5570e8" />
      </g>
    </svg>
  );
}

const count = (n: number): string => (n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

/** Somebody's picture, or - they have none - their first letter on the site's blue. */
function Avatar({ a, size = 40 }: { a: SquawkAuthor; size?: number }) {
  return (
    <span className="shrink-0 block rounded-full overflow-hidden" style={{ width: size, height: size }} aria-hidden>
      {a.avatar ? (
        <Picture src={a.avatar} className="w-full h-full" />
      ) : (
        <span className="w-full h-full flex items-center justify-center font-bold text-white select-none" style={{ background: TINT, fontSize: Math.round(size * 0.42) }}>
          {(a.name || a.handle || '?').slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function Verified({ a }: { a: SquawkAuthor }) {
  if (!a.verified) return null;
  return <BadgeCheck size={16} className="shrink-0" style={{ color: BADGE[a.badge ?? 'blue'] ?? BADGE.blue }} aria-label={t('ui.browser.sq_verified')} />;
}

/** A post's words, with its #hashtags and @names made into links to their pages. */
function Body({ text, site, onOpen }: { text: string; site: SiteDef; onOpen: OpenFn }) {
  const out: ReactNode[] = [];
  const re = /([#@])([A-Za-z0-9_]{1,64})/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const to = m[1] === '#' ? under(site, 'tag', m[2]) : under(site, 'user', m[2]);
    out.push(
      <A key={m.index} to={to} onOpen={onOpen} className="s-link">
        {m[0]}
      </A>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <p className="mt-0.5 text-[15px] leading-[1.4] whitespace-pre-line break-words select-text">{out}</p>;
}

function PostRow({ p, site, onOpen }: { p: Post; site: SiteDef; onOpen: OpenFn }) {
  const profile = under(site, 'user', p.author.handle);
  return (
    <article>
      {p.repostedBy && (
        <div className="s-faint pt-2.5 pl-[52px] flex items-center gap-2 text-[13px] font-semibold">
          <Repeat2 size={14} />
          {t('ui.browser.sq_reposted', p.repostedBy.name)}
        </div>
      )}
      <div className={cx('sq-post', p.repostedBy && '!pt-1.5')}>
        <A to={profile} onOpen={onOpen} className="shrink-0 self-start">
          <Avatar a={p.author} />
        </A>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0 text-[15px]">
            <A to={profile} onOpen={onOpen} className="min-w-0 flex items-center gap-1 hover:underline">
              <span className="font-bold truncate">{p.author.name}</span>
              <Verified a={p.author} />
            </A>
            <span className="s-faint truncate">{`@${p.author.handle}`}</span>
            {p.at > 0 && <span className="s-faint shrink-0">{`· ${fmtAgo(Math.floor(p.at / 1000))}`}</span>}
          </div>
          {p.body && <Body text={p.body} site={site} onOpen={onOpen} />}

          {p.images.length > 0 && (
            <div className={cx('mt-3 grid gap-0.5 overflow-hidden', p.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2')} style={{ borderRadius: 16, border: '1px solid var(--s-line)' }}>
              {p.images.map(src => (
                <Picture key={src} src={src} className={cx('w-full', p.images.length === 1 ? 'max-h-[340px]' : 'h-40')} />
              ))}
            </div>
          )}

          {p.poll && (
            <div className="mt-3 flex flex-col gap-1.5">
              {p.poll.options.map((o, i) => {
                const share = p.poll && p.poll.total > 0 ? Math.round((o.votes / p.poll.total) * 100) : 0;
                return (
                  <div key={i} className="relative h-8 overflow-hidden" style={{ borderRadius: 6 }}>
                    <div className="absolute inset-y-0 left-0" style={{ width: `${Math.max(share, 2)}%`, background: 'rgba(29,155,240,0.35)', borderRadius: 6 }} />
                    <div className="relative h-full px-3 flex items-center justify-between text-[14px]">
                      <span className="truncate">{o.label}</span>
                      <span className="font-semibold tabular-nums">{`${share}%`}</span>
                    </div>
                  </div>
                );
              })}
              <div className="s-faint text-[13px]">{t(p.poll.ended ? 'ui.browser.sq_poll_ended' : 'ui.browser.sq_poll_votes', p.poll.total)}</div>
            </div>
          )}

          <div className="s-faint mt-2.5 flex items-center justify-between max-w-[380px] text-[13px] tabular-nums">
            <span className="inline-flex items-center gap-1.5" title={t('ui.browser.sq_replies')}>
              <MessageCircle size={15} />
              {count(p.replies)}
            </span>
            <span className="inline-flex items-center gap-1.5" title={t('ui.browser.sq_reposts')}>
              <Repeat2 size={15} />
              {count(p.reposts)}
            </span>
            <span className="inline-flex items-center gap-1.5" title={t('ui.browser.sq_likes')}>
              <Heart size={15} />
              {count(p.likes)}
            </span>
            <span className="inline-flex items-center gap-1.5" title={t('ui.browser.sq_views')}>
              <BarChart2 size={15} />
              {count(p.views)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function Posts({ posts, site, onOpen, empty }: { posts: Post[]; site: SiteDef; onOpen: OpenFn; empty: string }) {
  if (posts.length === 0) return <Nothing title={empty} />;
  return (
    <>
      {/* (a post can be in a feed twice - once as written, once as somebody passed it on - so it is its place that names it) */}
      {posts.map((p, i) => (
        <PostRow key={`${p.id}:${i}`} p={p} site={site} onOpen={onOpen} />
      ))}
    </>
  );
}

/** The bar over the middle column: where this is, and the way back from anywhere that is not the feed. */
function Top({ title, sub, back, site, onOpen }: { title: string; sub?: string; back?: boolean; site: SiteDef; onOpen: OpenFn }) {
  return (
    <div className="sq-top h-[53px] px-4 flex items-center gap-5">
      {back && (
        <A to={site.address} onOpen={onOpen} className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center hover:bg-[#181818]" title={t('ui.browser.sq_feed')}>
          <ArrowLeft size={18} />
        </A>
      )}
      <div className="min-w-0">
        <div className="text-[19px] font-bold leading-tight truncate">{title}</div>
        {sub && <div className="s-faint text-[12px] leading-tight">{sub}</div>}
      </div>
    </div>
  );
}

function Profile({ handle, props }: { handle: string; props: LiveProps }) {
  const { site, shown, onOpen } = props;
  const page = useLive('web:squawk', { view: 'profile', handle }, asSquawkProfile, shown);
  if (!page.data) {
    return (
      <>
        <Top title={`@${handle}`} back site={site} onOpen={onOpen} />
        {page.error ? <Nothing title={t('ui.browser.sq_no_account', handle)}>{page.error}</Nothing> : <Waiting />}
      </>
    );
  }
  const { profile: p, posts } = page.data;
  return (
    <>
      <Top title={p.name} sub={t('ui.browser.sq_posts_count', posts.length)} back site={site} onOpen={onOpen} />
      {p.banner ? <Picture src={p.banner} className="w-full h-[150px]" /> : <div className="h-[110px] bg-[#333639]" />}
      <div className="px-4 pb-4" style={{ borderBottom: '1px solid var(--s-line)' }}>
        <div className="-mt-10 w-[88px] h-[88px] rounded-full bg-black flex items-center justify-center">
          <Avatar a={p} size={80} />
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <h1 className="text-[20px] font-extrabold leading-tight">{p.name}</h1>
          <Verified a={p} />
          {p.protected && <Lock size={15} className="s-faint" />}
        </div>
        <div className="s-faint text-[15px]">{`@${p.handle}`}</div>
        {p.bio && <p className="mt-3 text-[15px] whitespace-pre-line select-text">{p.bio}</p>}
        <div className="s-faint mt-3 flex items-center gap-5 text-[14px]">
          <span>
            <b className="text-[#e7e9ea]">{count(p.following)}</b> {t('ui.browser.sq_following')}
          </span>
          <span>
            <b className="text-[#e7e9ea]">{count(p.followers)}</b> {t('ui.browser.sq_followers')}
          </span>
          {p.joined && <span>{t('ui.browser.sq_joined', p.joined)}</span>}
        </div>
      </div>
      {p.protected ? <Nothing title={t('ui.browser.sq_protected')}>{t('ui.browser.sq_protected_hint')}</Nothing> : <Posts posts={posts} site={site} onOpen={onOpen} empty={t('ui.browser.sq_no_posts')} />}
    </>
  );
}

function Tagged({ tag, props }: { tag: string; props: LiveProps }) {
  const { site, shown, onOpen } = props;
  const page = useLive('web:squawk', { view: 'tag', tag }, asSquawkFeed, shown);
  return (
    <>
      <Top title={`#${tag}`} sub={page.data ? t('ui.browser.sq_posts_count', page.data.posts.length) : undefined} back site={site} onOpen={onOpen} />
      {!page.data ? page.error ? <div className="px-4"><Failed error={page.error} onRetry={() => void page.reload()} /></div> : <Waiting /> : <Posts posts={page.data.posts} site={site} onOpen={onOpen} empty={t('ui.browser.sq_no_tagged')} />}
    </>
  );
}

export default function SquawkSite(props: LiveProps) {
  const { site, path, shown, onOpen } = props;
  // (the feed is asked for on every page of the site: its trending list is the right-hand column's)
  const feed = useLive('web:squawk', { view: 'feed' }, asSquawkFeed, shown);
  const where = path[0] === 'user' ? 'user' : path[0] === 'tag' ? 'tag' : 'home';
  const tags = feed.data?.tags ?? [];

  return (
    <Site brand="squawk">
      <div className="flex-1 mx-auto w-full max-w-[1010px] flex">
        <aside className="sq-side shrink-0 w-[190px] px-2 py-2 sticky top-0 self-start">
          <A to={site.address} onOpen={onOpen} className="mx-2 mt-1 mb-2 flex items-center gap-3" title={site.title}>
            <SquawkIcon />
            <span className="text-[21px] font-extrabold tracking-tight">{site.title}</span>
          </A>
          <A to={site.address} onOpen={onOpen} className={cx('sq-nav', where === 'home' && 'is-on')}>
            <House size={24} />
            {t('ui.browser.sq_home')}
          </A>
          {tags[0] && (
            <A to={under(site, 'tag', tags[0].tag.replace(/^#/, ''))} onOpen={onOpen} className={cx('sq-nav', where === 'tag' && 'is-on')}>
              <Hash size={24} />
              {t('ui.browser.sq_explore')}
            </A>
          )}
          <div className="s-faint mt-4 mx-3 flex gap-2 text-[12px] leading-snug">
            <Smartphone size={15} className="shrink-0 mt-0.5" />
            {t('ui.browser.sq_phone_only')}
          </div>
        </aside>

        <main className="flex-1 min-w-0 min-h-full" style={{ borderLeft: '1px solid var(--s-line)', borderRight: '1px solid var(--s-line)' }}>
          {where === 'user' ? (
            <Profile handle={part(path, 1)} props={props} />
          ) : where === 'tag' ? (
            <Tagged tag={part(path, 1)} props={props} />
          ) : (
            <>
              <Top title={t('ui.browser.sq_home')} site={site} onOpen={onOpen} />
              {!feed.data ? feed.error ? <div className="px-4"><Failed error={feed.error} onRetry={() => void feed.reload()} /></div> : <Waiting /> : <Posts posts={feed.data.posts} site={site} onOpen={onOpen} empty={t('ui.browser.sq_empty')} />}
            </>
          )}
        </main>

        <aside className="shrink-0 w-[260px] px-4 py-3 sticky top-0 self-start">
          <div className="sq-box overflow-hidden">
            <div className="px-4 pt-3 pb-2 text-[19px] font-extrabold">{t('ui.browser.sq_happening')}</div>
            {tags.length === 0 ? (
              <div className="s-faint px-4 pb-4 text-[13px]">{t('ui.browser.sq_no_trends')}</div>
            ) : (
              tags.map(x => (
                <A key={x.tag} to={under(site, 'tag', x.tag.replace(/^#/, ''))} onOpen={onOpen} className="sq-trend">
                  <span className="s-faint block text-[12px]">{t('ui.browser.sq_trending')}</span>
                  <span className="block text-[15px] font-bold">{x.tag}</span>
                  <span className="s-faint block text-[12px]">{t('ui.browser.sq_posts_count', x.count)}</span>
                </A>
              ))
            )}
          </div>
          <p className="s-faint mt-3 px-2 text-[11px]">{t('ui.browser.sq_foot')}</p>
        </aside>
      </div>
    </Site>
  );
}
