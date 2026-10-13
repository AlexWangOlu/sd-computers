import { useState } from 'react';
import { Building2, MapPin, Phone, Send } from 'lucide-react';
import { t } from '@/i18n';
import { asDirectory, type Company } from './data';
import { act, useLive } from './useLive';
import { Area, Btn, Failed, Note, Nothing, Site, Waiting, fmtNumber, type LiveProps } from './parts';

// The business directory: the companies the phone's Services app lists, as the city's own page -
// a teal banner, and a card for each company saying whether anybody is in. A message goes to
// whoever is on duty there, as one written on the phone would; what they answer comes to the
// sender's phone, since that is where their side of the conversation is kept.

const MAX_MESSAGE = 300;

function Entry({ c }: { c: Company }) {
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    setBusy(true);
    const res = await act('web:directory:message', { job: c.id, body: body.trim() });
    setBusy(false);
    if (res.ok) {
      setBody('');
      setWriting(false);
      setNote({ ok: true, text: t('ui.browser.dir_sent') });
    } else {
      setNote({ ok: false, text: res.error });
    }
  };

  return (
    <div className="dr-card p-5">
      <div className="flex items-center gap-4">
        <span className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-[28px]" style={{ background: c.color ? `${c.color}22` : '#e8f1ef', color: c.color ?? '#0f766e' }} aria-hidden>
          {c.emoji ?? <Building2 size={24} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-bold truncate">{c.name}</div>
          <div className="mt-1 flex items-center gap-4 text-[13px]">
            <span className={`dr-status ${c.onDuty ? 'is-open' : ''}`}>{t(c.onDuty ? 'ui.browser.dir_in' : 'ui.browser.dir_out')}</span>
            {c.location && (
              <span className="s-muted inline-flex items-center gap-1 min-w-0">
                <MapPin size={13} className="shrink-0" />
                <span className="truncate">{c.location}</span>
              </span>
            )}
            {c.callNumber && (
              <span className="s-muted inline-flex items-center gap-1 font-semibold tabular-nums">
                <Phone size={13} />
                {fmtNumber(c.callNumber)}
              </span>
            )}
          </div>
        </div>
        {!writing && (
          <Btn kind="primary" icon={<Send size={14} />} onClick={() => setWriting(true)}>
            {t('ui.browser.dir_write')}
          </Btn>
        )}
      </div>

      {note && !writing && (
        <div className="mt-4">
          <Note tone={note.ok ? 'success' : 'error'} onClose={() => setNote(null)}>
            {note.text}
          </Note>
        </div>
      )}

      {writing && (
        <div className="s-rule mt-4 pt-4 border-t">
          {note && !note.ok && (
            <div className="mb-2">
              <Note tone="error" onClose={() => setNote(null)}>
                {note.text}
              </Note>
            </div>
          )}
          <Area value={body} maxLength={MAX_MESSAGE} autoFocus onChange={e => setBody(e.target.value)} className="h-24" placeholder={t('ui.browser.dir_placeholder', c.name)} />
          <div className="mt-2 flex items-center gap-2">
            <Btn kind="primary" disabled={busy || body.trim() === ''} onClick={() => void send()}>
              {t('ui.browser.dir_send')}
            </Btn>
            <Btn kind="ghost" disabled={busy} onClick={() => setWriting(false)}>
              {t('ui.common.cancel')}
            </Btn>
            <span className="s-faint ml-auto text-[12px]">{t('ui.browser.dir_reply_hint')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Directory({ site, shown }: LiveProps) {
  const dir = useLive('web:directory', undefined, asDirectory, shown);
  const d = dir.data;
  // (whoever has somebody in comes first: that is who can answer now)
  const companies = d ? [...d.companies].sort((a, b) => Number(b.onDuty) - Number(a.onDuty)) : [];
  const open = companies.filter(c => c.onDuty).length;

  return (
    <Site brand="dir">
      <header className="dr-hero">
        <div className="mx-auto max-w-[820px] px-6">
          <div className="text-[11px] font-bold tracking-[0.16em] uppercase opacity-80">{t('ui.browser.dir_city')}</div>
          <h1 className="mt-1.5">{site.title}</h1>
          <p className="mt-2 text-[15px] opacity-90">{t('ui.browser.dir_tagline')}</p>
          {d && <p className="mt-4 text-[13px] font-semibold">{t('ui.browser.dir_open_now', open, companies.length)}</p>}
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-[820px] px-6 -mt-9 pb-10 page-in">
        {!d ? (
          <div className="dr-card px-5">{dir.error ? <Failed error={dir.error} onRetry={() => void dir.reload()} /> : <Waiting />}</div>
        ) : companies.length === 0 ? (
          <div className="dr-card">
            <Nothing title={t('ui.browser.dir_empty')} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {companies.map(c => (
              <Entry key={c.id} c={c} />
            ))}
          </div>
        )}
      </main>
    </Site>
  );
}
