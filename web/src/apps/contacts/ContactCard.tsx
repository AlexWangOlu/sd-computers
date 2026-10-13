import type { ReactNode } from 'react';
import { ArrowLeft, Mail, MapPin, MessageSquare, Phone, Star, Trash2 } from 'lucide-react';
import { t } from '@/i18n';
import { Button, Card, IconButton } from '@/ui/controls';
import { Avatar } from './parts';
import { fmtPhone } from './model';
import type { Contact } from './types';

/**
 * Right pane: the selected contact. Who they are, what the desk can do with them (text them,
 * delete them) and what else the phone keeps on their card, to read.
 */
export default function ContactCard({
  contact,
  onMessage,
  onDelete,
  onBack,
}: {
  contact: Contact;
  /** absent when Messages isn't installed on this computer */
  onMessage?: () => void;
  onDelete: () => void;
  /** single-pane layout: back to the list */
  onBack?: () => void;
}) {
  const number = contact.number ? fmtPhone(contact.number) : '';
  // Saved without a name, the card's name already is its number.
  const sub = number && number !== contact.name ? number : !number ? t('ui.contacts.no_number') : '';
  return (
    // Keyed by the caller, so each card opened rises in.
    <div className="h-full flex flex-col min-h-0 page-in">
      {onBack && (
        <div className="h-12 shrink-0 flex items-center gap-1 px-2 border-b border-stroke">
          <IconButton title={t('ui.contacts.back')} onClick={onBack} className="shrink-0">
            <ArrowLeft size={16} />
          </IconButton>
          <div className="flex-1 min-w-0 px-2 text-caption text-t2 truncate">{t('ui.contacts.title')}</div>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto os-scroll">
        <div className="mx-auto w-full max-w-[560px] px-6 py-6 flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <Avatar contact={contact} size={72} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <h2 className="min-w-0 text-subtitle font-semibold text-t1 break-words select-text">{contact.name}</h2>
                {contact.favorite && (
                  <span title={t('ui.contacts.favorite')} className="shrink-0 mt-1.5 text-t2">
                    <Star size={16} fill="currentColor" />
                  </span>
                )}
              </div>
              {sub && <div className="text-body text-t2 tabular-nums select-text">{sub}</div>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {onMessage && contact.number && (
              <Button variant="accent" icon={<MessageSquare size={16} />} onClick={onMessage}>
                {t('ui.contacts.message')}
              </Button>
            )}
            <Button icon={<Trash2 size={16} />} onClick={onDelete} disabled={!contact.number}>
              {t('ui.common.delete')}
            </Button>
          </div>

          {(number || contact.email || contact.address) && (
            <div className="flex flex-col gap-2">
              {number && <Field icon={<Phone size={16} />} label={t('ui.contacts.field_phone')} value={number} />}
              {contact.email && <Field icon={<Mail size={16} />} label={t('ui.contacts.field_email')} value={contact.email} />}
              {contact.address && <Field icon={<MapPin size={16} />} label={t('ui.contacts.field_address')} value={contact.address} />}
            </div>
          )}

          {/* The desk deletes by number (the phone's own rule for other resources), so a card without one can only go from the phone. */}
          <div className="text-caption text-t3">{t(contact.number ? 'ui.contacts.edit_on_phone' : 'ui.contacts.delete_on_phone')}</div>
        </div>
      </div>
    </div>
  );
}

/** One line of the card: what it is, and its value (selectable, so a number can be copied out). */
function Field({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card icon={icon}>
      <div className="flex-1 min-w-0">
        <div className="text-caption text-t2">{label}</div>
        <div className="text-body text-t1 break-words select-text">{value}</div>
      </div>
    </Card>
  );
}
