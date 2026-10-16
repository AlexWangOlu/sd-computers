import type { MockHandler } from './index';
import type { PaperPage } from '@/os/Paper';
import type { FontKey } from '@/lib/richdoc';

// Printing in the browser: two printers near the mock computer, one of them with a full tray, and
// a submit that only counts what was sent. What a page looks like is src/os/Paper.tsx, which the
// browser opens with #paper (see src/App.tsx).

const printers = [
  { id: 1, label: '前台打印机', distance: 4, waiting: 0, full: false },
  { id: 2, label: '档案室复印机', distance: 18, waiting: 3, full: false },
  { id: 3, label: '简报室打印机', distance: 27, waiting: 25, full: true },
];

const handlers: Record<string, MockHandler> = {
  'print:printers': () => ({ ok: true, data: { enabled: true, printers, maxCopies: 5, pageSeconds: 2.5 } }),
  'print:submit': p => {
    const printer = printers.find(x => x.id === Number(p.printer));
    if (!printer || printer.full) return { ok: false, error: '那台打印机离这台电脑太远。' };
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
  if (kind === 'faded') return { faded: true, title: '交接班' };
  if (kind === 'contract') {
    return {
      ...base,
      signing: { name: 'Jessica Hale' },
      doc: {
        kind: 'document',
        title: '租赁合同',
        rich: {
          v: 1,
          font: font ?? 'classic',
          blocks: [
            { t: 'h1', a: 'center', r: [{ s: '租赁合同' }] },
            { t: 'p', a: 'center', r: [{ s: '格罗夫街 14 号，Davis', z: 'l' }] },
            { t: 'hr' },
            {
              t: 'p',
              a: 'justify',
              r: [
                { s: '本合同由 ' },
                { s: 'Marcus Reyes', b: true },
                { s: '（房东）与 ' },
                { s: 'Jessica Hale', b: true },
                { s: '（租户）签订。租金为 ' },
                { s: '每周 $1,200', c: 'red', b: true },
                { s: '，每周一支付，首周租金在签约时付清。' },
              ],
            },
            { t: 'ol', items: [[{ s: '租户保持房屋整洁。' }], [{ s: '房东在每次到访前提前一周通知。' }], [{ s: '任何一方均可提前两周通知终止本合同。' }]] },
            { t: 'p', r: [{ s: '在办公机器上打印：', z: 's', c: 'grey' }, { s: 'REF 0412-GS', f: 'mono', z: 's', c: 'grey' }] },
            { t: 'p', r: [{ s: '双方签署：', i: true }] },
            { t: 'sign', label: '房东', sig: { name: 'Marcus Reyes', at: now() - 1800, img: mockInk('M. Reyes') } },
            { t: 'sign', label: '租户' },
            { t: 'sign', label: '见证人' },
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
        title: '证物柜审计',
        rich: {
          v: 1,
          font: font ?? 'serif',
          blocks: [
            { t: 'h1', a: 'center', r: [{ s: '证物柜审计' }] },
            { t: 'p', a: 'center', r: [{ s: '米申罗警局', i: true }] },
            { t: 'hr' },
            { t: 'h2', r: [{ s: '概述' }] },
            {
              t: 'p',
              a: 'justify',
              r: [
                { s: 'C 货架的季度清点结果 ' },
                { s: '少了两件', b: true },
                { s: '。两件都属于好麦坞案，都在 9 号被签出，' },
                { s: '没有登记签名', u: true },
                { s: '。收押终端的日志已打印，附在本报告后。' },
              ],
            },
            { t: 'img', src: PHOTO, w: 50, cap: 'C 货架，清点时拍摄' },
            { t: 'h2', r: [{ s: '缺失物品' }] },
            { t: 'ol', items: [[{ s: '一个密封袋，标签 ' }, { s: 'VW-0412', b: true }], [{ s: '一部手机，标签 ' }, { s: 'VW-0419', b: true }], [{ s: '9 号的签出登记表' }]] },
            { t: 'quote', r: [{ s: '我宁愿带着纸进简报室，也不想带着猜测进去。' }] },
            { t: 'h2', r: [{ s: '下一步' }] },
            { t: 'ul', items: [[{ s: '调取走廊的监控录像' }], [{ s: '询问夜班人员' }], [{ s: '重新清点 A、B 货架' }]] },
            { t: 'p', a: 'right', r: [{ s: 'J. Hale，档案科' }] },
          ],
        },
      },
    };
  }
  if (kind === 'long') {
    const para = '夜里一直很平静，直到两点刚过，第一个上门的人推开前门，问负责人是谁。严格来说并没有负责人，于是前台做起了笔录。 ';
    return { ...base, doc: { kind: 'text', title: '夜间日志', body: Array.from({ length: 34 }, (_, i) => `${i + 1}. ${para.repeat(1 + (i % 3))}`).join('\n\n') } };
  }
  if (kind === 'mail') {
    return {
      ...base,
      doc: {
        kind: 'mail',
        title: '回复：证物柜审计',
        letterhead: '邮件',
        subhead: 'j.hale@lsmail.com',
        fields: [
          { label: '发件人', value: 'Marcus Reyes <m.reyes@lsmail.com>' },
          { label: '收件人', value: 'j.hale@lsmail.com, records@lsmail.com' },
          { label: '发送时间', value: '13/10/2026 21:14' },
        ],
        body: 'Jess，\n\nC 货架清点少了两件。两件都是好麦坞案的，都在 9 号被签出，没有登记签名。\n\n能在明早简报前把那个终端的日志调出来吗？我宁愿带着纸进去，也不想带着猜测进去。\n\nMarcus',
      },
    };
  }
  if (kind === 'statement') {
    return {
      ...base,
      doc: {
        kind: 'statement',
        title: '账户对账单',
        letterhead: '银行',
        subhead: '个人账户对账单',
        fields: [
          { label: '账户持有人', value: 'Jessica Hale' },
          { label: '余额', value: '$48,210' },
          { label: '打印时间', value: '13/10/2026 22:02' },
        ],
        table: {
          head: ['日期', '描述', '金额'],
          rows: [
            ['13/10/2026 18:40', '工资 - 洛圣都警察局', '+$2,450'],
            ['13/10/2026 12:05', '24/7 Supermarket', '-$84'],
            ['12/10/2026 22:31', '转账给 Marcus Reyes', '-$500'],
            ['12/10/2026 09:12', 'Los Santos Customs', '-$1,920'],
            ['11/10/2026 17:48', '工资 - 洛圣都警察局', '+$2,450'],
            ['10/10/2026 20:19', 'Fleeca ATM 取款', '-$300'],
          ],
        },
      },
    };
  }
  if (kind === 'logs') {
    const rows: string[][] = [];
    const what = [
      ['success', 'Security', '4624', 'Jessica Hale 已登录。'],
      ['information', 'Application', '1000', '应用程序已启动：邮件。'],
      ['information', 'Mail', '3001', '邮件已从 j.hale@lsmail.com 发送至 records@lsmail.com：证物柜审计'],
      ['failure', 'Security', '4625', '登录失败：PIN 错误。'],
      ['warning', 'Security', '4740', '连续 5 次登录失败后账户被锁定。'],
      ['information', 'Print Spooler', '5001', '已打印“交接班”（2 份）至前台打印机。'],
      ['success', 'Security', '4634', 'Jessica Hale 已注销。'],
    ];
    for (let i = 0; i < 22; i++) {
      const w = what[i % what.length];
      rows.push([`13/10/2026 2${Math.floor(i / 8)}:${String(58 - i * 2).padStart(2, '0')}:1${i % 10}`, ...w]);
    }
    return {
      ...base,
      doc: {
        kind: 'logs',
        title: 'LSPD-MRPD-FD01 的系统日志',
        letterhead: '事件查看器',
        subhead: '米申罗警局前台',
        fields: [
          { label: '电脑', value: 'LSPD-MRPD-FD01' },
          { label: '条目', value: String(rows.length) },
          { label: '打印时间', value: '13/10/2026 22:02' },
        ],
        table: { head: ['时间', '级别', '来源', '事件', '消息'], rows },
      },
    };
  }
  return {
    ...base,
    doc: {
      kind: 'text',
      title: '交接班',
      body: '夜班，10 月 13 日\n\n- 前台打印机墨粉快没了。已经通知库房。\n- 有两个人上门问好麦坞入室案的事。笔录在纸盘里，还没归档。\n- 拘留室摄像头每小时会断一两秒。已向 IT 报备。\n- 14 号车的钥匙在值班指挥官那里。\n\n没有其他要报告的事。咖啡机还是坏的。\n\nJ. Hale',
    },
  };
}

export default handlers;
