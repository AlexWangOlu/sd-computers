import type { MockHandler } from './index';
import type { PaperPage } from '@/os/Paper';
import type { FontKey } from '@/lib/richdoc';

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

/** A picture that draws offline, for the pages that carry one. */
const PHOTO =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 400 250"><rect width="400" height="250" fill="#3b4250"/><rect x="24" y="30" width="352" height="12" fill="#6b7384"/><rect x="24" y="110" width="352" height="12" fill="#6b7384"/><rect x="24" y="190" width="352" height="12" fill="#6b7384"/><rect x="40" y="52" width="50" height="58" fill="#c9b38a"/><rect x="100" y="62" width="40" height="48" fill="#a8895c"/><rect x="230" y="56" width="64" height="54" fill="#d8c6a2"/><rect x="56" y="134" width="70" height="56" fill="#b69a6a"/><rect x="150" y="142" width="44" height="48" fill="#d2bd94"/><rect x="300" y="138" width="52" height="52" fill="#a38253"/></svg>',
  );

/** A signature that draws offline: a name set in a hand, the way a typed one is. */
function mockInk(name: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 150;
  const c = canvas.getContext('2d');
  if (!c) return '';
  c.font = "400 64px 'Segoe Script', 'Lucida Handwriting', cursive";
  c.fillStyle = '#16245c';
  c.textBaseline = 'middle';
  c.fillText(name, 12, 80);
  return canvas.toDataURL('image/png');
}

/** A printed page of each kind, for #paper in the browser (?kind=text|document|contract|long|mail|statement|logs|faded, and &font= for the document). */
export function mockPage(kind: string | null, font?: FontKey | null): PaperPage {
  const base = { id: 142, by: 'Jessica Hale', from: 'LSPD-MRPD-FD01', at: now() - 3600 };
  if (kind === 'faded') return { faded: true, title: 'Shift handover' };
  if (kind === 'contract') {
    return {
      ...base,
      signing: { name: 'Jessica Hale' },
      doc: {
        kind: 'document',
        title: 'Tenancy agreement',
        rich: {
          v: 1,
          font: font ?? 'classic',
          blocks: [
            { t: 'h1', a: 'center', r: [{ s: 'Tenancy Agreement' }] },
            { t: 'p', a: 'center', r: [{ s: '14 Grove Street, Davis', z: 'l' }] },
            { t: 'hr' },
            {
              t: 'p',
              a: 'justify',
              r: [
                { s: 'This agreement is made between ' },
                { s: 'Marcus Reyes', b: true },
                { s: ' (the landlord) and ' },
                { s: 'Jessica Hale', b: true },
                { s: ' (the tenant). The rent is ' },
                { s: '$1,200 a week', c: 'red', b: true },
                { s: ', paid every Monday, and the first week is paid on signing.' },
              ],
            },
            { t: 'ol', items: [[{ s: 'The tenant keeps the house in good order.' }], [{ s: 'The landlord gives a week of notice before any visit.' }], [{ s: 'Either side may end the agreement with two weeks of notice.' }]] },
            { t: 'p', r: [{ s: 'Typed on the office machine: ', z: 's', c: 'grey' }, { s: 'REF 0412-GS', f: 'mono', z: 's', c: 'grey' }] },
            { t: 'p', r: [{ s: 'Signed by both parties:', i: true }] },
            { t: 'sign', label: 'Landlord', sig: { name: 'Marcus Reyes', at: now() - 1800, img: mockInk('M. Reyes') } },
            { t: 'sign', label: 'Tenant' },
            { t: 'sign', label: 'Witness' },
          ],
        },
      },
    };
  }
  if (kind === 'document') {
    return {
      ...base,
      doc: {
        kind: 'document',
        title: 'Evidence locker audit',
        rich: {
          v: 1,
          font: font ?? 'serif',
          blocks: [
            { t: 'h1', a: 'center', r: [{ s: 'Evidence Locker Audit' }] },
            { t: 'p', a: 'center', r: [{ s: 'Mission Row Police Department', i: true }] },
            { t: 'hr' },
            { t: 'h2', r: [{ s: 'Summary' }] },
            {
              t: 'p',
              a: 'justify',
              r: [
                { s: 'The quarterly count of shelf C came back ' },
                { s: 'two items short', b: true },
                { s: '. Both belong to the Vinewood case and both were signed out on the 9th with ' },
                { s: 'no name', u: true },
                { s: ' against them. The log for the booking terminal has been printed and is attached to this report.' },
              ],
            },
            { t: 'img', src: PHOTO, w: 50, cap: 'Shelf C, photographed during the count' },
            { t: 'h2', r: [{ s: 'What is missing' }] },
            { t: 'ol', items: [[{ s: 'One sealed bag, tag ' }, { s: 'VW-0412', b: true }], [{ s: 'One mobile phone, tag ' }, { s: 'VW-0419', b: true }], [{ s: 'The sign-out sheet for the 9th' }]] },
            { t: 'quote', r: [{ s: 'I would rather walk into the briefing with paper than with a hunch.' }] },
            { t: 'h2', r: [{ s: 'Next steps' }] },
            { t: 'ul', items: [[{ s: 'Pull the camera footage for the corridor' }], [{ s: 'Interview the night shift' }], [{ s: 'Re-count shelves A and B' }]] },
            { t: 'p', a: 'right', r: [{ s: 'J. Hale, Records' }] },
          ],
        },
      },
    };
  }
  if (kind === 'long') {
    const para = 'The night was quiet until a little after two, when the first of the walk-ins came through the front doors and asked for whoever was in charge. Nobody was, strictly speaking, so the desk took the statement. ';
    return { ...base, doc: { kind: 'text', title: 'Night log', body: Array.from({ length: 34 }, (_, i) => `${i + 1}. ${para.repeat(1 + (i % 3))}`).join('\n\n') } };
  }
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
