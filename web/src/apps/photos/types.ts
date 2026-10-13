// Shapes of the Photos server contract (server/computers/photos.lua): the character's own pictures,
// added by their link and kept with the computers, and the PHONE's gallery beside them through the
// optional sd-phone link. Change one, change both.

/** One thing in the gallery. The phone keeps no caption, album or location on it. */
export interface Photo {
  id: string;
  /** where it is hosted (https) */
  url: string;
  /** unix SECONDS it was taken (0 = the phone has no time for it) */
  ts: number;
  /** a clip rather than a still */
  video: boolean;
  favorite: boolean;
  /** whose it is: the character's own (it can be taken out again here), or the phone's (which stays the phone's) */
  place: 'computer' | 'phone';
}

/** photos:list - newest first. */
export interface ListData {
  photos: Photo[];
  /** the list is full (200): the phone may hold older ones that aren't in it */
  capped: boolean;
  /** the phone's gallery is in the list (sd-phone linked, the phone linked to this machine) */
  phone: boolean;
  /** how many pictures of their own the character keeps, and the most they can */
  count: number;
  max: number;
}
