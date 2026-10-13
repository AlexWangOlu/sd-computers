// Shapes returned by server/computers/bank.lua (bank:overview).

/** Where the statement came from: the phone's banking history, the banking resource, or nowhere. */
export type Source = 'phone' | 'banking' | 'none';

/**
 * One statement line (newest first). The server has already normalised it: `amount` is never
 * negative and `kind` says which way the money went, relative to the bank account.
 */
export interface Tx {
  id: string;
  title: string;
  amount: number;
  kind: 'deposit' | 'withdraw';
  /** Who it came from ('' when the source does not say). */
  issuer: string;
  /** Who it went to ('' when the source does not say). */
  receiver: string;
  message: string;
  /** Unix seconds. */
  time: number;
}

export interface Overview {
  /** The account holder (the character signed in). */
  name: string;
  bank: number;
  cash: number;
  /** 'none' = this server keeps no statement the computer can read: balances only. */
  source: Source;
  transactions: Tx[];
}

/** The statement's direction filter. */
export type Filter = 'all' | 'in' | 'out';
