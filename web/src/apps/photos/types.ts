// Shapes of the Photos server contract (server/computers/photos.lua photos:list) - the
// character's PHONE gallery, through the optional sd-phone link. Change one, change both.

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
}

/** photos:list - newest first. */
export interface ListData {
  photos: Photo[];
  /** the list is full (200): the phone may hold older ones that aren't in it */
  capped: boolean;
}
