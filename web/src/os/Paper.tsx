import { useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { fetchNui, isEnvBrowser } from '@/nui/bridge';
import { useExitFx } from '@/hooks/useExitFx';
import { t } from '@/i18n';

// A printed page, in the hand: what using a printout (the item) opens. A sheet of paper over the
// game, with no computer open - the server looked the page up and client Lua sent it here
// (client/computers/paper.lua). It belongs to no desktop style: paper looks like paper. What kind
// of page it is only changes the stock it is on - a typed page is plain, a system log comes on
// green-bar listing paper with its sprocket holes still on. Its look is src/styles/paper.css.

/** A page as it is kept (server/computers/printing.lua > PrintDoc). */
export interface PaperDoc {
  kind: string;
  title: string;
  letterhead?: string;
  subhead?: string;
  fields?: { label: string; value: string }[];
  body?: string;
  table?: { head: string[]; rows: string[][] };
  image?: string;
  footer?: string;
}

/** What the item opened: the page, and who printed it, from which machine and when. */
export interface PaperPage {
  id?: number;
  doc?: PaperDoc;
  by?: string | null;
  from?: string | null;
  /** unix seconds */
  at?: number;
  /** thrown away since (configs/shared/printers.lua > KeepDays): there is nothing left to read */
  faded?: boolean;
  title?: string | null;
}

/** An empty Lua table can arrive as {} rather than []: every list on a page is made a list here. */
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const two = (n: number): string => String(n).padStart(2, '0');
const stamp = (at?: number): string => {
  if (!at) return '';
  const d = new Date(at * 1000);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
};

export default function Paper({ page, onClose }: { page: PaperPage; onClose: () => void }) {
  const exitRef = useExitFx('fade-out');

  const close = useCallback(() => {
    if (!isEnvBrowser()) void fetchNui('computers:paper:close');
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Backspace') return;
      e.preventDefault();
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const doc = page.faded ? undefined : page.doc;
  const fields = list<{ label: string; value: string }>(doc?.fields);
  const head = list<string>(doc?.table?.head);
  const rows = list<string[]>(doc?.table?.rows);
  const printed = [page.by && t('ui.print.page_by', page.by), page.from && t('ui.print.page_from', page.from)].filter(Boolean).join(' ');

  return (
    <div ref={exitRef} className="paper-root mirror-block fade-in" onMouseDown={e => e.target === e.currentTarget && close()}>
      <button type="button" className="paper-close" aria-label={t('ui.print.page_close')} title={t('ui.print.page_close')} onClick={close}>
        <X size={18} />
      </button>

      <div className="paper-scroll" onMouseDown={e => e.target === e.currentTarget && close()}>
        {doc ? (
          <article className={`paper is-${doc.kind.replace(/[^a-z0-9-]/gi, '')}`}>
            {doc.letterhead && (
              <header className="paper-head">
                <div className="paper-letterhead">{doc.letterhead}</div>
                {doc.subhead && <div className="paper-subhead">{doc.subhead}</div>}
              </header>
            )}

            <h1 className="paper-title">{doc.title}</h1>

            {fields.length > 0 && (
              <dl className="paper-fields">
                {fields.map((f, i) => (
                  <div key={i} className="paper-field">
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {doc.image && <img className="paper-image" src={doc.image} alt="" draggable={false} />}
            {doc.body && <div className="paper-body">{doc.body}</div>}

            {head.length > 0 && rows.length > 0 && (
              <table className="paper-table">
                <thead>
                  <tr>
                    {head.map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      {head.map((_, c) => (
                        <td key={c}>{list<string>(r)[c] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {doc.footer && <div className="paper-note">{doc.footer}</div>}

            <footer className="paper-foot">
              <span>{printed}</span>
              <span>
                {stamp(page.at)}
                {page.id ? ` · ${t('ui.print.page_ref', String(page.id).padStart(5, '0'))}` : ''}
              </span>
            </footer>
          </article>
        ) : (
          <article className="paper is-faded">
            <h1 className="paper-title">{page.title || t('ui.print.faded_title')}</h1>
            <div className="paper-body">{t('ui.print.faded_body')}</div>
          </article>
        )}
      </div>

      <div className="paper-hint">{t('ui.print.page_hint')}</div>
    </div>
  );
}
