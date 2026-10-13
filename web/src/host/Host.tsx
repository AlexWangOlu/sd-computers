import { useEffect, useRef } from 'react';
import { AdminFrame } from '@/AdminFrame';
import { isEnvBrowser } from '@/nui/bridge';

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

/** The part of the display the OS covers, as fractions of it. null = all of it. */
interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Height of the desktop in its own pixels while it sits on a prop's screen (its width follows the screen's shape). */
const DESKTOP_H = 900;

const ADMIN_ACTION = /^computers:(admin|placer|picker):/;

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
  const query = isEnvBrowser() ? window.location.search + window.location.hash : '';

  useEffect(() => {
    const os = frame.current;
    if (!os) return;
    let view: View | null = null;
    let active = false;

    const show = (next: View | null) => {
      view = next;
      place(os, view);
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

    const onMessage = (e: MessageEvent) => {
      const data = e.data as { action?: unknown; source?: unknown; active?: unknown; data?: { view?: unknown } } | undefined;
      if (!data) return;
      // The OS says when it has something up (a computer, a StartHack window) and when it has not.
      if (e.source === os.contentWindow) {
        if (data.source === 'sd-computers-os') activate(data.active === true);
        return;
      }
      // From Lua: everything that is not the admin panel's (AdminFrame takes those) is the OS's.
      if (typeof data.action !== 'string' || !data.action.startsWith('computers:') || ADMIN_ACTION.test(data.action)) return;
      if (data.action === 'computers:open') show(toView(data.data?.view));
      else if (data.action === 'computers:lib:open' && !active) show(null);
      os.contentWindow?.postMessage(data, '*');
    };
    const onResize = () => place(os, view);

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
      window.removeEventListener('message', onMessage);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('focus', focus);
      window.removeEventListener('mousedown', focus);
    };
  }, []);

  return (
    <>
      <iframe ref={frame} className="host-os" src={`os.html${query}`} title="Computer" tabIndex={-1} />
      {/* The /computeradmin panel: always mounted in the game so Lua can open it at any time. In a
          browser it is a tab of its own (/admin.html), not a frame over the OS. */}
      {!isEnvBrowser() && <AdminFrame />}
    </>
  );
}
