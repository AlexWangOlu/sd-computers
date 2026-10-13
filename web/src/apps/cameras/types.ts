// Shapes from server/computers/shell.lua (cameras:*) and client/computers/cameras.lua.

/** One camera this player may watch from this computer. */
export interface Camera {
  id: string;
  label: string;
  /** The place it is in: the heading it is listed under. */
  area?: string;
}

/** What the game says is on the display while a camera's picture is. */
export interface Watching {
  id: string;
  label?: string;
  area?: string;
  /** Times it is zoomed in right now (1 = not), and the most it goes. */
  zoom?: number;
  maxZoom?: number;
}

/** A turn of the camera: how far the picture was dragged (fractions of the display), a zoom factor, or back to how it was set up. */
export interface Control {
  dx?: number;
  dy?: number;
  zoom?: number;
  reset?: boolean;
}
