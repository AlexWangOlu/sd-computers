import type { Overview, Source, Tx } from '@/apps/bank/types';
import type { MockHandler } from './index';
import { ok } from './index';

// Browser mock for the Bank (server/computers/bank.lua): Jessica Hale's own account, with two
// weeks of the statement a police chief would have. Rows are already in the server's normalised
// shape: newest first, `amount` positive, the direction in `kind`. The Bank only reads, so
// nothing here changes during a dev session.

/**
 * Which statement source to imitate. 'banking' rows carry both parties and a message. 'phone' is
 * the same statement as sd-phone would log it: no messages, so the page drops that column.
 * 'none' is a server with no statement at all: the balances and a note.
 */
const SOURCE = 'banking' as Source;

const HOLDER = 'Jessica Hale';
const BANK = 27840;
const CASH = 635;

const H = 3600;
const D = 86400;
const EMPLOYER = '洛圣都警察局';
const LANDLORD = 'Eclipse Towers 物业';

// [seconds ago, title, amount, kind, the other party, message] - newest first, like the server.
const SEED: [number, string, number, Tx['kind'], string, string][] = [
  [1.5 * H, '刷卡消费', 62, 'withdraw', 'Ron Petroleum', '燃油 - 斯卓贝里大道 4 号加油机'],
  [5 * H, 'ATM 取现', 200, 'withdraw', 'ATM - 军团广场', '现金取款'],
  [0.9 * D, '刷卡消费', 38, 'withdraw', '24/7 Supermarket', '日用品'],
  [1.3 * D, '收到转账', 450, 'deposit', 'Marcus Delgado', '演唱会门票 - 谢谢！'],
  [1.8 * D, '刷卡消费', 320, 'withdraw', 'Binco Clothing', '夹克和靴子'],
  [2.2 * D, '工资', 3200, 'deposit', EMPLOYER, '每周薪金 - 局长'],
  [2.9 * D, '刷卡消费', 54, 'withdraw', 'LTD Gasoline', '燃油'],
  [3.4 * D, 'ATM 取现', 100, 'withdraw', 'ATM - 维斯普奇大道', '现金取款'],
  [3.9 * D, '手机资费', 85, 'withdraw', 'Whiz Wireless', '包月套餐'],
  [4.6 * D, '刷卡消费', 146, 'withdraw', 'Los Santos Customs', '刹车片和换机油'],
  [5.1 * D, '转出', 250, 'withdraw', 'Priya Nair', '饭钱 AA'],
  [5.7 * D, '现金存入', 600, 'deposit', 'ATM - 军团广场', ''],
  [6.3 * D, '刷卡消费', 71, 'withdraw', 'Ron Petroleum', '燃油'],
  [7.0 * D, '房租', 1450, 'withdraw', LANDLORD, '31 号公寓 - 周租'],
  [7.4 * D, '刷卡消费', 29, 'withdraw', 'Bean Machine', '咖啡和贝果'],
  [8.1 * D, '刷卡消费', 210, 'withdraw', 'Suburban', '牛仔裤和两件衬衫'],
  [9.2 * D, '工资', 3200, 'deposit', EMPLOYER, '每周薪金 - 局长'],
  [9.6 * D, '停车罚款', 180, 'withdraw', '洛圣都市', '罚单 #88214'],
  [10.3 * D, 'ATM 取现', 300, 'withdraw', 'ATM - 德尔佩罗码头', '现金取款'],
  [10.9 * D, '刷卡消费', 47, 'withdraw', '24/7 Supermarket', '日用品'],
  [11.5 * D, '车险', 220, 'withdraw', 'Mors Mutual Insurance', '月度保费'],
  [12.2 * D, '收到转账', 120, 'deposit', 'Tom Becker', '牌局'],
  [12.8 * D, '刷卡消费', 58, 'withdraw', 'LTD Gasoline', '燃油'],
  [13.3 * D, '刷卡消费', 95, 'withdraw', '圆堡山医疗中心', ''],
  [13.8 * D, '房租', 1450, 'withdraw', LANDLORD, '31 号公寓 - 周租'],
];

const loadedAt = Math.floor(Date.now() / 1000);

const statement: Tx[] = SEED.map(([ago, title, amount, kind, other, message], i) => ({
  id: `tx-${SEED.length - i}`,
  title,
  amount,
  kind,
  issuer: kind === 'deposit' ? other : HOLDER,
  receiver: kind === 'deposit' ? HOLDER : other,
  message: SOURCE === 'phone' ? '' : message,
  time: loadedAt - Math.round(ago),
}));

const handlers: Record<string, MockHandler> = {
  'bank:overview': () =>
    ok<Overview>({
      name: HOLDER,
      bank: BANK,
      cash: CASH,
      source: SOURCE,
      transactions: SOURCE === 'none' ? [] : statement.map(tx => ({ ...tx })),
    }),
};

export default handlers;
