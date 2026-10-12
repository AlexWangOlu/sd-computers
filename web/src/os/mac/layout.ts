// Geometry shared by the Harbor shell pieces (menu bar, dock, window area).

/** Height of the top menu bar. Windows live below it. */
export const MENU_H = 28;

/** Dock icon size at rest, the slab's padding, and its gap to the screen edge. */
export const DOCK_ICON = 50;
export const DOCK_PAD = 6;
export const DOCK_BOTTOM = 6;
/** Height of the dock slab (icons grow upward out of it while magnified). */
export const DOCK_SLAB = DOCK_ICON + DOCK_PAD * 2;
/** Space kept clear above the bottom edge for the dock: windows place, clamp and zoom above it. */
export const DOCK_RESERVE = DOCK_SLAB + DOCK_BOTTOM + 6;

/** Title bar height of a window frame. */
export const TITLE_H = 30;

// The dock registers its slab here so a minimizing window knows where to fly to.
let dockEl: HTMLElement | null = null;

export const setDockElement = (el: HTMLElement | null): void => {
  dockEl = el;
};

/** Screen point a minimized window shrinks into: the right end of the dock (where it will appear). */
export const dockTarget = (): { x: number; y: number } => {
  const r = dockEl?.getBoundingClientRect();
  if (!r || r.width === 0) return { x: window.innerWidth / 2, y: window.innerHeight - DOCK_SLAB / 2 - DOCK_BOTTOM };
  return { x: r.right - DOCK_ICON / 2 - DOCK_PAD, y: r.top + r.height / 2 };
};
