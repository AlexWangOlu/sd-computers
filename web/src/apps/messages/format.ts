import { t } from '@/i18n';
import { fmtDuration } from '@/lib/format';
import type { TextMessage } from './types';

const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** 2500 -> "2,500" (the phone sends whole dollars). */
const amountText = (n: number | undefined): string => Math.max(0, Math.round(Number(n) || 0)).toLocaleString('en-US');

/** One-line text for a message: its body for a text, a label for what a phone sent (photo, payment...). */
export function messagePreview(m: Pick<TextMessage, 'kind' | 'body' | 'amount' | 'duration' | 'requested'>): string {
  const body = typeof m.body === 'string' ? oneLine(m.body) : '';
  switch (m.kind) {
    case 'text':
      return body;
    case 'image':
      return t('ui.messages.kind_image');
    case 'gif':
      return t('ui.messages.kind_gif');
    case 'money':
      return t(m.requested ? 'ui.messages.kind_money_request' : 'ui.messages.kind_money', amountText(m.amount));
    case 'location':
      // The phone puts the place's label in the body ("Legion Square").
      return body ? t('ui.messages.kind_location_named', body) : t('ui.messages.kind_location');
    case 'locrequest':
      return t('ui.messages.kind_locrequest');
    case 'voice':
      return Number(m.duration) > 0 ? t('ui.messages.kind_voice_len', fmtDuration(Number(m.duration))) : t('ui.messages.kind_voice');
    default:
      return body || t('ui.messages.kind_other');
  }
}
