import { useEffect, useRef } from 'react';
import { AdminFrame } from '@/AdminFrame';
import { gameView, type GameView } from '@/lib/gameView';
import { fetchNui, isEnvBrowser } from '@/nui/bridge';

// The resource's NUI page. It shows nothing itself: it holds the OS (os.html) and the
// /computeradmin panel (admin.html) as two frames, passes each the messages Lua sends it, and puts
// the OS where the player is looking.
//
// Where that is depends on how the computer was opened (client/computers/view.lua). With the
// camera up at the prop, Lua sends the rectangle the prop's screen covers on the player's display,
// and the OS is laid exactly over it. A page cannot simply be squeezed into a rectangle - everything
// in it that asks how big the window is, or where the pointer is, would be wrong - so the OS is a
// frame: inside it the rectangle IS the window. It is given a fixed height in its own pixels and
// scaled to fit, so a desktop is the same desktop on a 720p display and a 4K one.
//
// It also keeps the room. The Security Cameras app plays a camera's picture in its window by
// having the game look through that camera (client/computers/cameras.lua) - and the game draws one
// view, so the room round the prop's screen would turn into the camera's view too. Before the game
// looks away Lua asks for a still of the display as it is, and that still lies under the OS until
// the game is back: the player stays at their desk, with the camera's picture only where the app
// draws it. The picture expanded is the other way about: the still steps aside and the OS is given
// the whole display, to frame the game itself.

/** The part of the display the OS covers, as fractions of it. null = all of it. */
interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Height of the desktop in its own pixels while it sits on a prop's screen (its width follows the screen's shape). */
const DESKTOP_H = 900;
/** Frames the game is given to hand its picture over for the still, before going without one. */
const STILL_FRAMES = 30;
/** ms the OS is out of sight while it is moved between the prop's screen and the whole display. */
const MOVE_MS = 140;

const ADMIN_ACTION = /^computers:(admin|placer|picker|screener|camtool):/;

const fraction = (v: unknown): v is number => typeof v === 'number' && v >= 0 && v <= 1;

/** `view` from session.open's payload, or from ?frame=x,y,w,h in a browser. */
function toView(raw: unknown): View | null {
  const v = raw as Partial<View> | null | undefined;
  if (!v || !fraction(v.x) || !fraction(v.y) || !fraction(v.w) || !fraction(v.h) || v.w < 0.05 || v.h < 0.05) return null;
  return { x: v.x, y: v.y, w: v.w, h: v.h };
}

function place(frame: HTMLIFrameElement, view: View | null): void {
  const s = frame.style;
  if (!view) {
    s.left = s.top = s.width = s.height = s.transform = '';
    return;
  }
  const w = view.w * window.innerWidth;
  const h = view.h * window.innerHeight;
  s.left = `${view.x * window.innerWidth}px`;
  s.top = `${view.y * window.innerHeight}px`;
  s.width = `${Math.round((DESKTOP_H * w) / h)}px`;
  s.height = `${DESKTOP_H}px`;
  s.transform = `scale(${h / DESKTOP_H})`;
}

export default function Host() {
  const frame = useRef<HTMLIFrameElement>(null);
  const still = useRef<HTMLCanvasElement>(null);
  const query = isEnvBrowser() ? window.location.search + window.location.hash : '';

  useEffect(() => {
    const os = frame.current;
    const room = still.current;
    if (!os || !room) return;
    let view: View | null = null;
    let active = false;
    // A security camera's picture expanded over the whole display: the OS is given all of it for
    // the frame it draws over the picture, and goes back over the prop's screen when asked.
    let away = false;
    let moving = 0;
    // The still of the room: what draws it (made the first time one is asked for; null = this page
    // is not given the game's picture), and a count of the stills asked for and dropped - one
    // dropped while it was being taken is not put up after all.
    let picture: GameView | null | undefined;
    let stills = 0;

    const lay = () => place(os, away ? null : view);
    const show = (next: View | null) => {
      view = next;
      lay();
    };
    // Keys go to whichever document has focus: while the OS is up, that has to be the OS.
    const focus = () => {
      if (active) os.contentWindow?.focus();
    };
    const activate = (on: boolean) => {
      active = on;
      os.classList.toggle('is-active', on);
      focus();
    };

    const drop = () => {
      stills++;
      room.classList.remove('is-on');
      picture?.release(); // (a still that was being taken is not wanted any more: its hold on the game's picture goes too)
    };
    // Lua is about to have the game look through a camera, and waits to hear the room is kept.
    // The game hands its picture to one canvas at a time (src/lib/gameView.ts): it is taken here
    // for as long as the still takes and let go of before Lua is answered, since the next to want
    // it is the app, for the camera's picture.
    const freeze = () => {
      const mine = ++stills;
      const kept = () => void fetchNui('computers:camera:frozen');
      // (a desktop that covers the display has no room round it to keep)
      if (!view || away) return kept();
      if (picture === undefined) picture = gameView(room, true);
      const draw = picture;
      if (!draw) return kept();
      // (sized before the first draw, and only when it has to be: sizing a canvas wipes it)
      const w = Math.round(window.innerWidth * (window.devicePixelRatio || 1));
      const h = Math.round(window.innerHeight * (window.devicePixelRatio || 1));
      if (room.width !== w || room.height !== h) {
        room.width = w;
        room.height = h;
      }
      let frames = 0;
      const tick = () => {
        if (mine !== stills) return;
        // The first frame that is the game's is the still. One that never comes is not put up:
        // the room then turns with the game, which is better than a black display.
        if (draw.draw()) room.classList.add('is-on');
        else if (++frames < STILL_FRAMES) return void requestAnimationFrame(tick);
        draw.release();
        kept();
      };
      requestAnimationFrame(tick);
    };
    // The whole display for the OS, or the prop's screen again. The OS is out of sight while it is
    // moved, and changes what it shows on hearing that it has been: neither layout is seen in the
    // other's place.
    const display = (expanded: boolean) => {
      if (away !== expanded) {
        away = expanded;
        os.classList.add('is-moving');
        lay();
        room.classList.toggle('is-aside', away);
        window.clearTimeout(moving);
        moving = window.setTimeout(() => os.classList.remove('is-moving'), MOVE_MS);
      }
      os.contentWindow?.postMessage({ action: 'computers:host:display', data: { expanded } }, '*');
    };

    const onMessage = (e: MessageEvent) => {
      const data = e.data as { action?: unknown; source?: unknown; active?: unknown; expanded?: unknown; data?: { view?: unknown; active?: unknown } } | undefined;
      if (!data) return;
      // The OS says when it has something up (a computer, a StartHack window) and when it has not,
      // and when a camera's picture wants the whole display.
      if (e.source === os.contentWindow) {
        if (data.source !== 'sd-computers-os') return;
        if (typeof data.expanded === 'boolean') display(data.expanded);
        else activate(data.active === true);
        return;
      }
      // From Lua: everything that is not the admin panel's (AdminFrame takes those) is the OS's.
      if (typeof data.action !== 'string' || !data.action.startsWith('computers:') || ADMIN_ACTION.test(data.action)) return;
      if (data.action === 'computers:camera:freeze') return freeze();
      if (data.action === 'computers:open') {
        away = false;
        drop();
        show(toView(data.data?.view));
      } else if (data.action === 'computers:lib:open' && !active) show(null);
      else if (data.action === 'computers:camera') {
        // (the game is back in the room: the still has done its work, and the display is the desktop's)
        if (data.data?.active !== true) {
          drop();
          display(false);
        }
      } else if (data.action === 'computers:close') {
        away = false;
        drop();
      }
      os.contentWindow?.postMessage(data, '*');
    };
    const onResize = () => lay();

    window.addEventListener('message', onMessage);
    window.addEventListener('resize', onResize);
    window.addEventListener('focus', focus);
    window.addEventListener('mousedown', focus); // (a click on the bezel, outside the frame)

    // Browser dev: ?frame=x,y,w,h lays the OS out as it would sit on a prop's screen.
    if (isEnvBrowser()) {
      const raw = new URLSearchParams(window.location.search).get('frame')?.split(',').map(Number);
      if (raw?.length === 4) show(toView({ x: raw[0], y: raw[1], w: raw[2], h: raw[3] }));
      activate(true);
    }
    return () => {
      window.clearTimeout(moving);
      window.removeEventListener('message', onMessage);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('focus', focus);
      window.removeEventListener('mousedown', focus);
    };
  }, []);

  return (
    <>
      <canvas ref={still} className="host-still" />
      <iframe ref={frame} className="host-os" src={`os.html${query}`} title="Computer" tabIndex={-1} />
      {/* The /computeradmin panel: always mounted in the game so Lua can open it at any time. In a
          browser it is a tab of its own (/admin.html), not a frame over the OS. */}
      {!isEnvBrowser() && <AdminFrame />}
    </>
  );
}
