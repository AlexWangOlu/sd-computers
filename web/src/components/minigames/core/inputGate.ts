// Keyboard gate for the minigames (sd-computers addition). Every game listens on `window` in the
// capture phase, which would also eat keys typed into OTHER windows of the desktop. Each game's
// key listeners are wrapped with gated(); the hack window flips setGameInput() off whenever it is
// not the focused window. Wrappers are memoised per handler so removeEventListener still matches.
let enabled = true;

export const setGameInput = (on: boolean): void => {
  enabled = on;
};

const wrappers = new WeakMap<object, (e: Event) => void>();

export function gated<T extends Event>(fn: (e: T) => void): (e: T) => void {
  let w = wrappers.get(fn);
  if (!w) {
    w = (e: Event) => {
      if (enabled) fn(e as T);
    };
    wrappers.set(fn, w);
  }
  return w as (e: T) => void;
}
