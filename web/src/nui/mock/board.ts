import { t } from '@/i18n';
import type { MockHandler } from './index';
import { fail, ok } from './index';

// Browser mocks for the Company Board (server/computers/board.lua): the LSPD's board with Jessica
// Hale as Chief (a boss, so she posts), six announcements with two pinned, and the roster the
// Business Manager mock uses. State is module-level so posts, pins, edits and deletions persist for
// the dev session. Errors use the server's own locale keys, so the wording matches the game exactly.
//
// The other ways the board can look, from the address bar (combine with commas):
//   ?board=staff     someone who is not a boss: nothing to post with, and every write is refused
//   ?board=noroster  ESX: no roster, so no On duty page
//   ?board=empty     a board nobody has posted on yet
//   ?board=nojob     no job with a board: board:state is refused, as the server refuses it

const FLAGS = new Set((new URLSearchParams(window.location.search).get('board') ?? '').split(',').filter(Boolean));
const STAFF = FLAGS.has('staff');
const NO_ROSTER = FLAGS.has('noroster');
const NO_JOB = FLAGS.has('nojob');

const JOB = { name: 'police', label: '洛圣都警察局' };
const GRADES: Record<number, string> = { 0: 'Recruit', 1: 'Officer', 2: 'Sergeant', 3: 'Lieutenant', 4: 'Chief' };
const MY_CID = 'JH123';
const MY_NAME = 'Jessica Hale';
// configs/shared/board.lua
const LIMITS = { maxTitle: 80, maxBody: 2000, maxPosts: 50 };

interface MockMember {
  cid: string;
  name: string;
  grade: number;
  online: boolean;
  onDuty: boolean;
}

interface MockPost {
  id: number;
  title: string;
  body: string;
  author: string;
  pinned: boolean;
  ts: number;
  edited: number | null;
}

const roster: MockMember[] = [
  { cid: MY_CID, name: MY_NAME, grade: STAFF ? 2 : 4, online: true, onDuty: true }, // (?board=staff: a Sergeant, not the Chief)
  { cid: 'RC771', name: 'Raymond Cole', grade: 4, online: false, onDuty: false },
  { cid: 'MD482', name: 'Marcus Delgado', grade: 3, online: true, onDuty: true },
  { cid: 'PN217', name: 'Priya Nair', grade: 2, online: true, onDuty: false },
  { cid: 'TB905', name: 'Tom Becker', grade: 2, online: false, onDuty: false },
  { cid: 'AB331', name: 'Aaliyah Brooks', grade: 1, online: true, onDuty: true },
  { cid: 'SM764', name: 'Sofia Marin', grade: 1, online: true, onDuty: true },
  { cid: 'CW118', name: 'Connor Walsh', grade: 1, online: false, onDuty: false },
  { cid: 'DO559', name: 'Dante Okafor', grade: 0, online: true, onDuty: false },
];

const now = (): number => Math.floor(Date.now() / 1000);

const H = 3600;
const D = 86400;

// [seconds ago, pinned, author, headline, text, edited seconds ago] - newest first.
const SEED: [number, boolean, string, string, string[], number?][] = [
  [
    2.5 * H,
    false,
    MY_NAME,
    '本周六射击资格考核',
    [
      '年度手枪资格考核周六 10:00 开始，地点在米申罗地下的室内靶场。',
      '',
      '各位警士请在周四前把你们的班组写在军械库外的登记表上。到月底还没通过考核的人一律停止巡逻，直到通过为止。',
    ],
  ],
  [
    1.1 * D,
    false,
    MY_NAME,
    '欢迎 Okafor 新警员',
    ['Dante Okafor 本周起加入我们。在他的实地训练签核之前，他跟着 Nair 警士同车——都去打声招呼，告诉他咖啡在哪，遇到清闲的警情让他拿对讲机。'],
  ],
  [
    2.2 * D,
    true,
    MY_NAME,
    '每次出警都必须开启执法记录仪',
    [
      '从周一起，每一次盘查、搜查和抓捕都要全程录像。没有记录仪，就不出勤。',
      '',
      '- 下班时把记录仪放回充电座，让录像自动上传',
      '- 电池没电是回一趟警局的理由，不是不带的理由',
      '- 设备丢失或损坏，当天就要向你的中尉提交报告',
    ],
    1.9 * D,
  ],
  [
    3.4 * D,
    false,
    'Raymond Cole',
    '14 号巡逻车停用',
    ['变速箱报废了，在 Los Santos Customs 修理，恢复时间另行通知——别再签它的派车单，车库那块牌子上的信息是错的。'],
  ],
  [
    5.2 * D,
    true,
    'Raymond Cole',
    '无线电频道',
    ['1 频道 - 调度与巡逻', '2 频道 - 拦车与追捕', '3 频道 - 战术行动，受邀加入', '5 频道 - 与医疗部门的联合行动', '', '1 频道不要闲聊。不是警情的事，到停车场去说。'],
  ],
  [
    6.3 * D,
    false,
    MY_NAME,
    '事故报告 24 小时内提交',
    ['上个月有两个案子被法院驳回，原因就是文书在听证会之后才送到。报告要在下班前提交，最晚下一个班次一开始就交。'],
  ],
];

let posts: MockPost[] = FLAGS.has('empty')
  ? []
  : SEED.map(([ago, pinned, author, title, lines, edited], i) => ({
      id: SEED.length - i, // (ids climb with time, like the table's)
      title,
      body: lines.join('\n'),
      author,
      pinned,
      ts: now() - Math.round(ago),
      edited: edited === undefined ? null : now() - Math.round(edited),
    }));
let nextId = SEED.length + 1;

/** Pinned first, then newest first - board.lua's ORDER BY pinned DESC, id DESC. */
const sorted = (): MockPost[] => [...posts].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.id - a.id).map(p => ({ ...p }));

/** shared/text.lua clip: characters, not UTF-16 units. */
const clip = (s: string, max: number): string => Array.from(s).slice(0, max).join('');

/** board.lua titleOf: one line, trimmed, cut to length. */
const titleOf = (raw: unknown): string =>
  typeof raw === 'string' ? clip(raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim(), LIMITS.maxTitle).trim() : '';

/** board.lua bodyOf: line breaks kept, runs of empty lines tidied, trimmed, cut to length. */
const bodyOf = (raw: unknown): string =>
  typeof raw === 'string'
    ? clip(raw.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), LIMITS.maxBody).trim()
    : '';

/** board.lua writable: the caller's board, the one the UI was showing, and only for a boss. null = go ahead. */
const refusal = (p: Record<string, unknown>): string | null => {
  if (NO_JOB) return t('board.err_no_board');
  if (p.job !== undefined && p.job !== JOB.name) return t('board.err_job_changed');
  if (STAFF) return t('board.err_not_boss');
  return null;
};

const idOf = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

const handlers: Record<string, MockHandler> = {
  'board:state': () => {
    if (NO_JOB) return fail(t('board.err_no_board'));
    return ok({
      job: JOB,
      canPost: !STAFF,
      posts: sorted(),
      // (highest rank first, without citizenids - and no roster at all where the framework has none)
      ...(NO_ROSTER
        ? {}
        : {
            roster: [...roster]
              .sort((a, b) => b.grade - a.grade || a.name.localeCompare(b.name))
              .map(e => ({ name: e.name, grade: e.grade, gradeName: GRADES[e.grade] ?? String(e.grade), online: e.online, onDuty: e.onDuty, me: e.cid === MY_CID })),
          }),
      limits: LIMITS,
    });
  },

  'board:post': p => {
    const no = refusal(p);
    if (no) return fail(no);
    const title = titleOf(p.title);
    if (!title) return fail(t('board.err_title'));

    // A full board drops its oldest unpinned announcement; one pinned from top to bottom can't.
    const over = posts.length - LIMITS.maxPosts + 1;
    if (over > 0) {
      const doomed = posts
        .filter(x => !x.pinned)
        .sort((a, b) => a.id - b.id)
        .slice(0, over);
      if (doomed.length < 1) return fail(t('board.err_full', LIMITS.maxPosts));
      posts = posts.filter(x => !doomed.includes(x));
    }

    const post: MockPost = { id: nextId++, title, body: bodyOf(p.body), author: MY_NAME, pinned: p.pinned === true, ts: now(), edited: null };
    posts.push(post);
    return ok({ id: post.id, posts: sorted() });
  },

  'board:edit': p => {
    const no = refusal(p);
    if (no) return fail(no);
    const id = idOf(p.id);
    if (id === null) return fail(t('err.invalid'));
    const title = titleOf(p.title);
    if (!title) return fail(t('board.err_title'));
    const post = posts.find(x => x.id === id);
    if (!post) return fail(t('board.err_gone'));
    post.title = title;
    post.body = bodyOf(p.body);
    post.edited = now();
    return ok({ posts: sorted() });
  },

  'board:pin': p => {
    const no = refusal(p);
    if (no) return fail(no);
    const id = idOf(p.id);
    if (id === null || typeof p.pinned !== 'boolean') return fail(t('err.invalid'));
    const post = posts.find(x => x.id === id);
    if (!post) return fail(t('board.err_gone'));
    post.pinned = p.pinned;
    return ok({ posts: sorted() });
  },

  // (one that is already gone is no error: it is off the board)
  'board:delete': p => {
    const no = refusal(p);
    if (no) return fail(no);
    const id = idOf(p.id);
    if (id === null) return fail(t('err.invalid'));
    posts = posts.filter(x => x.id !== id);
    return ok({ posts: sorted() });
  },
};

export default handlers;
