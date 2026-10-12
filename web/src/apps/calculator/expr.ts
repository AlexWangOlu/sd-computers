import { t } from '@/i18n';
import { formatDec } from './decimal';
import type { CalcError, Expr, Op, Term } from './engine';

// Turns the engine's structured expression line into display text.

export const OP_SYMBOL: Record<Op, string> = { add: '+', sub: '−', mul: '×', div: '÷' };

export const termText = (term: Term): string =>
  'v' in term ? formatDec(term.v) : t(`ui.calculator.fn_${term.fn}`, termText(term.of));

export function exprText(e: Expr | null): string {
  if (!e) return '';
  const parts: string[] = [];
  if (e.left) parts.push(termText(e.left));
  if (e.op) parts.push(OP_SYMBOL[e.op]);
  if (e.right) parts.push(termText(e.right));
  if (e.eq) parts.push('=');
  return parts.join(' ');
}

export const errorText = (err: CalcError): string => t(`ui.calculator.err_${err}`);
