import type { OpenPayload } from '@/types';

/** What a link puts on the machine: the phone's apps, and the Phone place in Files. */
export type Unlock = 'messages' | 'notes' | 'photos' | 'contacts' | 'files';

/** The desktop's lists, as the server reworks them when a phone is linked or taken off. */
export type DesktopLists = Pick<OpenPayload['computer'], 'apps' | 'pinned' | 'desktopIcons'>;

/** phonelink:state, and the reply of every other phonelink:* endpoint (server/computers/phonelink.lua). */
export interface LinkState {
  linked: boolean;
  /** unix seconds the phone was linked to this machine at */
  since?: number;
  /** the phone is on the player right now */
  carrying: boolean;
  /** a linked machine still needs the phone nearby (Phone.RequirePhone) */
  requirePhone: boolean;
  unlocks: Unlock[];
  /** digits in a code */
  digits: number;
  /** minutes a code works for */
  minutes: number;
  /** the code that is out, when one is: seconds until it stops working / until another can be sent */
  code?: { expiresIn: number; resendIn: number };
  /** only on phonelink:confirm and phonelink:unlink: what the desktop has now */
  computer?: DesktopLists;
}
