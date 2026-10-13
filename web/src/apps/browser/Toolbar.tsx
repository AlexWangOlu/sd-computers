import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowLeft, ArrowRight, House, RotateCw } from 'lucide-react';
import { t } from '@/i18n';
import { IconButton, TextInput } from '@/ui/controls';
import type { Site } from './types';
import { cx } from './model';
import { Monogram, openHandlers, type OpenFn } from './parts';
import { KindIcon, type TabInfo } from './TabStrip';

/**
 * The address bar. It shows where the tab is; focusing it selects the lot, so typing replaces it.
 * Enter goes there, Escape puts the address back. What is typed never leaves the app: the caller
 * looks it up among the network's sites.
 */
function AddressBar({ address, kind, disabled, inputRef, onGo }: { address: string; kind: TabInfo['kind']; disabled: boolean; inputRef: RefObject<HTMLInputElement | null>; onGo: (raw: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  // The press that focuses the field also puts the caret where it landed, undoing the select-all:
  // that one click selects everything again on its way up (unless it dragged out a selection).
  const focusing = useRef(false);

  // The tab went somewhere (a link, Back, another tab): whatever was half-typed is stale.
  useEffect(() => setDraft(null), [address]);

  return (
    <form
      className="relative flex-1 min-w-0"
      onSubmit={e => {
        e.preventDefault();
        const raw = draft ?? address;
        setDraft(null);
        inputRef.current?.blur();
        onGo(raw);
      }}
    >
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t3 pointer-events-none">
        <KindIcon kind={kind} />
      </span>
      <TextInput
        ref={inputRef}
        value={draft ?? address}
        disabled={disabled}
        maxLength={200}
        autoComplete="off"
        placeholder={t('ui.browser.address_hint')}
        aria-label={t('ui.browser.address')}
        className="pl-8"
        onChange={e => setDraft(e.target.value)}
        onMouseDown={e => {
          focusing.current = document.activeElement !== e.currentTarget;
        }}
        onFocus={e => e.currentTarget.select()}
        onMouseUp={e => {
          if (!focusing.current) return;
          focusing.current = false;
          const el = e.currentTarget;
          if (el.selectionStart === el.selectionEnd) el.select();
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={e => {
          if (e.key !== 'Escape') return;
          e.stopPropagation();
          setDraft(null);
          e.currentTarget.blur();
        }}
      />
    </form>
  );
}

/** Back, Forward, Reload, Home and the address bar. */
export default function Toolbar({
  address,
  kind,
  ready,
  canBack,
  canForward,
  inputRef,
  onBack,
  onForward,
  onReload,
  onHome,
  onGo,
}: {
  address: string;
  kind: TabInfo['kind'];
  /** false until the network has loaded: there is nowhere to go yet. */
  ready: boolean;
  canBack: boolean;
  canForward: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onHome: () => void;
  onGo: (raw: string) => void;
}) {
  return (
    <div className="shrink-0 flex items-center gap-1 px-2 pb-2">
      <IconButton title={t('ui.browser.back')} disabled={!canBack} onClick={onBack}>
        <ArrowLeft size={16} />
      </IconButton>
      <IconButton title={t('ui.browser.forward')} disabled={!canForward} onClick={onForward}>
        <ArrowRight size={16} />
      </IconButton>
      <IconButton title={t('ui.browser.reload')} onClick={onReload}>
        <RotateCw size={16} />
      </IconButton>
      <IconButton title={t('ui.browser.home')} disabled={!ready} onClick={onHome}>
        <House size={16} />
      </IconButton>
      <div className="w-1 shrink-0" />
      <AddressBar address={address} kind={kind} disabled={!ready} inputRef={inputRef} onGo={onGo} />
    </div>
  );
}

/**
 * The bookmarked sites, in the config's order. One row and no more: a bookmark that does not fit
 * wraps onto a second line that is clipped away, so none is ever cut in half - and every one of
 * them is on the start page as well.
 */
export function BookmarksBar({ sites, current, onOpen }: { sites: Site[]; current: string; onOpen: OpenFn }) {
  return (
    <div className="shrink-0 h-8 px-2 mb-1 flex flex-wrap gap-x-1 overflow-hidden" role="navigation" aria-label={t('ui.browser.bookmarks')}>
      {sites.map(s => (
        <button
          key={s.address}
          type="button"
          title={s.address}
          {...openHandlers(newTab => onOpen(s.address, newTab))}
          className={cx(
            'h-7 mb-1 max-w-[200px] flex items-center gap-2 px-2 rounded-ctl text-caption text-t1 hover:bg-subtle active:bg-control-press',
            s.address === current && 'bg-subtle',
          )}
        >
          <Monogram title={s.title} size={18} />
          <span className="truncate">{s.title}</span>
        </button>
      ))}
    </div>
  );
}
