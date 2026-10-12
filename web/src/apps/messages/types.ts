// Shapes of the Messages server contract (server/computers/phoneapps.lua messages:*) - the
// character's PHONE texts, through the optional sd-phone link. Change one, change both.

/** A person in a thread / the phone's contact list. `phone` = bare digits. */
export interface Contact {
  id: string;
  name: string;
  initials?: string;
  /** avatar colour the phone gave this contact (CSS colour) */
  color?: string;
  /** avatar image URL */
  avatar?: string;
  phone?: string;
}

/** 'text' is the only kind a desk can SEND; the rest arrive from phones and are drawn as labels. */
export type MessageKind = 'text' | 'image' | 'gif' | 'money' | 'location' | 'voice' | 'locrequest';

export interface TextMessage {
  id: string | number;
  /** 'me' = this character; otherwise the sender's bare-digit number */
  from: string;
  body: string;
  kind: MessageKind | string;
  /** unix MILLISECONDS (the phone's clock) */
  ts: number;
  read: boolean;
  /** ms - when the other side saw it (1:1, my messages) */
  seenAt?: number;
  gifUrl?: string;
  amount?: number;
  /** voice: seconds */
  duration?: number;
  /** money: a payment REQUEST rather than a payment sent */
  requested?: boolean;
  /** money request: the phone's status for it (pending / paid / declined ...) */
  requestStatus?: string;
}

/** One row of the conversation list. `id` = the peer's number (1:1) or 'g-<id>' (group). */
export interface ConversationRow {
  id: string;
  title: string;
  participants: Contact[];
  group: boolean;
  unread: number;
  muted: boolean;
  /** newest message (absent for an empty group) */
  last?: TextMessage;
}

/** messages:thread - the open conversation, oldest message first (up to 200). */
export interface Thread {
  id: string;
  title: string;
  participants: Contact[];
  group: boolean;
  unread: number;
  muted: boolean;
  messages: TextMessage[];
}

/** messages:list */
export interface ListData {
  conversations: ConversationRow[];
  contacts: Contact[];
  myNumber?: string;
  myName?: string;
}

/** useBus('messages:seen') - a 1:1 peer read my texts. `conversation` = their number (my thread id). */
export interface SeenPush {
  conversation: string;
  /** ms */
  seenAt: number;
}

/** useBus('messages:incoming') - sd-phone's raw push: the thread id + the one new message. */
export interface IncomingPush {
  id: string;
  participants?: Contact[];
  messages?: TextMessage[];
  groupName?: string;
}
