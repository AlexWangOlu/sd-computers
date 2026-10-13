import type { MockHandler } from './index';
import type { PaperPage } from '@/os/Paper';

// Printing in the browser: two printers near the mock computer, one of them with a full tray, and
// a submit that only counts what was sent. What a page looks like is src/os/Paper.tsx, which the
// browser opens with #paper (see src/App.tsx).

const printers = [
  { id: 1, label: 'Front desk printer', distance: 4, waiting: 0, full: false },
  { id: 2, label: 'Records room copier', distance: 18, waiting: 3, full: false },
  { id: 3, label: 'Briefing room printer', distance: 27, waiting: 25, full: true },
];

const handlers: Record<string, MockHandler> = {
  'print:printers': () => ({ ok: true, data: { enabled: true, printers, maxCopies: 5, pageSeconds: 2.5 } }),
  'print:submit': p => {
    const printer = printers.find(x => x.id === Number(p.printer));
    if (!printer || printer.full) return { ok: false, error: 'That printer is out of reach of this computer.' };
    const copies = Math.max(1, Math.min(5, Number(p.copies) || 1));
    printer.waiting += copies;
    console.info('[mock] printed', p.source, p.data, `x${copies}`, 'on', printer.label);
    return { ok: true, data: { printer: printer.label, copies, seconds: Math.ceil(copies * 2.5) } };
  },
};

const now = () => Math.floor(Date.now() / 1000);

/** A printed page of each kind, for #paper in the browser (?kind=text|mail|statement|logs|faded). */
export function mockPage(kind: string | null): PaperPage {
  const base = { id: 142, by: 'Jessica Hale', from: 'LSPD-MRPD-FD01', at: now() - 3600 };
  if (kind === 'faded') return { faded: true, title: 'Shift handover' };
  if (kind === 'mail') {
    return {
      ...base,
      doc: {
        kind: 'mail',
        title: 'Re: Evidence locker audit',
        letterhead: 'Mail',
        subhead: 'j.hale@lsmail.com',
        fields: [
          { label: 'From', value: 'Marcus Reyes <m.reyes@lsmail.com>' },
          { label: 'To', value: 'j.hale@lsmail.com, records@lsmail.com' },
          { label: 'Sent', value: '13/10/2026 21:14' },
        ],
        body: 'Jess,\n\nThe count came back two short on shelf C. Both are from the Vinewood case and both were signed out on the 9th with no name against them.\n\nCan you pull the log for that terminal before the morning briefing? I would rather walk in with paper than with a hunch.\n\nMarcus',
      },
    };
  }
  if (kind === 'statement') {
    return {
      ...base,
      doc: {
        kind: 'statement',
        title: 'Account statement',
        letterhead: 'Bank',
        subhead: 'Personal account statement',
        fields: [
          { label: 'Account holder', value: 'Jessica Hale' },
          { label: 'Balance', value: '$48,210' },
          { label: 'Printed', value: '13/10/2026 22:02' },
        ],
        table: {
          head: ['Date', 'Description', 'Amount'],
          rows: [
            ['13/10/2026 18:40', 'Paycheck - Los Santos Police Department', '+$2,450'],
            ['13/10/2026 12:05', '24/7 Supermarket', '-$84'],
            ['12/10/2026 22:31', 'Transfer to Marcus Reyes', '-$500'],
            ['12/10/2026 09:12', 'Los Santos Customs', '-$1,920'],
            ['11/10/2026 17:48', 'Paycheck - Los Santos Police Department', '+$2,450'],
            ['10/10/2026 20:19', 'Fleeca ATM withdrawal', '-$300'],
          ],
        },
      },
    };
  }
  if (kind === 'logs') {
    const rows: string[][] = [];
    const what = [
      ['success', 'Security', '4624', 'Jessica Hale signed in.'],
      ['information', 'Application', '1000', 'Application started: Mail.'],
      ['information', 'Mail', '3001', 'Mail sent from j.hale@lsmail.com to records@lsmail.com: Evidence locker audit'],
      ['failure', 'Security', '4625', 'Sign-in failed: wrong PIN.'],
      ['warning', 'Security', '4740', 'Locked out after 5 failed sign-ins.'],
      ['information', 'Print Spooler', '5001', 'Printed "Shift handover" (2) on Front desk printer.'],
      ['success', 'Security', '4634', 'Jessica Hale signed out.'],
    ];
    for (let i = 0; i < 22; i++) {
      const w = what[i % what.length];
      rows.push([`13/10/2026 2${Math.floor(i / 8)}:${String(58 - i * 2).padStart(2, '0')}:1${i % 10}`, ...w]);
    }
    return {
      ...base,
      doc: {
        kind: 'logs',
        title: 'System log of LSPD-MRPD-FD01',
        letterhead: 'Event Viewer',
        subhead: 'MRPD front desk',
        fields: [
          { label: 'Computer', value: 'LSPD-MRPD-FD01' },
          { label: 'Entries', value: String(rows.length) },
          { label: 'Printed', value: '13/10/2026 22:02' },
        ],
        table: { head: ['Time', 'Level', 'Source', 'Event', 'Message'], rows },
      },
    };
  }
  return {
    ...base,
    doc: {
      kind: 'text',
      title: 'Shift handover',
      body: 'Night shift, 13 October\n\n- Front desk printer is low on toner. Stores have been told.\n- Two walk-ins about the Vinewood break-in. Statements are in the tray, not yet filed.\n- The holding cell camera drops out for a second or two every hour. Logged with IT.\n- Keys for unit 14 are with the watch commander.\n\nNothing else to report. Coffee machine still broken.\n\nJ. Hale',
    },
  };
}

export default handlers;
