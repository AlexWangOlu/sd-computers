import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { BellRing, CheckCircle2, MonitorSmartphone, RefreshCw, Unlink } from 'lucide-react';
import { Button, Dialog, InfoBar, Spinner, TextInput } from '@/ui/controls';
import { AppIcon } from '@/os/icons';
import { rpc } from '@/nui/rpc';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { fmtDuration, fmtShortDate, fmtTime, useNow } from '@/lib/format';
import type { RpcResult } from '@/types';
import type { AppProps } from '../registry';
import type { LinkState, Unlock } from './types';

const UNLOCKS: Unlock[] = ['messages', 'notes', 'photos', 'contacts', 'files'];

/** Unix seconds -> "10/5/2026, 6:05 PM". */
const fmtWhen = (ts: number, clock24: boolean): string => {
  const d = new Date(ts * 1000);
  return `${fmtShortDate(d)}, ${fmtTime(d, clock24)}`;
};

/** A reply as the page keeps it: Lua sends an empty list as an empty object, and may leave fields out. */
function norm(raw: unknown): LinkState {
  const r = (raw ?? {}) as Partial<LinkState>;
  const code = r.code && typeof r.code === 'object' ? { expiresIn: Number(r.code.expiresIn) || 0, resendIn: Number(r.code.resendIn) || 0 } : undefined;
  return {
    linked: r.linked === true,
    since: typeof r.since === 'number' ? r.since : undefined,
    carrying: r.carrying === true,
    requirePhone: r.requirePhone !== false,
    unlocks: Array.isArray(r.unlocks) ? r.unlocks.filter(u => UNLOCKS.includes(u)) : [],
    digits: Number(r.digits) || 6,
    minutes: Number(r.minutes) || 5,
    code,
    computer: r.computer && Array.isArray(r.computer.apps) ? r.computer : undefined,
  };
}

type Busy = 'load' | 'send' | 'confirm' | 'unlink' | null;

/**
 * Phone Link: links the character's phone to this machine, which is what puts the phone's apps on
 * it. Not linked, it sends a code to the phone and takes it back typed in; linked, it says since
 * when, opens what the phone brought, and unlinks. The server reworks the desktop's lists on a link
 * or an unlink and sends them with its reply: the icons appear, or go, without signing in again.
 */
export default function PhoneLink(_props: AppProps) {
  const clock24 = useOS(s => s.payload?.desktop.clock24 ?? false);
  const apps = useOS(s => s.payload?.computer.apps);
  const [state, setState] = useState<LinkState | null>(null);
  /** when `state` arrived: its countdowns are seconds from then */
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState<Busy>('load');
  const [failed, setFailed] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [asking, setAsking] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const now = useNow();

  /** Take a reply in. A failed action leaves the page as it was, under a line saying why. */
  const take = useCallback((res: RpcResult<unknown>, first = false): LinkState | null => {
    setBusy(null);
    if (!res.ok) {
      const why = res.error || t('ui.common.error');
      if (first) setFailed(why);
      else setNotice(why);
      return null;
    }
    const next = norm(res.data);
    setState(next);
    setAt(Date.now());
    setFailed(null);
    setNotice(null);
    if (next.computer) useOS.getState().setApps(next.computer);
    return next;
  }, []);

  const load = useCallback(async () => {
    setBusy('load');
    take(await rpc('phonelink:state'), true);
  }, [take]);

  useEffect(() => {
    void load();
  }, [load]);

  const elapsed = at ? Math.max(0, (now.getTime() - at) / 1000) : 0;
  const left = state?.code ? Math.ceil(state.code.expiresIn - elapsed) : 0;
  const resendIn = state?.code ? Math.ceil(state.code.resendIn - elapsed) : 0;
  const waiting = !!state?.code && left > 0;
  const ranOut = !!state?.code && left <= 0;

  const send = async () => {
    setBusy('send');
    setCode('');
    if (take(await rpc('phonelink:send'))) window.setTimeout(() => field.current?.focus(), 0);
  };

  const confirm = async (typed: string) => {
    if (busy || !state || typed.length !== state.digits) return;
    setBusy('confirm');
    const next = take(await rpc('phonelink:confirm', { code: typed }));
    if (next?.linked) useOS.getState().toast({ app: 'phonelink', title: t('ui.phonelink.linked_toast') });
    else {
      // (wrong, or run out: the field is cleared for the next try)
      setCode('');
      field.current?.focus();
    }
  };

  const unlink = async () => {
    setAsking(false);
    setBusy('unlink');
    const next = take(await rpc('phonelink:unlink'));
    if (next && !next.linked) useOS.getState().toast({ app: 'phonelink', title: t('ui.phonelink.unlinked_toast') });
  };

  const onType = (v: string) => {
    if (!state) return;
    const typed = v.replace(/\D/g, '').slice(0, state.digits);
    setCode(typed);
    setNotice(null);
    // (the last digit sends it: nothing else to press)
    if (typed.length === state.digits && typed !== code) void confirm(typed);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void confirm(code);
  };

  return (
    <div className="relative h-full w-full flex flex-col bg-win text-t1 overflow-hidden">
      <main className="flex-1 min-h-0 bg-layer border-t border-stroke overflow-y-auto os-scroll">
        {!state ? (
          failed ? (
            <div className="p-6 flex flex-col items-start gap-3 max-w-[520px] mx-auto">
              <div className="w-full">
                <InfoBar severity="error" title={t('ui.phonelink.load_failed')}>
                  {failed}
                </InfoBar>
              </div>
              <Button icon={busy === 'load' ? <Spinner size={14} /> : <RefreshCw size={16} />} onClick={() => void load()} disabled={busy === 'load'}>
                {t('ui.common.retry')}
              </Button>
            </div>
          ) : (
            <div className="h-full min-h-[200px] w-full flex flex-col items-center justify-center gap-3 text-caption text-t2">
              <Spinner size={28} />
              {t('ui.common.loading')}
            </div>
          )
        ) : (
          <div className="mx-auto w-full max-w-[520px] px-6 pt-7 pb-8 page-in">
            <div className="flex flex-col items-center text-center">
              <span className={`w-16 h-16 rounded-full bg-subtle border border-stroke flex items-center justify-center ${state.linked ? 'text-success' : 'text-accent-text'}`}>
                {state.linked ? <CheckCircle2 size={30} /> : <MonitorSmartphone size={30} />}
              </span>
              <h1 className="font-display text-title font-semibold text-t1 mt-4">{t(state.linked ? 'ui.phonelink.linked_title' : 'ui.phonelink.title')}</h1>
              <p className="text-body text-t2 mt-1.5 max-w-[420px]">
                {state.linked ? (state.since ? t('ui.phonelink.linked_since', fmtWhen(state.since, clock24)) : '') : t('ui.phonelink.intro')}
              </p>
            </div>

            {notice && (
              <div className="mt-5">
                <InfoBar severity="error" onClose={() => setNotice(null)}>
                  {notice}
                </InfoBar>
              </div>
            )}

            {state.linked && state.requirePhone && !state.carrying && (
              <div className="mt-5">
                <InfoBar severity="warning" title={t('ui.phonelink.away_title')}>
                  {t('ui.phonelink.away_body')}
                </InfoBar>
              </div>
            )}

            {!state.linked &&
              (waiting ? (
                <form onSubmit={onSubmit} className="ctl-card mt-5 rounded-win bg-card border border-stroke shadow-card p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0 text-accent-text">
                      <BellRing size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-body font-semibold text-t1">{t('ui.phonelink.sent_title')}</div>
                      <div className="text-body text-t2 mt-0.5">{t('ui.phonelink.sent_body', state.digits)}</div>
                      <div className="text-caption text-t3 mt-1">{t('ui.phonelink.sent_away')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <TextInput
                      ref={field}
                      value={code}
                      onChange={e => onType(e.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-label={t('ui.phonelink.code_label')}
                      placeholder={'•'.repeat(state.digits)}
                      disabled={busy === 'confirm'}
                      autoFocus
                      className="!h-11 flex-1 text-center text-[20px] font-semibold tabular-nums tracking-[0.35em]"
                    />
                    <Button type="submit" variant="accent" className="!h-11 px-5" disabled={busy !== null || code.length !== state.digits} icon={busy === 'confirm' ? <Spinner size={14} className="!text-accent-on" /> : undefined}>
                      {t(busy === 'confirm' ? 'ui.phonelink.linking' : 'ui.phonelink.link')}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-3">
                    <span className="text-caption text-t2 tabular-nums">{t('ui.phonelink.expires', fmtDuration(left))}</span>
                    <Button variant="subtle" compact onClick={() => void send()} disabled={busy !== null || resendIn > 0}>
                      {resendIn > 0 ? t('ui.phonelink.resend_in', fmtDuration(resendIn)) : t('ui.phonelink.resend')}
                    </Button>
                  </div>
                </form>
              ) : !state.carrying ? (
                <div className="mt-5 flex flex-col items-center gap-3">
                  <div className="w-full">
                    <InfoBar severity="warning" title={t('ui.phonelink.no_phone_title')}>
                      {t('ui.phonelink.no_phone_body')}
                    </InfoBar>
                  </div>
                  <Button icon={busy === 'load' ? <Spinner size={14} /> : <RefreshCw size={16} />} onClick={() => void load()} disabled={busy !== null}>
                    {t('ui.phonelink.check_again')}
                  </Button>
                </div>
              ) : (
                <div className="mt-5 flex flex-col items-center gap-3">
                  {ranOut && (
                    <div className="w-full">
                      <InfoBar severity="info" title={t('ui.phonelink.expired_title')}>
                        {t('ui.phonelink.expired_body')}
                      </InfoBar>
                    </div>
                  )}
                  <Button variant="accent" className="!h-10 px-5" icon={busy === 'send' ? <Spinner size={14} className="!text-accent-on" /> : <BellRing size={16} />} onClick={() => void send()} disabled={busy !== null}>
                    {t(busy === 'send' ? 'ui.phonelink.sending' : 'ui.phonelink.send')}
                  </Button>
                </div>
              ))}

            {state.unlocks.length > 0 && (
              <section className="mt-6">
                <div className="text-caption font-semibold text-t2 mb-2 px-1">{t(state.linked ? 'ui.phonelink.apps_title' : 'ui.phonelink.unlocks_title')}</div>
                <div className="ctl-card rounded-win bg-card border border-stroke shadow-card overflow-hidden">
                  {state.unlocks.map((u, i) => {
                    const here = state.linked && !!apps?.some(a => a.id === u);
                    return (
                      <div key={u} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-stroke' : ''}`}>
                        <span className="shrink-0">
                          <AppIcon app={u} size={28} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-body text-t1 truncate">{t(`ui.phonelink.unlock_${u}`)}</div>
                          <div className="text-caption text-t2 truncate">{t(`ui.phonelink.unlock_${u}_hint`)}</div>
                        </div>
                        {here && (
                          <Button compact onClick={() => useOS.getState().openApp(u)}>
                            {t('ui.phonelink.open')}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {state.linked && (
              <div className="mt-6 flex justify-center">
                <Button variant="subtle" icon={busy === 'unlink' ? <Spinner size={14} /> : <Unlink size={16} />} onClick={() => setAsking(true)} disabled={busy !== null}>
                  {t(busy === 'unlink' ? 'ui.phonelink.unlinking' : 'ui.phonelink.unlink')}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {asking && (
        <Dialog
          title={t('ui.phonelink.unlink_title')}
          onClose={() => setAsking(false)}
          actions={
            <>
              <Button onClick={() => setAsking(false)}>{t('ui.common.cancel')}</Button>
              <Button variant="danger" onClick={() => void unlink()}>
                {t('ui.phonelink.unlink_confirm')}
              </Button>
            </>
          }
        >
          {t('ui.phonelink.unlink_body')}
        </Dialog>
      )}
    </div>
  );
}
