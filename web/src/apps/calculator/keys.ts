import type { Action } from './engine';

/** One keypad key: its engine action and how it looks. */
export interface KeyDef {
  id: string;
  label: string;
  /** i18n key (under ui.calculator.key_) for the tooltip; digits have none. */
  title?: string;
  kind: 'num' | 'op' | 'eq';
  action: Action;
}

const digit = (d: string): KeyDef => ({ id: d, label: d, kind: 'num', action: { type: 'digit', d } });

/** The Standard keypad, row by row, exactly as Windows lays it out (4 x 6). */
export const KEYPAD: KeyDef[] = [
  { id: 'percent', label: '%', title: 'percent', kind: 'op', action: { type: 'percent' } },
  { id: 'ce', label: 'CE', title: 'ce', kind: 'op', action: { type: 'ce' } },
  { id: 'c', label: 'C', title: 'c', kind: 'op', action: { type: 'c' } },
  { id: 'back', label: '', title: 'back', kind: 'op', action: { type: 'back' } },

  { id: 'recip', label: '⅟x', title: 'recip', kind: 'op', action: { type: 'fn', fn: 'recip' } },
  { id: 'sqr', label: 'x²', title: 'sqr', kind: 'op', action: { type: 'fn', fn: 'sqr' } },
  { id: 'sqrt', label: '²√x', title: 'sqrt', kind: 'op', action: { type: 'fn', fn: 'sqrt' } },
  { id: 'div', label: '÷', title: 'div', kind: 'op', action: { type: 'op', op: 'div' } },

  digit('7'),
  digit('8'),
  digit('9'),
  { id: 'mul', label: '×', title: 'mul', kind: 'op', action: { type: 'op', op: 'mul' } },

  digit('4'),
  digit('5'),
  digit('6'),
  { id: 'sub', label: '−', title: 'sub', kind: 'op', action: { type: 'op', op: 'sub' } },

  digit('1'),
  digit('2'),
  digit('3'),
  { id: 'add', label: '+', title: 'add', kind: 'op', action: { type: 'op', op: 'add' } },

  { id: 'negate', label: '+/−', title: 'negate', kind: 'num', action: { type: 'fn', fn: 'negate' } },
  digit('0'),
  { id: 'dot', label: '.', title: 'dot', kind: 'num', action: { type: 'dot' } },
  { id: 'eq', label: '=', title: 'eq', kind: 'eq', action: { type: 'eq' } },
];

export const KEY_BY_ID: Record<string, KeyDef> = Object.fromEntries(KEYPAD.map(k => [k.id, k]));

/** Keys that still work while an error is shown. */
export const UNLOCKED = new Set(['c', 'ce']);

/** What a physical key press means: a keypad key id, a memory key, or the history toggle. */
export type KeyHit = { key: string } | { mem: 'mc' | 'mr' | 'mplus' | 'mminus' | 'ms' } | { history: true };

/** Windows Calculator's keyboard map (Standard mode). */
export function mapKey(e: KeyboardEvent): KeyHit | null {
  if (e.ctrlKey || e.metaKey) {
    if (e.altKey || e.shiftKey) return null;
    switch (e.key.toLowerCase()) {
      case 'm':
        return { mem: 'ms' };
      case 'r':
        return { mem: 'mr' };
      case 'p':
        return { mem: 'mplus' };
      case 'q':
        return { mem: 'mminus' };
      case 'l':
        return { mem: 'mc' };
      case 'h':
        return { history: true };
      default:
        return null;
    }
  }
  if (e.altKey) return null;
  if (/^[0-9]$/.test(e.key)) return { key: e.key };
  switch (e.key) {
    case '.':
    case ',':
      return { key: 'dot' };
    case '+':
      return { key: 'add' };
    case '-':
      return { key: 'sub' };
    case '*':
      return { key: 'mul' };
    case '/':
      return { key: 'div' };
    case 'Enter':
    case '=':
      return { key: 'eq' };
    case 'Escape':
      return { key: 'c' };
    case 'Delete':
      return { key: 'ce' };
    case 'Backspace':
      return { key: 'back' };
    case '%':
      return { key: 'percent' };
    case 'r':
    case 'R':
      return { key: 'recip' };
    case 'q':
    case 'Q':
      return { key: 'sqr' };
    case '@':
      return { key: 'sqrt' };
    case 'F9':
      return { key: 'negate' };
    default:
      return null;
  }
}
