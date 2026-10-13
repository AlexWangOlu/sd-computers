import type { BoardState, Limits, Member, Post } from './types';

/**
 * Lua -> JSON turns an EMPTY table into `{}` rather than `[]` (a board nobody has posted on), so
 * every list from the server goes through this before it's mapped.
 */
export const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** The announcements of board:state, and of every write's reply. */
export const normPosts = (raw: unknown): Post[] =>
  asArray<Partial<Post>>(raw).map(p => ({
    id: num(p.id),
    title: str(p.title),
    body: str(p.body),
    author: str(p.author),
    pinned: !!p.pinned,
    ts: num(p.ts),
    edited: p.edited == null ? null : num(p.edited),
  }));

export function normState(raw: unknown): BoardState {
  const o = (raw ?? {}) as { job?: { name?: string; label?: string }; canPost?: unknown; posts?: unknown; roster?: unknown; limits?: Partial<Limits> };
  return {
    job: { name: o.job?.name ?? '', label: o.job?.label || o.job?.name || '' },
    canPost: o.canPost === true,
    posts: normPosts(o.posts),
    // (absent = no roster at all; an empty table is a roster with nobody on it)
    roster:
      o.roster == null
        ? null
        : asArray<Partial<Member>>(o.roster).map(m => ({
            name: str(m.name),
            grade: num(m.grade),
            gradeName: str(m.gradeName) || String(num(m.grade)),
            online: !!m.online,
            onDuty: !!m.onDuty,
            me: m.me === true,
          })),
    limits: {
      maxTitle: num(o.limits?.maxTitle, 80) || 80,
      maxBody: num(o.limits?.maxBody, 2000),
      maxPosts: num(o.limits?.maxPosts, 50) || 50,
    },
  };
}

/** "Jessica Hale" -> "JH", "Madonna" -> "MA". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** An announcement long enough to start folded, behind "Show more". */
export const isLong = (body: string): boolean => body.length > 480 || body.split('\n').length > 6;

export interface DutyGroups {
  onDuty: Member[];
  online: Member[];
  offline: Member[];
}

/** The roster as the On duty page lists it. Each group keeps the server's order (highest rank first). */
export const groupRoster = (roster: Member[]): DutyGroups => ({
  onDuty: roster.filter(m => m.onDuty),
  online: roster.filter(m => m.online && !m.onDuty),
  offline: roster.filter(m => !m.online && !m.onDuty),
});
