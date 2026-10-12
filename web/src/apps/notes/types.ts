// Shapes of the Notes server contract (server/computers/phoneapps.lua phonenotes:*) - the
// character's PHONE notes, through the optional sd-phone link. Change one, change both.
// (notes:* without the prefix is Notepad's own storage - a different thing.)

/** phonenotes:list row. A note has no title field: it is the body's first non-empty line. */
export interface NoteRow {
  id: string;
  title: string;
  /** the rest of the body, one line, <= 120 chars */
  preview: string;
  /** how many photos / sketches the note carries (drawn only when opened) */
  images: number;
  sketches: number;
  /** ISO-8601 UTC, e.g. '2026-10-05T18:22:04.000Z' */
  createdAt: string;
  updatedAt: string;
}

/** phonenotes:get - one note in full. Photos are URLs, sketches PNG data URLs; both read-only here. */
export interface NoteFull {
  id: string;
  body: string;
  images: string[];
  sketches: string[];
  createdAt: string;
  updatedAt: string;
}

/** phonenotes:save -> */
export interface SaveData {
  id: string;
  createdAt: string;
  updatedAt: string;
}
