import { useState } from 'react';
import { UserRound } from 'lucide-react';
import type { Contact } from './types';
import { initialsOf, inkOn, personaColor } from './model';

/**
 * A contact's round avatar in the colour their phone gave them: the photo when they have one,
 * initials otherwise, a person glyph for a card that is only a number.
 */
export function Avatar({ contact, size = 40 }: { contact: Pick<Contact, 'name' | 'number' | 'initials' | 'color' | 'avatar'>; size?: number }) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const url = contact.avatar && contact.avatar !== brokenUrl ? contact.avatar : null;
  const letters = initialsOf(contact);
  const fill = contact.color || personaColor(contact.number || contact.name || '?');
  return (
    <div
      aria-hidden
      className="relative flex items-center justify-center rounded-full shrink-0 overflow-hidden font-semibold select-none"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.38)),
        background: fill,
        color: inkOn(fill),
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
      }}
    >
      {url ? (
        <img src={url} alt="" draggable={false} onError={() => setBrokenUrl(url)} className="w-full h-full object-cover" />
      ) : letters ? (
        letters
      ) : (
        <UserRound size={Math.round(size * 0.5)} />
      )}
    </div>
  );
}
