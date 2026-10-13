import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cctv, Eye, RefreshCw } from 'lucide-react';
import type { AppProps } from '../registry';
import { useNuiEvent } from '@/hooks/useNuiEvent';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { Button, Empty, InfoBar, Spinner } from '@/ui/controls';
import CameraView from './CameraView';
import { controlCamera, startCamera, stopCamera } from './feed';
import type { Camera, Watching } from './types';

// Security Cameras - the cameras this player may watch from this computer (cameras:list), by the
// place they are in. Picking one hands the whole display to its picture: the game's own view goes
// to where the camera is (client/computers/cameras.lua), the desktop steps aside, and CameraView
// draws a slim frame over the picture until the player comes back. Which cameras there are, and
// where each is, is the server's to say; this app only ever names one by id.

export default function Cameras(_props: AppProps) {
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [watching, setWatching] = useState<Watching | null>(null);

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

  // The game says what is on the display: a camera's picture (and whose), or the desktop again -
  // also when it was not us who ended it (the computer closing under a camera).
  useNuiEvent<Watching & { active: boolean }>('computers:camera', d => setWatching(d && d.active ? d : null));

  const watch = useCallback(async (id: string) => {
    setOpening(id);
    const res = await startCamera(id);
    setOpening(null);
    if (!res.ok) setError(res.error || t('ui.common.error'));
    else setError(null);
  }, []);

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
                    <Button variant="accent" icon={opening === c.id ? <Spinner size={14} className="!text-accent-on" /> : <Eye size={14} />} disabled={opening !== null} onClick={() => void watch(c.id)}>
                      {t('ui.cameras.watch')}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {watching && <CameraView watching={watching} cameras={cameras ?? []} onSwitch={id => void watch(id)} onControl={controlCamera} onBack={() => void stopCamera()} />}
    </div>
  );
}
