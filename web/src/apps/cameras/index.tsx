import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cctv, Eye, RefreshCw } from 'lucide-react';
import type { AppProps } from '../registry';
import { useNuiEvent } from '@/hooks/useNuiEvent';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { Button, Empty, InfoBar, Spinner } from '@/ui/controls';
import CameraView from './CameraView';
import FeedWindow from './FeedWindow';
import { controlCamera, setDisplay, startCamera, stopCamera } from './feed';
import type { Camera, Stage, Watching } from './types';

// Security Cameras - the cameras this player may watch from this computer (cameras:list), by the
// place they are in. Picking one plays its picture in the window (FeedWindow): the game's own view
// goes to where the camera is (client/computers/cameras.lua) and the page draws that view, while
// the room round the computer is held as a still by the page holding the OS (src/host). Expanded,
// the picture takes the whole display instead (CameraView). Which cameras there are, and where
// each is, is the server's to say; this app only ever names one by id.

/** The least a camera is "connecting" for, ms: one that is ready at once still tunes in. */
const CONNECT_MS = 450;
/** How long the picture is snow before the camera is let go of, ms: leaving one is seen to happen. */
const LEAVE_MS = 280;
const wait =(ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

/** The camera asked for, and how far along its picture is. */
interface Session {
  camera: Camera;
  stage: Stage;
}

export default function Cameras({ win }: AppProps) {
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [watching, setWatching] = useState<Watching | null>(null);
  const [expanded, setExpanded] = useState(false);
  // false once the page has turned out not to be given the game's picture (GameView): a camera is
  // then only ever watched expanded, where the picture is the game itself.
  const [windowed, setWindowed] = useState(true);

  // Counts every ask to watch and to stop: an answer to one that has been overtaken is not acted on.
  const asked = useRef(0);
  const now = useRef({ cameras, session, watching, expanded });
  now.current = { cameras, session, watching, expanded };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await rpc<Camera[]>('cameras:list');
    setLoading(false);
    if (res.ok) {
      // (an empty Lua table arrives as {} rather than [])
      setCameras(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } else {
      setError(res.error || t('ui.common.error'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** The picture back in the window (or, there being no window for it, nowhere). */
  const collapse = useCallback(async () => {
    if (!now.current.expanded) return;
    await setDisplay(false);
    setExpanded(false);
  }, []);

  const expand = useCallback(async () => {
    if (now.current.expanded) return;
    await setDisplay(true);
    setExpanded(true);
  }, []);

  // The game says what it is showing: a camera's picture (and whose), or the room again - also when
  // it was not this app that ended it (the computer closing under a camera).
  useNuiEvent<Watching & { active: boolean }>('computers:camera', d => {
    if (d && d.active) {
      setWatching(d);
      return;
    }
    asked.current++;
    setWatching(null);
    setSession(null);
    setExpanded(false); // (the page holding the OS has taken the display back by itself)
  });

  const watch = useCallback(async (id: string) => {
    const camera = now.current.cameras?.find(c => c.id === id);
    if (!camera) return;
    const mine = ++asked.current;
    setError(null);
    setSession({ camera, stage: 'connecting' });
    const [res] = await Promise.all([startCamera(id), wait(CONNECT_MS)]);
    if (mine !== asked.current) return;
    if (res.ok) {
      setSession({ camera, stage: 'live' });
      return;
    }
    if (!res.overtaken) setError(res.error || t('ui.common.error'));
    // (a switch that failed leaves the camera that was up, up)
    const still = now.current.watching;
    const before = still && now.current.cameras?.find(c => c.id === still.id);
    if (before && !res.overtaken) setSession({ camera: before, stage: 'live' });
    else {
      setSession(null);
      void collapse();
    }
  }, [collapse]);

  /** Stop watching: back to the list. */
  const back = useCallback(async () => {
    const s = now.current.session;
    if (!s || s.stage === 'leaving') return;
    const mine = ++asked.current;
    setSession({ camera: s.camera, stage: 'leaving' });
    await wait(LEAVE_MS);
    if (mine !== asked.current) return;
    await stopCamera();
    if (mine !== asked.current) return;
    await collapse();
    setWatching(null);
    setSession(null);
  }, [collapse]);

  // No window for the picture: it goes over the whole display as soon as there is one.
  useEffect(() => {
    if (!windowed && session?.stage === 'live' && !expanded) void expand();
  }, [windowed, session?.stage, expanded, expand]);

  // A window put away is not watched: the game goes back to the room.
  useEffect(() => {
    if (win.min) void back();
  }, [win.min, back]);

  // The window closing (or the desktop going) under a camera gives the display back.
  useEffect(
    () => () => {
      if (now.current.expanded) void setDisplay(false);
      if (now.current.session) void stopCamera();
    },
    [],
  );

  // By area, in the order the server lists them; cameras with no area share one unnamed group.
  const groups = useMemo(() => {
    const out: { area: string; items: Camera[] }[] = [];
    (cameras ?? []).forEach(c => {
      const area = c.area ?? '';
      const g = out.find(x => x.area === area);
      if (g) g.items.push(c);
      else out.push({ area, items: [c] });
    });
    return out;
  }, [cameras]);

  if (session) {
    const list = cameras ?? [];
    return (
      <>
        <FeedWindow
          camera={session.camera}
          stage={session.stage}
          watching={watching}
          cameras={list}
          expanded={expanded}
          onSwitch={id => void watch(id)}
          onControl={controlCamera}
          onExpand={() => void expand()}
          onBack={() => void back()}
          onUnavailable={() => setWindowed(false)}
        />
        {expanded && (
          <CameraView
            camera={session.camera}
            stage={session.stage}
            watching={watching}
            cameras={list}
            windowed={windowed}
            onSwitch={id => void watch(id)}
            onControl={controlCamera}
            onBack={() => void (windowed ? collapse() : back())}
          />
        )}
      </>
    );
  }

  return (
    <div className="relative h-full w-full flex flex-col bg-layer">
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
        <div className="min-w-0">
          <h1 className="text-title font-semibold text-t1 truncate">{t('ui.cameras.title')}</h1>
          <p className="text-caption text-t2">{cameras ? t('ui.cameras.count', cameras.length) : ' '}</p>
        </div>
        <Button icon={loading ? <Spinner size={14} /> : <RefreshCw size={14} />} disabled={loading} onClick={() => void load()}>
          {t('ui.common.refresh')}
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto os-scroll px-6 pb-6">
        {error && (
          <div className="mb-3">
            <InfoBar severity="error" onClose={() => setError(null)}>
              {error}
            </InfoBar>
          </div>
        )}
        {!cameras ? (
          !error && (
            <div className="h-40 flex items-center justify-center">
              <Spinner />
            </div>
          )
        ) : cameras.length === 0 ? (
          <div className="h-[260px]">
            <Empty icon={<Cctv size={40} />} title={t('ui.cameras.empty_title')}>
              {t('ui.cameras.empty_body')}
            </Empty>
          </div>
        ) : (
          groups.map(g => (
            <section key={g.area} className="mb-4 page-in">
              {g.area && <h2 className="text-caption font-semibold text-t2 mb-2">{g.area}</h2>}
              <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
                {g.items.map(c => (
                  <div key={c.id} className="flex items-center gap-3 rounded-win bg-card border border-stroke shadow-card px-4 py-3">
                    <span className="flex items-center justify-center w-9 h-9 rounded-ctl bg-subtle text-accent-text shrink-0">
                      <Cctv size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-body text-t1 truncate">{c.label}</div>
                      <div className="flex items-center gap-1.5 text-caption text-t2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                        {t('ui.cameras.live')}
                      </div>
                    </div>
                    <Button variant="accent" icon={<Eye size={14} />} onClick={() => void watch(c.id)}>
                      {t('ui.cameras.watch')}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
