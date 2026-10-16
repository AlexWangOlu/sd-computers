import { useState, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { fmtStamp } from '@/lib/format';
import type { Entry } from './types';
import { L, cx, dataRows, detailLevel, entryLogName, eventXml, keywordsOf, systemRows, taskCategory, userOf } from './model';

type Tab = 'general' | 'details';

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'relative h-[24px] px-3 -mb-px rounded-t-[4px] border text-[12px]',
        active ? 'bg-layer border-stroke-strong border-b-transparent text-t1 z-[1]' : 'bg-win border-transparent text-t2 hover:text-t1',
      )}
    >
      {children}
    </button>
  );
}

function Fact({ k, children, span }: { k: string; children: ReactNode; span?: boolean }) {
  return (
    <>
      <div className="text-t2 whitespace-nowrap">{k}:</div>
      <div className={cx('min-w-0 truncate select-text', span && 'col-span-3')} title={typeof children === 'string' ? children : undefined}>
        {children}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-1">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 h-[20px] text-t1 font-semibold hover:text-accent-text">
        <span className="w-3 h-3 flex items-center justify-center border border-stroke-strong rounded-[2px]">{open ? <Minus size={9} /> : <Plus size={9} />}</span>
        {title}
      </button>
      {open && <div className="pl-6 pt-0.5">{children}</div>}
    </div>
  );
}

/**
 * An event's General / Details tabs - the bottom preview pane and the Event Properties window.
 * General: the message box + Windows' two-column fact grid. Details: Friendly View (System +
 * EventData key/values) or XML View.
 */
export function EventDetails({ entry, hostname, clock24, tall }: { entry: Entry; hostname: string; clock24: boolean; tall?: boolean }) {
  const [tab, setTab] = useState<Tab>('general');
  const [view, setView] = useState<'friendly' | 'xml'>('friendly');
  const rows = dataRows(entry.data);

  return (
    <div className="h-full flex flex-col min-h-0 text-[12px]">
      <div className="flex items-end gap-0.5 px-2 pt-1.5 border-b border-stroke-strong shrink-0 bg-win">
        <TabButton active={tab === 'general'} onClick={() => setTab('general')}>{L('tab_general')}</TabButton>
        <TabButton active={tab === 'details'} onClick={() => setTab('details')}>{L('tab_details')}</TabButton>
      </div>

      <div className="flex-1 min-h-0 overflow-auto os-scroll bg-layer">
        {tab === 'general' ? (
          <div className={cx('h-full flex flex-col gap-2.5 p-2.5', tall ? 'min-h-[300px]' : 'min-h-[196px]')}>
            <div className="flex-1 min-h-[44px] overflow-auto os-scroll rounded-[2px] border border-stroke-strong bg-[var(--input-focus)] px-2 py-1.5 whitespace-pre-wrap break-words select-text text-t1">
              {entry.message}
            </div>
            <div className="shrink-0 grid gap-x-3 gap-y-[3px] grid-cols-[max-content_minmax(0,1fr)_max-content_minmax(0,1fr)]">
              <Fact k={L('d_log_name')} span>{entryLogName(entry)}</Fact>
              <Fact k={L('d_source')}>{entry.source}</Fact>
              <Fact k={L('d_logged')}>{fmtStamp(entry.ts, clock24)}</Fact>
              <Fact k={L('d_event_id')}>{String(entry.event_id)}</Fact>
              <Fact k={L('d_task')}>{taskCategory(entry)}</Fact>
              <Fact k={L('d_level')}>{detailLevel(entry)}</Fact>
              <Fact k={L('d_keywords')}>{keywordsOf(entry)}</Fact>
              <Fact k={L('d_user')}>{userOf(entry)}</Fact>
              <Fact k={L('d_computer')}>{hostname}</Fact>
              <Fact k={L('d_opcode')} span>{L('opcode_info')}</Fact>
              <Fact k={L('d_more_info')} span>
                <span className="text-accent-text underline cursor-default">{L('online_help')}</span>
              </Fact>
            </div>
          </div>
        ) : (
          <div className="p-2.5">
            <div className="flex items-center gap-5 mb-2.5">
              {(['friendly', 'xml'] as const).map(v => (
                <label key={v} className="inline-flex items-center gap-1.5 cursor-default">
                  <input type="radio" checked={view === v} onChange={() => setView(v)} className="accent-[var(--accent-fill)]" />
                  {L(v === 'friendly' ? 'friendly_view' : 'xml_view')}
                </label>
              ))}
            </div>
            {view === 'friendly' ? (
              <div className="rounded-[2px] border border-stroke-strong bg-[var(--input-focus)] p-2">
                <Section title={L('sec_system')}>
                  <div className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-[2px]">
                    {systemRows(entry, hostname).map(r => (
                      <div key={r.k} className="contents">
                        <div className="text-t2">{r.k}</div>
                        <div className="select-text break-all">{r.v}</div>
                      </div>
                    ))}
                  </div>
                </Section>
                <Section title={L('sec_eventdata')}>
                  {rows.length ? (
                    <div className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-[2px]">
                      {rows.map(r => (
                        <div key={r.k} className="contents">
                          <div className="text-t2">{r.k}</div>
                          {r.block ? (
                            <pre className="font-mono text-[11px] leading-[15px] whitespace-pre-wrap break-all select-text m-0">{r.v}</pre>
                          ) : (
                            <div className="select-text break-all">{r.v}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-t3">{L('no_event_data')}</div>
                  )}
                </Section>
              </div>
            ) : (
              <pre className="rounded-[2px] border border-stroke-strong bg-[var(--input-focus)] p-2 m-0 font-mono text-[11px] leading-[15px] whitespace-pre-wrap break-all select-text text-t1">
                {eventXml(entry, hostname)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
