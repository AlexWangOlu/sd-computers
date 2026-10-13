import { useState } from 'react';
import type { Site } from './types';
import { LoadBar } from './parts';

/**
 * A `url` site: the server owner's own real page, in a frame that fills the page area. `url` only
 * ever comes out of the network's list (model.ts resolve()) - never from what was typed. The
 * sandbox lets the page run and submit its forms, and nothing more: it cannot open windows or
 * take over the page it sits in.
 *
 * A frame swallows the clicks made on it, so the shell would never hear one that should bring this
 * window to the front: while the window is behind another, a clear sheet over the frame takes that
 * first click instead.
 */
export default function FramePage({ site, url, covered }: { site: Site; url: string; covered: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative h-full w-full fade-in">
      {!loaded && <LoadBar />}
      <iframe
        title={site.title}
        src={url}
        sandbox="allow-scripts allow-same-origin allow-forms"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        className="block w-full h-full border-0"
        // A web page that sets no background of its own expects a white one.
        style={{ background: loaded ? '#fff' : 'transparent' }}
      />
      {covered && <div className="absolute inset-0" />}
    </div>
  );
}
