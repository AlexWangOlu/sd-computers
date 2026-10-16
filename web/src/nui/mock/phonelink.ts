import type { MockHandler } from './index';
import type { AppId, OpenPayload, RpcResult } from '@/types';
import type { DesktopLists, LinkState, Unlock } from '@/apps/phonelink/types';

// (its own ok / fail: payload.ts loads this file for withPhoneLink before ./index has run, and
// ./index spreads this file's handlers as it loads - importing anything but types from it here
// would be a loop)
const ok = <T>(data?: T): RpcResult<T> => ({ ok: true, data });
const fail = (error: string): RpcResult<never> => ({ ok: false, error });

// Browser mocks for phonelink:* (server/computers/phonelink.lua). State lives in module variables
// so a dev session sticks until reload. The dev payload is a machine the phone is already linked
// to, so the phone's apps are on its desktop and Phone Link opens on its linked page.
//
// Dev views:
//   ?phonelink=new      a machine the phone is not linked to: no phone apps until the code is typed in
//   ?phonelink=nophone  the same, with the phone left at home: no code can be sent
// The code the mock "sends" is always 123456 (it is printed in the browser console too). Anything
// else is a wrong code, and five wrong ones use the code up, as on the server.

const FLAG = new URLSearchParams(window.location.search).get('phonelink');
const NEW = FLAG === 'new' || FLAG === 'nophone';
const CARRYING = FLAG !== 'nophone';

const CODE = '123456';
const CODE_TTL = 5 * 60;
const RESEND = 30;
const MAX_TRIES = 5;
const UNLOCKS: Unlock[] = ['messages', 'notes', 'photos', 'contacts', 'files'];
const PHONE_APPS: AppId[] = ['messages', 'notes', 'photos', 'contacts'];

let linkedAt: number | null = NEW ? null : Math.floor(Date.now() / 1000) - 3 * 86400;
let pending: { expires: number; sentAt: number; tries: number } | null = null;
/** the dev payload's own lists, everything the phone brings included */
let full: DesktopLists | null = null;

const nowS = (): number => Math.floor(Date.now() / 1000);

const waiting = () => {
  if (pending && pending.expires <= nowS()) pending = null;
  return pending;
};

/** The desktop's lists as they stand: the phone's apps only while it is linked. */
const lists = (): DesktopLists | undefined => {
  if (!full) return undefined;
  if (linkedAt !== null) return full;
  const keep = (id: AppId) => !PHONE_APPS.includes(id);
  return { apps: full.apps.filter(a => keep(a.id)), pinned: full.pinned.filter(keep), desktopIcons: full.desktopIcons.filter(keep) };
};

/** The dev payload as this mock has the machine: with the phone's apps, or (?phonelink=new) without. */
export function withPhoneLink(p: OpenPayload): OpenPayload {
  full = { apps: p.computer.apps, pinned: p.computer.pinned, desktopIcons: p.computer.desktopIcons };
  return { ...p, computer: { ...p.computer, ...lists() } };
}

const state = (withLists = false): LinkState => {
  const w = waiting();
  const now = nowS();
  return {
    linked: linkedAt !== null,
    since: linkedAt ?? undefined,
    carrying: CARRYING,
    requirePhone: true,
    unlocks: UNLOCKS,
    digits: CODE.length,
    minutes: CODE_TTL / 60,
    code: linkedAt === null && w ? { expiresIn: w.expires - now, resendIn: Math.max(0, w.sentAt + RESEND - now) } : undefined,
    computer: withLists ? lists() : undefined,
  };
};

const handlers: Record<string, MockHandler> = {
  'phonelink:state': () => ok(state()),

  'phonelink:send': () => {
    if (linkedAt !== null) return ok(state());
    if (!CARRYING) return fail('你需要随身携带手机才能获取验证码。');
    const now = nowS();
    const old = waiting();
    if (old && old.sentAt + RESEND > now) return fail(`验证码刚已发送。${old.sentAt + RESEND - now} 秒后可再次获取。`);
    pending = { expires: now + CODE_TTL, sentAt: now, tries: 0 };
    console.info(`[mock] Phone Link: the code "sent to the phone" is ${CODE}`);
    return ok(state());
  },

  'phonelink:confirm': p => {
    const typed = typeof p.code === 'string' ? p.code.replace(/\D/g, '') : '';
    if (typed.length !== CODE.length) return fail(`验证码为 ${CODE.length} 位数字。`);
    const w = waiting();
    if (!w) return fail('没有待输入的验证码。可能已过期，请重新发送。');
    if (typed !== CODE) {
      w.tries += 1;
      if (w.tries >= MAX_TRIES) {
        pending = null;
        return fail('验证码错误次数过多。请重新发送。');
      }
      return fail(`验证码不正确。还剩 ${MAX_TRIES - w.tries} 次尝试。`);
    }
    pending = null;
    linkedAt = nowS();
    return ok(state(true));
  },

  'phonelink:unlink': () => {
    pending = null;
    linkedAt = null;
    return ok(state(true));
  },
};

export default handlers;
