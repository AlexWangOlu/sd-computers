import { useState } from 'react';
import { UserRound, Users } from 'lucide-react';
import type { Contact } from './types';
import { initialsOf, personaColor } from './util';

/**
 * A person's round avatar in the colour their phone gave them (photo when they have one, initials
 * otherwise, a person glyph for a bare number). Groups get a group glyph on an accent tint.
 */
export function Avatar({ contact, group, size = 40 }: { contact?: Contact; group?: boolean; size?: number }) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const box = { width: size, height: size };

  if (group) {
    return (
      <div aria-hidden className="flex items-center justify-center rounded-full shrink-0 bg-[var(--accent-soft)] text-accent-text select-none" style={box}>
        <Users size={Math.round(size * 0.46)} />
      </div>
    );
  }

  const url = contact?.avatar && contact.avatar !== brokenUrl ? contact.avatar : null;
  const letters = initialsOf(contact);
  return (
    <div
      aria-hidden
      className="relative flex items-center justify-center rounded-full shrink-0 overflow-hidden font-semibold text-white select-none"
      style={{
        ...box,
        fontSize: Math.max(9, Math.round(size * 0.38)),
        background: contact?.color || personaColor(contact?.phone || contact?.name || '?'),
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
