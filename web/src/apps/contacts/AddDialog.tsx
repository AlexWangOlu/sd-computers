import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { t } from '@/i18n';
import { Button, Dialog, TextInput } from '@/ui/controls';
import { MAX_NAME, checkNew, cleanNumber, digitsOf } from './model';

/**
 * "Add contact": a name and a number. The server sends it through the phone's own add, so the
 * phone decides (the number must be in service, not your own, not saved already) and what it
 * says comes back as the error shown here. Escape is handled by index.tsx.
 */
export default function AddDialog({
  busy,
  onSubmit,
  onClose,
}: {
  busy: boolean;
  /** Sends it; resolves to the error sentence, or null once it is saved (the caller closes the dialog). */
  onSubmit: (name: string, number: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const h = window.setTimeout(() => nameRef.current?.focus(), 40);
    return () => {
      mounted.current = false;
      window.clearTimeout(h);
    };
  }, []);

  const submit = async () => {
    if (busy) return;
    const why = checkNew(name, number);
    if (why) {
      setError(why);
      return;
    }
    setError(null);
    const failed = await onSubmit(name.trim(), digitsOf(number));
    if (failed && mounted.current) setError(failed);
  };

  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    void submit();
  };

  return (
    <Dialog
      title={t('ui.contacts.add_title')}
      onClose={busy ? undefined : onClose}
      actions={
        <>
          <Button variant="accent" className="min-w-[120px]" onClick={() => void submit()} disabled={busy}>
            {busy ? t('ui.contacts.adding') : t('ui.contacts.add_confirm')}
          </Button>
          <Button className="min-w-[120px]" onClick={onClose} disabled={busy}>
            {t('ui.common.cancel')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-caption text-t2">{t('ui.contacts.field_name')}</span>
          <TextInput
            ref={nameRef}
            value={name}
            maxLength={MAX_NAME}
            autoComplete="off"
            readOnly={busy}
            onChange={e => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={onEnter}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-caption text-t2">{t('ui.contacts.field_number')}</span>
          <TextInput
            value={number}
            maxLength={24}
            inputMode="tel"
            autoComplete="off"
            readOnly={busy}
            onChange={e => {
              setNumber(cleanNumber(e.target.value));
              setError(null);
            }}
            onKeyDown={onEnter}
          />
          <span className="text-caption text-t3">{t('ui.contacts.number_hint')}</span>
        </label>
        {error && (
          <div role="alert" className="text-caption text-critical">
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}
