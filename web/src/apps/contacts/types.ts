// Shapes of the Contacts server contract (server/computers/contacts.lua contacts:*) - the
// character's PHONE address book, through the optional sd-phone link. Change one, change both.

/** One card in the address book. */
export interface Contact {
  id: string;
  /** what the phone shows it as (its number, when it was saved without a name) */
  name: string;
  /** bare digits ('' when the phone has none for it) */
  number: string;
  /** the phone's own initials for it ('#' for a card with no letters) */
  initials?: string;
  /** avatar colour the phone gave it (hex) */
  color?: string;
  /** avatar image URL */
  avatar?: string;
  favorite: boolean;
  /** kept by the phone and shown here; the desk can't edit them */
  email?: string;
  address?: string;
}

/** contacts:list - sorted by name. */
export interface ListData {
  contacts: Contact[];
}

/** contacts:remove - how many cards the phone had under that number (0 = it was already gone). */
export interface RemoveData {
  removed: number;
}
