// Files' wire shapes, exactly as server/computers/files.lua replies. Times are unix seconds.

/** The limits the server enforces (configs/shared/files.lua), sent with the list. */
export interface Limits {
  maxFiles: number;
  /** characters in a file name */
  maxName: number;
  /** characters in a document */
  maxBody: number;
}

/** One of the character's documents, without its text. */
export interface FileRow {
  id: number;
  name: string;
  /** bytes of text */
  size: number;
  createdAt: number;
  /** when the text last changed (a rename leaves it alone) */
  updatedAt: number;
}

/** files:read - the document with what is in it. */
export interface FileFull extends FileRow {
  /** plain text, or - `format` 'rich' - a formatted document as JSON (src/lib/richdoc.tsx) */
  body: string;
  format?: 'text' | 'rich';
}

/** files:list */
export interface ListData {
  files: FileRow[];
  /** the phone's documents can be shown on this computer right now */
  phone: boolean;
  limits: Limits;
}

/** What a phone document is: written text, a picture, or something another resource attached. */
export type PhoneKind = 'text' | 'image' | 'file';

/** One of the phone's documents, without its text. Ids are the phone's own strings. */
export interface PhoneRow {
  id: string;
  name: string;
  kind: PhoneKind;
  size: number;
  /** read-only on the phone as well (issued by a business, a landlord ...) */
  locked: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PhoneSignature {
  signer: string;
  signedAt: number;
}

/** files:phoneRead - the document to look at. */
export interface PhoneFull extends PhoneRow {
  /** '' for a picture, and for an attachment with nothing to read */
  body: string;
  /** a picture's address */
  url?: string;
  signatures: PhoneSignature[];
}
