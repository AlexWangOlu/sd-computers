// Shapes from server/computers/shell.lua (cameras:*) and client/computers/cameras.lua.

/** One camera this player may watch from this computer. */
export interface Camera {
  id: string;
  label: string;
  /** The place it is in: the heading it is listed under. */
  area?: string;
}

/** The look of a camera's picture (Filter in configs/shared/cameras.lua). */
export type Filter = 'cctv' | 'colour' | 'none';

/** What the game says it is showing while it looks through a camera. */
export interface Watching {
  id: string;
  label?: string;
  area?: string;
  /** Times it is zoomed in right now (1 = not), and the most it goes. */
  zoom?: number;
  maxZoom?: number;
  filter?: Filter;
}

/** Where the app is with the camera it was asked for: getting its picture, showing it, or giving the display back. */
export type Stage = 'connecting' | 'live' | 'leaving';

/** A turn of the camera: how far the picture was dragged (fractions of the picture), a zoom factor, or back to how it was set up. */
export interface Control {
  dx?: number;
  dy?: number;
  zoom?: number;
  reset?: boolean;
}
