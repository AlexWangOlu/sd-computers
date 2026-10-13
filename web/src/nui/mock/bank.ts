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
const EMPLOYER = 'Los Santos Police Department';
const LANDLORD = 'Eclipse Towers Management';

// [seconds ago, title, amount, kind, the other party, message] - newest first, like the server.
const SEED: [number, string, number, Tx['kind'], string, string][] = [
  [1.5 * H, 'Card payment', 62, 'withdraw', 'Ron Petroleum', 'Fuel - pump 4, Strawberry Ave'],
  [5 * H, 'ATM withdrawal', 200, 'withdraw', 'ATM - Legion Square', 'Cash withdrawal'],
  [0.9 * D, 'Card payment', 38, 'withdraw', '24/7 Supermarket', 'Groceries'],
  [1.3 * D, 'Transfer received', 450, 'deposit', 'Marcus Delgado', 'Concert tickets - thanks!'],
  [1.8 * D, 'Card payment', 320, 'withdraw', 'Binco Clothing', 'Jacket and boots'],
  [2.2 * D, 'Salary', 3200, 'deposit', EMPLOYER, 'Weekly pay - Chief'],
  [2.9 * D, 'Card payment', 54, 'withdraw', 'LTD Gasoline', 'Fuel'],
  [3.4 * D, 'ATM withdrawal', 100, 'withdraw', 'ATM - Vespucci Boulevard', 'Cash withdrawal'],
  [3.9 * D, 'Phone plan', 85, 'withdraw', 'Whiz Wireless', 'Monthly plan'],
  [4.6 * D, 'Card payment', 146, 'withdraw', 'Los Santos Customs', 'Brake pads and an oil change'],
  [5.1 * D, 'Transfer sent', 250, 'withdraw', 'Priya Nair', 'Dinner split'],
  [5.7 * D, 'Cash deposit', 600, 'deposit', 'ATM - Legion Square', ''],
  [6.3 * D, 'Card payment', 71, 'withdraw', 'Ron Petroleum', 'Fuel'],
  [7.0 * D, 'Rent', 1450, 'withdraw', LANDLORD, 'Apartment 31 - weekly rent'],
  [7.4 * D, 'Card payment', 29, 'withdraw', 'Bean Machine', 'Coffee and bagels'],
  [8.1 * D, 'Card payment', 210, 'withdraw', 'Suburban', 'Jeans and two shirts'],
  [9.2 * D, 'Salary', 3200, 'deposit', EMPLOYER, 'Weekly pay - Chief'],
  [9.6 * D, 'Parking fine', 180, 'withdraw', 'City of Los Santos', 'Citation #88214'],
  [10.3 * D, 'ATM withdrawal', 300, 'withdraw', 'ATM - Del Perro Pier', 'Cash withdrawal'],
  [10.9 * D, 'Card payment', 47, 'withdraw', '24/7 Supermarket', 'Groceries'],
  [11.5 * D, 'Vehicle insurance', 220, 'withdraw', 'Mors Mutual Insurance', 'Monthly cover'],
  [12.2 * D, 'Transfer received', 120, 'deposit', 'Tom Becker', 'Poker night'],
  [12.8 * D, 'Card payment', 58, 'withdraw', 'LTD Gasoline', 'Fuel'],
  [13.3 * D, 'Card payment', 95, 'withdraw', 'Pillbox Hill Medical Center', ''],
  [13.8 * D, 'Rent', 1450, 'withdraw', LANDLORD, 'Apartment 31 - weekly rent'],
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
