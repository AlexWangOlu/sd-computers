import type { ReactNode } from 'react';
import { t } from '@/i18n';

/** Notepad's bottom bar: caret position, character count, zoom, line endings, encoding. */
export default function StatusBar({ ln, col, chars, selected, zoom, busy }: { ln: number; col: number; chars: number; selected: number; zoom: number; busy: boolean }) {
  const count = selected > 0
    ? t('ui.notepad.status_chars_sel', selected.toLocaleString('en-US'), chars.toLocaleString('en-US'))
    : t(chars === 1 ? 'ui.notepad.status_char' : 'ui.notepad.status_chars', chars.toLocaleString('en-US'));
  return (
    <div className="shrink-0 h-8 flex items-center bg-win border-t border-stroke text-caption text-t1 select-none overflow-hidden">
      <Cell grow>{busy ? t('ui.notepad.saving') : ''}</Cell>
      <Cell width={128}>{t('ui.notepad.status_pos', ln, col)}</Cell>
      <Cell width={150}>{count}</Cell>
      <Cell width={64}>{t('ui.notepad.status_zoom', zoom)}</Cell>
      <Cell width={124}>{t('ui.notepad.status_eol')}</Cell>
      <Cell width={84}>{t('ui.notepad.status_encoding')}</Cell>
    </div>
  );
}

function Cell({ children, width, grow }: { children: ReactNode; width?: number; grow?: boolean }) {
  return (
    <div
      className={`h-full flex items-center px-3 truncate ${grow ? 'flex-1 min-w-0 text-t2' : 'shrink-0 border-l border-stroke'}`}
      style={width ? { width } : undefined}
    >
      {children}
    </div>
  );
}
