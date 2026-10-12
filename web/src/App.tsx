import { useCallback, useEffect, useState } from 'react';
import type { HackRun, OpenPayload } from './types';
import { useNuiEvent } from './hooks/useNuiEvent';
import { fetchNui, isEnvBrowser } from './nui/bridge';
import { mockPayloadFor } from './nui/mock/payload';
import type { OsStyle } from './types';
import { mockRpc } from './nui/mock';
import { setLocale, useI18n } from './i18n';
import { useOS } from './store/os';
import { emit } from './lib/bus';
import { t } from './i18n';
import { messagePreview } from './apps/messages/format';
import type { IncomingPush } from './apps/messages/types';
import { sfx } from './os/sfx';
import Computer from './os/Computer';
import LibHack from './os/LibHack';
import { AdminFrame } from './AdminFrame';

/** computers:mail:received (built-in Mail) - also what a phone mail push is reshaped into. */
interface MailPush {
  mailbox: string;
  message: { id: number | string; senderName: string; senderEmail: string; subject: string; preview: string };
}

/** sd-phone's MailMessage, as its client event carries it (only the fields used here). */
interface PhoneMail {
  id: string;
  accountId?: string;
  from?: { name?: string; email?: string };
  subject?: string;
  body?: string;
}

/** Tell the Mail app, and toast on the desktop (clicking opens that message). */
function notifyMail(d: MailPush): void {
  emit('mail:received', d);
  const os = useOS.getState();
  if (os.phase !== 'desktop') return;
  // The retro shell's toast box plays its own period chime.
  if (os.payload?.computer.style !== 'retro') sfx.notify();
  os.toast({
    app: 'mail',
    title: d.message.senderName,
    body: d.message.subject || d.message.preview,
    onClick: () => useOS.getState().openApp('mail', { mailbox: d.mailbox, messageId: d.message.id }),
  });
}

/**
 * NUI root. Messages from client Lua:
 *   computers:open           boot the OS with session.open's payload
 *   computers:close          fade out and tear down
 *   computers:mail:received  toast + tell the Mail app (lib/bus 'mail:received')
 *   computers:phone:mail     sd-phone pushed a phone mail (only used while Mail runs on the phone)
 *   computers:phone:message  sd-phone pushed a text (only used when the Messages app is installed)
 *   computers:phone:seen     sd-phone: a 1:1 peer read my texts (lib/bus 'messages:seen')
 *   computers:lib:open       StartHack export: a standalone hack.exe window, no desktop needed
 * Browser dev (`npm run dev`): opens itself with the mock payload. URL hashes: #desktop skips
 * boot+lock, #lib opens a standalone hack, #<app> (e.g. #mail) also opens that app.
 * ?style=retro / ?style=mac picks the computer's look.
 */
export default function App() {
  useI18n();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [lib, setLib] = useState<HackRun | null>(null);

  const open = useCallback((p: OpenPayload) => {
    useOS.getState().bootWith(p);
    setClosing(false);
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setVisible(false);
      setClosing(false);
      useOS.getState().reset();
    }, 250);
  }, []);

  useNuiEvent<OpenPayload>('computers:open', open);
  useNuiEvent('computers:close', close);

  useNuiEvent<MailPush>('computers:mail:received', d => {
    if (d) notifyMail(d);
  });

  // Optional sd-phone link: sd-phone's own pushes, forwarded by client/computers/nui.lua.
  useNuiEvent<PhoneMail>('computers:phone:mail', m => {
    if (!m || !useOS.getState().payload?.mail.phone) return;
    const from = m.from ?? {};
    notifyMail({
      mailbox: String(m.accountId ?? '').toLowerCase(),
      message: {
        id: m.id,
        senderName: from.name || from.email || '',
        senderEmail: from.email ?? '',
        subject: m.subject ?? '',
        preview: String(m.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
      },
    });
  });

  useNuiEvent<IncomingPush>('computers:phone:message', c => {
    const os = useOS.getState();
    if (!c || !os.payload?.computer.apps.some(a => a.id === 'messages')) return;
    emit('messages:incoming', c);
    if (os.phase !== 'desktop') return;
    const msg = Array.isArray(c.messages) ? c.messages[0] : undefined;
    const sender = Array.isArray(c.participants) ? c.participants.find(p => p.phone === msg?.from) ?? c.participants[0] : undefined;
    const name = sender?.name || msg?.from || '';
    if (os.payload.computer.style !== 'retro') sfx.notify();
    os.toast({
      app: 'messages',
      title: c.groupName || name || t('ui.messages.new_message'),
      body: msg ? (c.groupName && name ? `${name}: ${messagePreview(msg)}` : messagePreview(msg)) : '',
      onClick: () => useOS.getState().openApp('messages', { conversation: c.id }),
    });
  });

  useNuiEvent<{ conversation: string; seenAt: number }>('computers:phone:seen', d => {
    if (d && useOS.getState().payload?.computer.apps.some(a => a.id === 'messages')) emit('messages:seen', d);
  });

  useNuiEvent<HackRun>('computers:lib:open', run => setLib(run));

  useEffect(() => {
    void fetchNui<{ strings: Record<string, unknown> }>('computers:ui:locale').then(r => {
      if (r?.strings) setLocale(r.strings);
    });
  }, []);

  // Browser dev entry points.
  useEffect(() => {
    if (!isEnvBrowser()) return;
    const hash = window.location.hash.replace('#', '');
    const wanted = new URLSearchParams(window.location.search).get('style');
    const style: OsStyle = wanted === 'retro' || wanted === 'mac' ? wanted : 'modern';
    const mockPayload = mockPayloadFor(style);
    if (hash === 'lib') {
      void mockRpc<HackRun>('hack:start', { game: 'pipe', difficulty: 'easy' }).then(r => r.data && setLib({ ...r.data, title: 'Vault Door Panel' }));
      return;
    }
    open(mockPayload);
    if (hash) {
      const os = useOS.getState();
      os.setPhase('desktop');
      if (hash !== 'desktop') window.setTimeout(() => os.openApp(hash as never), 50);
    }
    // Reopen after "shutting down" so the browser session never ends up on a blank page.
    const reopen = () => window.setTimeout(() => open(mockPayload), 1200);
    window.addEventListener('message', e => {
      if ((e.data as { action?: string })?.action === 'computers:close') reopen();
    });
  }, [open]);

  return (
    <>
      {visible && (
        <div className={`absolute inset-0 ${closing ? 'fade-out' : 'fade-in'}`}>
          <Computer />
        </div>
      )}
      {lib && <LibHack run={lib} onClose={() => setLib(null)} />}
      {/* The /computeradmin panel: its own page, always mounted in the game so Lua can open it at
          any time. In a browser it is a tab of its own (/admin.html), not a frame over the OS. */}
      {!isEnvBrowser() && <AdminFrame />}
    </>
  );
}
