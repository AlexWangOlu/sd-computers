import { useEffect, useState } from 'react';
import { Megaphone, Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react';
import { Button, Dialog, Empty, Spinner } from '@/ui/controls';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { fmtAgo, fmtStamp } from '@/lib/format';
import type { RpcResult } from '@/types';
import Composer from './Composer';
import { useNotices } from './hooks';
import { Initials, Notices, PageHeader, RefreshButton, cx } from './parts';
import type { BoardState, Draft, Post } from './types';
import { isLong, normPosts } from './util';

interface Props {
  state: BoardState;
  loading: boolean;
  clock24: boolean;
  reload: () => Promise<boolean>;
  setPosts: (posts: Post[]) => void;
}

/** Every write replies with the board's announcements as they now stand. */
type Written = { posts?: unknown };

const BLANK: Draft = { title: '', body: '', pinned: false };

/**
 * The board itself: pinned announcements first, then newest first. A boss also gets the composer
 * and Pin / Edit / Delete on every card. The server checks each of those again, so a refusal (they
 * stopped being a boss, someone else deleted the post) is shown and the board refetched.
 */
export default function Announcements({ state, loading, clock24, reload, setPosts }: Props) {
  const { job, canPost, posts, limits } = state;
  const notices = useNotices();
  const [composing, setComposing] = useState(false);
  const [cameBack, setCameBack] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK); // a new announcement: kept when the composer is cancelled
  const [editDraft, setEditDraft] = useState<Draft>(BLANK);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [confirm, setConfirm] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Someone who stops being a boss with the composer open is back at the board.
  useEffect(() => {
    if (canPost) return;
    setComposing(false);
    setEditing(null);
    setConfirm(null);
  }, [canPost]);

  const markBusy = (id: number, on: boolean) =>
    setBusy(b => {
      const next = { ...b };
      if (on) next[id] = true;
      else delete next[id];
      return next;
    });

  /** Take a write's reply: show its announcements at once (or why it was refused), then refetch. */
  const settle = (res: RpcResult<Written>, failed: string): boolean => {
    if (res.ok && res.data && 'posts' in res.data) setPosts(normPosts(res.data.posts));
    if (!res.ok) notices.push('error', res.error || t('ui.common.error'), failed);
    void reload();
    return res.ok;
  };

  const compose = () => {
    setEditing(null);
    setComposing(true);
  };

  const edit = (p: Post) => {
    setEditDraft({ title: p.title, body: p.body, pinned: p.pinned });
    setEditing(p);
    setComposing(true);
  };

  const closeComposer = () => {
    setComposing(false);
    setEditing(null);
    setCameBack(true);
  };

  const submit = async () => {
    const d = editing ? editDraft : draft;
    const title = d.title.trim();
    if (!title || saving) return;
    setSaving(true);
    const res = editing
      ? await rpc<Written>('board:edit', { job: job.name, id: editing.id, title, body: d.body })
      : await rpc<Written>('board:post', { job: job.name, title, body: d.body, pinned: d.pinned });
    setSaving(false);
    if (!settle(res, t(editing ? 'ui.board.edit_failed' : 'ui.board.post_failed'))) return;
    notices.push('success', t(editing ? 'ui.board.updated' : 'ui.board.posted'));
    if (!editing) setDraft(BLANK);
    closeComposer();
  };

  const togglePin = async (p: Post) => {
    markBusy(p.id, true);
    const res = await rpc<Written>('board:pin', { job: job.name, id: p.id, pinned: !p.pinned });
    markBusy(p.id, false);
    settle(res, t('ui.board.pin_failed'));
  };

  const remove = async () => {
    if (!confirm) return;
    const p = confirm;
    setDeleting(true);
    const res = await rpc<Written>('board:delete', { job: job.name, id: p.id });
    setDeleting(false);
    setConfirm(null);
    if (settle(res, t('ui.board.delete_failed'))) notices.push('success', t('ui.board.deleted'));
  };

  if (composing && canPost) {
    return (
      <Composer
        key={editing ? `edit:${editing.id}` : 'new'}
        jobLabel={job.label}
        limits={limits}
        editing={!!editing}
        atCap={posts.length >= limits.maxPosts}
        value={editing ? editDraft : draft}
        onChange={editing ? setEditDraft : setDraft}
        saving={saving}
        onSubmit={() => void submit()}
        onCancel={closeComposer}
        notices={<Notices list={notices.list} onClose={notices.dismiss} className="" />}
      />
    );
  }

  return (
    <>
      <div className="h-full overflow-y-auto os-scroll">
        {/* Eases in when the composer hands the page back (the first time, the page itself does).
            The class goes once it has played: left on, it would play again, on top of the page's
            own, every time the page is switched back to. */}
        <div className={cx('px-6 pt-5 pb-8 max-w-[880px]', cameBack && 'page-in')} onAnimationEnd={e => e.target === e.currentTarget && setCameBack(false)}>
          <PageHeader
            title={t('ui.board.nav_posts')}
            subtitle={posts.length === 0 ? job.label : t(posts.length === 1 ? 'ui.board.count_one' : 'ui.board.count_many', posts.length, job.label)}
            actions={
              <>
                <RefreshButton loading={loading} onClick={() => void reload()} />
                {canPost && (
                  <Button variant="accent" icon={<Plus size={16} />} onClick={compose}>
                    {t('ui.board.new_post')}
                  </Button>
                )}
              </>
            }
          />
          <Notices list={notices.list} onClose={notices.dismiss} />

          {posts.length === 0 ? (
            <div className="h-[300px]">
              <Empty icon={<Megaphone size={40} />} title={t('ui.board.empty_title')}>
                {t(canPost ? 'ui.board.empty_body_boss' : 'ui.board.empty_body', job.label)}
              </Empty>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {posts.map(p => (
                <PostCard
                  key={p.id}
                  post={p}
                  canPost={canPost}
                  clock24={clock24}
                  busy={!!busy[p.id]}
                  onPin={() => void togglePin(p)}
                  onEdit={() => edit(p)}
                  onDelete={() => setConfirm(p)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {confirm && (
        <Dialog
          title={t('ui.board.delete_title')}
          onClose={() => !deleting && setConfirm(null)}
          actions={
            <>
              <Button onClick={() => setConfirm(null)} disabled={deleting}>
                {t('ui.common.cancel')}
              </Button>
              <Button variant="danger" onClick={() => void remove()} disabled={deleting} icon={deleting ? <Spinner size={14} className="!text-white" /> : <Trash2 size={16} />}>
                {t('ui.common.delete')}
              </Button>
            </>
          }
        >
          <div className="break-words">{t('ui.board.delete_body', confirm.title, job.label)}</div>
        </Dialog>
      )}
    </>
  );
}

interface CardProps {
  post: Post;
  canPost: boolean;
  clock24: boolean;
  busy: boolean;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** One announcement: pin mark, headline, text (line breaks kept), who posted it and when. */
function PostCard({ post, canPost, clock24, busy, onPin, onEdit, onDelete }: CardProps) {
  const long = isLong(post.body);
  const [open, setOpen] = useState(false);

  return (
    <article className="ctl-card rounded-win bg-card border border-stroke shadow-card px-5 py-4 min-w-0">
      {post.pinned && (
        <div className="flex items-center gap-1.5 mb-1.5 text-caption font-semibold text-accent-text">
          <Pin size={12} className="shrink-0" />
          {t('ui.board.pinned')}
        </div>
      )}
      <h2 className="text-body font-semibold text-t1 break-words">{post.title}</h2>
      {post.body && <p className={cx('mt-1.5 text-body text-t2 whitespace-pre-wrap break-words', long && !open && 'line-clamp-6')}>{post.body}</p>}
      {long && (
        <button type="button" className="mt-1 text-caption text-accent-text hover:underline" onClick={() => setOpen(o => !o)}>
          {t(open ? 'ui.board.show_less' : 'ui.board.show_more')}
        </button>
      )}

      <div className="mt-3 flex items-center justify-between gap-x-4 gap-y-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 text-caption text-t3">
          <Initials name={post.author} size={22} />
          <span className="text-t2 truncate">{post.author}</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap" title={fmtStamp(post.ts, clock24)}>
            {fmtAgo(post.ts)}
          </span>
          {post.edited !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap" title={fmtStamp(post.edited, clock24)}>
                {t('ui.board.edited')}
              </span>
            </>
          )}
        </div>
        {canPost && (
          <div className="flex items-center gap-1 -mr-2">
            {busy && <Spinner size={16} />}
            <Button variant="subtle" compact icon={post.pinned ? <PinOff size={14} /> : <Pin size={14} />} disabled={busy} onClick={onPin}>
              {t(post.pinned ? 'ui.board.unpin' : 'ui.board.pin')}
            </Button>
            <Button variant="subtle" compact icon={<Pencil size={14} />} disabled={busy} onClick={onEdit}>
              {t('ui.board.edit')}
            </Button>
            <Button variant="subtle" compact icon={<Trash2 size={14} />} className="!text-critical" disabled={busy} onClick={onDelete}>
              {t('ui.common.delete')}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
