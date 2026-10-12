// Shapes of the Mail server contract (server/computers/mail.lua) plus the app's own view types.

export type Folder = 'inbox' | 'flagged' | 'drafts' | 'sent' | 'spam' | 'bin';

/** Folder pane order (built-in Mail). */
export const FOLDERS: Folder[] = ['inbox', 'flagged', 'drafts', 'sent', 'bin'];

/** Folder pane order for this computer: the phone's mail also has Spam. */
export const foldersFor = (phone: boolean | undefined): Folder[] => (phone ? ['inbox', 'flagged', 'drafts', 'sent', 'spam', 'bin'] : FOLDERS);

/** Message ids: numbers from the built-in Mail, strings from sd-phone's. */
export type MailId = number | string;

export interface Counts {
  unread: number;
  inbox: number;
  sent: number;
  drafts: number;
  bin: number;
  flagged: number;
  /** phone mail only */
  spam?: number;
}

export interface Account {
  email: string;
  name: string;
  counts: Counts;
}

/** A stored message. `folder` is where it really lives ('flagged' is a view, never a folder). */
/** A phone-mail attachment (sd-phone; document bodies stay on the phone). */
export type Attachment =
  | { kind: 'photo'; url: string }
  | { kind: 'audio'; name: string; duration?: number }
  | { kind: 'note'; title: string; body: string }
  | { kind: 'document'; name: string };

export interface Message {
  id: MailId;
  folder: string;
  from: { email: string; name: string };
  to: string[];
  subject: string;
  preview: string;
  body?: string;
  read: boolean;
  flagged: boolean;
  /** unix seconds */
  ts: number;
  /** phone mail: shown in the reading pane */
  attachments?: Attachment[];
  /** phone mail: the list row shows a paperclip */
  hasAttachments?: boolean;
}

export interface StateData {
  domain: string;
  accounts: Account[];
  canSignIn: boolean;
  canCreate: boolean;
}

export interface ListData {
  messages: Message[];
  counts: Counts;
}

export interface SendData {
  delivered: string[];
  failed: string[];
}

/** useBus('mail:received') payload. */
export interface ReceivedPush {
  mailbox: string;
  message: { id: MailId; senderName: string; senderEmail: string; subject: string; preview: string };
}

/** What the composer opens with. A new `key` remounts the composer. */
export interface ComposeInit {
  key: number;
  from: string;
  to: string[];
  subject: string;
  body: string;
  draftId?: MailId;
  focus: 'to' | 'body';
}

export interface Notice {
  severity: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  text: string;
}

/** A pending confirmation, rendered as a ContentDialog over the whole window. */
export interface ConfirmSpec {
  title: string;
  body: string;
  confirm: string;
  danger?: boolean;
  run: () => void | Promise<void>;
}
