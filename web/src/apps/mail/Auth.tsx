import { useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { AppIcon } from '@/os/icons';
import { Button, IconButton, InfoBar, Spinner, TextInput } from '@/ui/controls';
import { Pivot } from './parts';
import { signIn, signUp, useMail } from './store';
import { cx } from './util';

type Tab = 'signin' | 'create';

/**
 * The account card: "Sign in" to an existing @domain address or "Create account". Shown full-window
 * when no address is signed in yet, and as the in-window "Add account" sheet (with onCancel).
 */
export default function AuthCard({ onCancel }: { onCancel?: () => void }) {
  const canSignIn = useMail(s => s.canSignIn);
  const canCreate = useMail(s => s.canCreate);
  const domain = useMail(s => s.domain);
  const [tab, setTab] = useState<Tab>(canSignIn || !canCreate ? 'signin' : 'create');

  return (
    <div className="relative w-[min(440px,100%)] rounded-win bg-layer border border-stroke shadow-flyout overflow-hidden dialog-in">
      {onCancel && (
        <IconButton title={t('ui.common.close')} onClick={onCancel} className="absolute right-2 top-2">
          <X size={16} />
        </IconButton>
      )}
      <div className="px-8 pt-8 pb-2 flex flex-col items-center text-center">
        <AppIcon app="mail" size={56} />
        <div className="mt-3 text-subtitle font-semibold text-t1">{onCancel ? t('ui.mail.add_title') : t('ui.mail.welcome_title')}</div>
        <div className="mt-1 text-body text-t2">{t('ui.mail.welcome_sub', domain)}</div>
      </div>
      <div className="px-6 pt-3 flex justify-center">
        <Pivot<Tab>
          items={[
            { key: 'signin', label: t('ui.mail.tab_signin') },
            { key: 'create', label: t('ui.mail.tab_create') },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      <div className="h-px bg-stroke mx-6" />
      {tab === 'signin' ? <SignInForm key="in" onCancel={onCancel} /> : <CreateForm key="up" onCancel={onCancel} />}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-body text-t1 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-caption text-t2 mt-1">{hint}</span>}
    </label>
  );
}

function PasswordInput({ value, onChange, disabled, autoFocus, placeholder }: { value: string; onChange: (v: string) => void; disabled?: boolean; autoFocus?: boolean; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextInput
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        maxLength={64}
        className="pr-9"
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        title={show ? t('ui.mail.hide_password') : t('ui.mail.show_password')}
        onMouseDown={e => e.preventDefault()}
        onClick={() => setShow(v => !v)}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-6 flex items-center justify-center rounded-ctl text-t2 hover:bg-subtle hover:text-t1 disabled:opacity-40"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function Actions({ busy, submit, onCancel, disabled }: { busy: boolean; submit: string; onCancel?: () => void; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      {onCancel && (
        <Button onClick={onCancel} className="min-w-[96px]">
          {t('ui.common.cancel')}
        </Button>
      )}
      <Button variant="accent" type="submit" disabled={busy || disabled} className="min-w-[120px]">
        {busy ? <Spinner size={16} className="!text-accent-on" /> : submit}
      </Button>
    </div>
  );
}

function SignInForm({ onCancel }: { onCancel?: () => void }) {
  const canSignIn = useMail(s => s.canSignIn);
  const domain = useMail(s => s.domain);
  const [addr, setAddr] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !canSignIn) return;
    if (!addr.trim() || !pw) {
      setErr(t('ui.mail.err_fill'));
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await signIn(addr.trim(), pw);
    setBusy(false);
    if (res) setErr(res);
  };

  const bare = addr.trim() !== '' && !addr.includes('@');

  return (
    <form onSubmit={submit} className="px-8 pt-5 pb-7 flex flex-col gap-4">
      {!canSignIn && <InfoBar severity="warning">{t('ui.mail.cap_signin')}</InfoBar>}
      <Field label={t('ui.mail.email_label')} hint={t('ui.mail.email_hint', domain)}>
        <div className="relative">
          <TextInput
            value={addr}
            onChange={e => setAddr(e.target.value.replace(/\s/g, ''))}
            placeholder={t('ui.mail.email_placeholder', domain)}
            disabled={!canSignIn || busy}
            autoFocus
            maxLength={64}
            className={cx(bare && 'pr-28')}
          />
          {bare && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-body text-t3 pointer-events-none">@{domain}</span>}
        </div>
      </Field>
      <Field label={t('ui.mail.password_label')}>
        <PasswordInput value={pw} onChange={setPw} disabled={!canSignIn || busy} />
      </Field>
      {err && <InfoBar severity="error">{err}</InfoBar>}
      <Actions busy={busy} submit={t('ui.mail.sign_in')} onCancel={onCancel} disabled={!canSignIn} />
    </form>
  );
}

const USERNAME = /^[a-z0-9][a-z0-9._-]{1,31}$/;

function CreateForm({ onCancel }: { onCancel?: () => void }) {
  const canSignIn = useMail(s => s.canSignIn);
  const canCreate = useMail(s => s.canCreate);
  const domain = useMail(s => s.domain);
  const limits = useOS(s => s.payload?.mail);
  const minPw = limits?.minPassword ?? 6;
  const maxName = limits?.maxDisplayName ?? 40;
  const [user, setUser] = useState('');
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const allowed = canCreate && canSignIn;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !allowed) return;
    const u = user.trim().toLowerCase().replace(new RegExp(`@${domain.replace(/\./g, '\\.')}$`), '');
    const n = name.trim();
    if (!USERNAME.test(u)) return setErr(t('ui.mail.err_username'));
    if (!n || n.length > maxName) return setErr(t('ui.mail.err_name', maxName));
    if (pw.length < minPw) return setErr(t('ui.mail.err_password', minPw));
    if (pw !== pw2) return setErr(t('ui.mail.err_mismatch'));
    setBusy(true);
    setErr(null);
    const res = await signUp(u, pw, n);
    setBusy(false);
    if (res) setErr(res);
  };

  return (
    <form onSubmit={submit} className="px-8 pt-5 pb-7 flex flex-col gap-4">
      {!canCreate ? (
        <InfoBar severity="warning">{t('ui.mail.cap_create')}</InfoBar>
      ) : (
        !canSignIn && <InfoBar severity="warning">{t('ui.mail.cap_signin')}</InfoBar>
      )}
      <Field label={t('ui.mail.username_label')} hint={t('ui.mail.username_hint')}>
        <div className="flex">
          <TextInput
            value={user}
            onChange={e => setUser(e.target.value.replace(/\s/g, ''))}
            placeholder={t('ui.mail.username_placeholder')}
            disabled={!allowed || busy}
            autoFocus
            maxLength={32}
            className="rounded-r-none"
          />
          <span className="h-8 shrink-0 flex items-center px-2.5 rounded-r-ctl border border-l-0 border-stroke-strong bg-control text-body text-t2 select-none">@{domain}</span>
        </div>
      </Field>
      <Field label={t('ui.mail.name_label')} hint={t('ui.mail.name_hint')}>
        <TextInput value={name} onChange={e => setName(e.target.value)} placeholder={t('ui.mail.name_placeholder')} disabled={!allowed || busy} maxLength={maxName} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('ui.mail.password_label')}>
          <PasswordInput value={pw} onChange={setPw} disabled={!allowed || busy} />
        </Field>
        <Field label={t('ui.mail.confirm_label')}>
          <PasswordInput value={pw2} onChange={setPw2} disabled={!allowed || busy} />
        </Field>
      </div>
      <div className="-mt-2 text-caption text-t2">{t('ui.mail.password_hint', minPw)}</div>
      {err && <InfoBar severity="error">{err}</InfoBar>}
      <Actions busy={busy} submit={t('ui.mail.create')} onCancel={onCancel} disabled={!allowed} />
    </form>
  );
}
