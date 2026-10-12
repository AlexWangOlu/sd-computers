// Shapes returned by server/computers/boss.lua (see FRONTEND.md "Business Manager").

export type Page = 'overview' | 'employees' | 'hiring' | 'finances';

export interface Grade {
  level: number;
  name: string;
  isboss?: boolean;
}

/** One society statement line (newest first, time = unix seconds). */
export interface Tx {
  id: string | number;
  title: string;
  amount: number;
  kind: 'deposit' | 'withdraw' | string;
  issuer: string;
  receiver: string;
  message: string;
  time: number;
}

export interface Funds {
  available: boolean;
  balance?: number | null;
  transactions?: Tx[];
  depositFrom?: string[];
  withdrawTo?: string;
  max?: number;
}

export interface Overview {
  job: { name: string; label: string };
  grades: Grade[];
  myGrade: number;
  myCid: string;
  counts: { total: number; online: number; onDuty: number };
  funds: Funds;
}

export interface Employee {
  cid: string;
  name: string;
  grade: number;
  gradeName: string;
  online: boolean;
  onDuty: boolean;
}

export interface Nearby {
  id: number;
  name: string;
}
