// Shapes returned by server/computers/board.lua.

export type Page = 'posts' | 'duty';

/** One announcement (ts / edited = unix seconds). */
export interface Post {
  id: number;
  title: string;
  body: string;
  author: string;
  pinned: boolean;
  ts: number;
  /** When a boss last reworded it; null = as it was posted. */
  edited: number | null;
}

/** One person on the job's roster. No id: a colleague's name and rank is all the board is given. */
export interface Member {
  name: string;
  grade: number;
  gradeName: string;
  online: boolean;
  onDuty: boolean;
  /** The signed-in player. */
  me: boolean;
}

export interface Limits {
  maxTitle: number;
  maxBody: number;
  /** Announcements a board keeps: past it a new one pushes the oldest unpinned one off. */
  maxPosts: number;
}

export interface BoardState {
  job: { name: string; label: string };
  /** The player is a boss of the job: they post, pin, reword and delete. */
  canPost: boolean;
  /** Pinned first, then newest first. */
  posts: Post[];
  /** Highest rank first. null = the framework has no roster (ESX): there is no On duty page. */
  roster: Member[] | null;
  limits: Limits;
}

/** What the composer holds. */
export interface Draft {
  title: string;
  body: string;
  pinned: boolean;
}
