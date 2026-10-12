import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { Check, ChevronRight, FilePen, Flag, Inbox, LogOut, MoreHorizontal, Send, ShieldAlert, Smartphone, SquarePen, Trash2, UserPlus, type LucideIcon } from 'lucide-react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { Badge, Button, NavItem } from '@/ui/controls';
import { Flyout, MenuRow, MenuSeparator, Persona } from './parts';
import { confirmSignOut, selectAccount, selectFolder, setAdding, startCompose, useMail } from './store';
import { foldersFor, type Account, type Counts, type Folder } from './types';
import { countText, cx } from './util';

export const FOLDER_ICON: Record<Folder, LucideIcon> = { inbox: Inbox, flagged: Flag, drafts: FilePen, sent: Send, spam: ShieldAlert, bin: Trash2 };

const FOLDER_COUNT: Record<Folder, keyof Counts> = { inbox: 'unread', flagged: 'flagged', drafts: 'drafts', sent: 'sent', spam: 'spam', bin: 'bin' };

/** This computer's folder list (the phone's mail adds Spam). */
const useFolders = (): Folder[] => foldersFor(useOS(s => s.payload?.mail.phone));

export const folderLabel = (f: Folder): string => t(`ui.mail.folder_${f}`);

/** Inbox shows an accent unread badge; every other folder a plain count. */
function folderBadge(f: Folder, c: Counts): ReactNode {
  const n = c[FOLDER_COUNT[f]] ?? 0;
  if (n <= 0) return null;
  if (f === 'inbox') return <Badge>{countText(n)}</Badge>;
  return <span className="text-caption text-t2 tabular-nums">{countText(n)}</span>;
}

/** Left NavigationView: New mail, one expandable section per signed-in address, its folders. */
export default function Sidebar({ rail }: { rail: boolean }) {
  return rail ? <Rail /> : <Pane />;
}

function Pane() {
  const accounts = useMail(s => s.accounts);
  const active = useMail(s => s.active);
  const canAdd = useMail(s => s.canSignIn);
  const phone = useOS(s => s.payload?.mail.phone === true);
  return (
    <aside className="w-[240px] shrink-0 bg-win flex flex-col min-h-0">
      <div className="px-3 pt-3 pb-2">
        <Button variant="accent" icon={<SquarePen size={16} />} onClick={() => startCompose('new')} className="w-full" title={t('ui.mail.new_mail_hint')}>
          {t('ui.mail.new_mail')}
        </Button>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto os-scroll px-2 pb-2">
        {accounts.map(a => (
          <AccountSection key={a.email} account={a} active={a.email === active} />
        ))}
      </nav>
      <div className="px-2 py-2 border-t border-stroke">
        {phone && (
          <div className="flex items-center gap-2 px-2.5 pb-1.5 text-caption text-t2" title={t('ui.mail.phone_synced_hint')}>
            <Smartphone size={14} className="shrink-0" />
            <span className="truncate">{t('ui.mail.phone_synced')}</span>
          </div>
        )}
        <NavItem
          icon={<UserPlus size={16} className={cx(!canAdd && 'opacity-50')} />}
          label={<span className={cx(!canAdd && 'text-t3')}>{t('ui.mail.add_account')}</span>}
          onClick={() => setAdding(true)}
        />
      </div>
    </aside>
  );
}

function AccountSection({ account, active }: { account: Account; active: boolean }) {
  const folders = useFolders();
  const folder = useMail(s => s.folder);
  const [menu, setMenu] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const unread = account.counts.unread;

  return (
    <div className="mb-1">
      <div
        role="button"
        tabIndex={0}
        onClick={() => selectAccount(account.email)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectAccount(account.email);
          }
        }}
        title={account.email}
        className={cx('group relative flex items-center gap-2 h-12 pl-1.5 pr-1 rounded-ctl cursor-default transition-colors duration-150 outline-none hover:bg-subtle focus-visible:ring-2 focus-visible:ring-[var(--accent-fill)]', menu && 'bg-subtle')}
      >
        <ChevronRight size={14} className={cx('shrink-0 text-t2 transition-transform duration-150', active && 'rotate-90')} />
        <Persona name={account.name} email={account.email} size={28} />
        <div className="flex-1 min-w-0 leading-tight">
          <div className={cx('text-body truncate', active ? 'text-t1 font-semibold' : 'text-t1')}>{account.name}</div>
          <div className="text-caption text-t2 truncate">{account.email}</div>
        </div>
        {!active && unread > 0 && <span className="text-caption font-semibold text-accent-text tabular-nums group-hover:hidden">{countText(unread)}</span>}
        <button
          ref={moreRef}
          type="button"
          title={t('ui.mail.account_options')}
          aria-label={t('ui.mail.account_options')}
          onClick={e => {
            e.stopPropagation();
            setMenu(m => !m);
          }}
          className={cx(
            'w-7 h-7 shrink-0 flex items-center justify-center rounded-ctl text-t2 hover:text-t1 hover:bg-subtle',
            menu ? 'flex' : 'hidden group-hover:flex group-focus-within:flex',
          )}
        >
          <MoreHorizontal size={16} />
        </button>
        {menu && <AccountMenu email={account.email} anchor={moreRef} onClose={() => setMenu(false)} className="left-0 right-0 top-11" />}
      </div>
      {active && (
        <div className="pl-5 mt-0.5 flex flex-col gap-0.5 page-in">
          {folders.map(f => {
            const Icon = FOLDER_ICON[f];
            return <NavItem key={f} icon={<Icon size={16} />} label={folderLabel(f)} selected={folder === f} onClick={() => selectFolder(f)} badge={folderBadge(f, account.counts)} />;
          })}
        </div>
      )}
    </div>
  );
}

/** Add account + Sign out of `email`; in the rail it also lists every account to switch to. */
function AccountMenu({ email, anchor, onClose, className, withAccounts }: { email: string; anchor: RefObject<HTMLElement | null>; onClose: () => void; className: string; withAccounts?: boolean }) {
  const accounts = useMail(s => s.accounts);
  return (
    <Flyout anchor={anchor} onClose={onClose} className={className}>
      {withAccounts && (
        <>
          {accounts.map(a => (
            <MenuRow
              key={a.email}
              icon={<Persona name={a.name} email={a.email} size={20} />}
              label={
                <span className="block leading-tight py-0.5">
                  <span className="block truncate">{a.name}</span>
                  <span className="block text-caption text-t2 truncate">{a.email}</span>
                </span>
              }
              trailing={a.email === email ? <Check size={14} className="text-accent-text" /> : a.counts.unread > 0 ? <Badge>{countText(a.counts.unread)}</Badge> : null}
              onClick={() => {
                onClose();
                selectAccount(a.email);
              }}
            />
          ))}
          <MenuSeparator />
        </>
      )}
      <MenuRow
        icon={<UserPlus size={16} />}
        label={t('ui.mail.add_account')}
        onClick={() => {
          onClose();
          setAdding(true);
        }}
      />
      <MenuRow
        icon={<LogOut size={16} />}
        label={t('ui.mail.sign_out_this')}
        onClick={() => {
          onClose();
          confirmSignOut(email);
        }}
      />
    </Flyout>
  );
}

/** Icons-only pane for narrow windows. */
function Rail() {
  const accounts = useMail(s => s.accounts);
  const active = useMail(s => s.active);
  const folder = useMail(s => s.folder);
  const folders = useFolders();
  const [menu, setMenu] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const acct = accounts.find(a => a.email === active) ?? accounts[0];
  if (!acct) return null;
  const othersUnread = accounts.some(a => a.email !== acct.email && a.counts.unread > 0);

  return (
    <aside className="w-[52px] shrink-0 bg-win flex flex-col items-center gap-1 pt-3 pb-2 min-h-0">
      <button
        type="button"
        title={t('ui.mail.new_mail')}
        aria-label={t('ui.mail.new_mail')}
        onClick={() => startCompose('new')}
        className="w-9 h-9 flex items-center justify-center rounded-ctl bg-accent hover:bg-accent-hover text-accent-on transition-colors duration-150"
      >
        <SquarePen size={16} />
      </button>
      <div className="relative mt-1">
        <button
          ref={avatarRef}
          type="button"
          title={`${acct.name}\n${acct.email}`}
          onClick={() => setMenu(m => !m)}
          className={cx('relative w-10 h-10 flex items-center justify-center rounded-ctl hover:bg-subtle', menu && 'bg-subtle')}
        >
          <Persona name={acct.name} email={acct.email} size={28} />
          {othersUnread && <span className="absolute right-1 top-1 w-2 h-2 rounded-full bg-accent ring-2 ring-[var(--win-bg)]" />}
        </button>
        {menu && <AccountMenu email={acct.email} anchor={avatarRef} onClose={() => setMenu(false)} className="left-0 top-11 w-64" withAccounts />}
      </div>
      <div className="w-6 h-px bg-stroke my-1" />
      {folders.map(f => {
        const Icon = FOLDER_ICON[f];
        const sel = folder === f;
        const unread = f === 'inbox' ? acct.counts.unread : 0;
        return (
          <button
            key={f}
            type="button"
            title={folderLabel(f)}
            aria-label={folderLabel(f)}
            onClick={() => selectFolder(f)}
            className={cx('relative w-10 h-9 flex items-center justify-center rounded-ctl text-t1 transition-colors duration-150', sel ? 'bg-subtle' : 'hover:bg-subtle')}
          >
            {sel && <span className="absolute left-0 top-[10px] w-[3px] h-4 rounded-full bg-accent pill-in" />}
            <Icon size={16} />
            {unread > 0 && (
              <span className="absolute -top-0.5 right-0 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-on text-[10px] font-semibold leading-4 text-center">{countText(unread)}</span>
            )}
          </button>
        );
      })}
    </aside>
  );
}
