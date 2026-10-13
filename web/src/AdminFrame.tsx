import { useEffect, useRef, useState } from 'react';

// The /computeradmin panel is its own page (admin.html, src/admin): it is built from sd-bombs'
// admin UI, stylesheet and all, and an iframe keeps that stylesheet from ever touching the OS (and
// the OS's from touching it). A resource only gets one NUI page, so that page (src/host) holds it
// beside the OS: every message Lua addresses to the panel is passed down, and the frame only takes
// the mouse while the panel says it is up (it covers the whole screen).

const ADMIN_ACTION = /^computers:(admin|placer|picker):/;

export function AdminFrame() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { action?: string; source?: string; interactive?: boolean } | undefined;
      if (data?.source === 'sd-computers-admin') {
        setInteractive(data.interactive === true);
        return;
      }
      // From Lua (or a dev console): hand anything addressed to the panel down to it.
      if (e.source !== frame.current?.contentWindow && typeof data?.action === 'string' && ADMIN_ACTION.test(data.action)) {
        frame.current?.contentWindow?.postMessage(data, '*');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Keys go to whichever document has focus; give it to the panel when it opens.
  useEffect(() => {
    if (interactive) frame.current?.contentWindow?.focus();
  }, [interactive]);

  return (
    <iframe
      ref={frame}
      src="admin.html"
      title="Computers admin"
      tabIndex={-1}
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', border: 0, background: 'transparent', pointerEvents: interactive ? 'auto' : 'none', zIndex: 20000, colorScheme: 'normal' }}
    />
  );
}
