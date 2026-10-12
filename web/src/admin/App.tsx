import { useEffect } from 'react';
import { useNuiEvent } from '@/hooks/useNuiEvent';
import { useAdmin } from '@/admin/store/admin';
import { isEnvBrowser } from '@/admin/nui/bridge';
import { close, refresh } from '@/admin/nui/api';
import { setLocale } from '@/admin/i18n';
import { AdminPanel } from '@/admin/features/admin/AdminPanel';
import { PlacementHud, usePlacer } from '@/admin/features/admin/PlacementHud';
import type { PlacerHud } from '@/admin/features/admin/PlacementHud';
import type { Placed, Snapshot } from '@/admin/types';

// Tell the page that holds us (web/src/AdminFrame.tsx) whether we want the mouse. The frame covers
// the whole screen, so it must only take clicks while the panel is really up - never over the
// computer's own screen, and never while the gizmo's HUD (which is look-only) is showing.
const announce = (interactive: boolean) => {
  if (window.parent !== window) window.parent.postMessage({ source: 'sd-computers-admin', interactive }, '*');
};

export default function App() {
  const open = useAdmin(s => s.open);
  const hidden = useAdmin(s => s.hidden);
  const placing = usePlacer(s => s.hud.active);
  const refreshMs = useAdmin(s => s.snapshot?.refreshMs ?? 5000);

  useNuiEvent<{ snapshot: Snapshot }>('computers:admin:open', d => useAdmin.getState().openWith(d.snapshot));
  useNuiEvent('computers:admin:hide', () => useAdmin.getState().hide());
  useNuiEvent<{ snapshot?: Snapshot | null; placed?: Placed | null }>('computers:admin:show', d => useAdmin.getState().show(d?.snapshot, d?.placed));
  useNuiEvent('computers:admin:close', () => useAdmin.getState().close());
  useNuiEvent<{ strings?: Record<string, string> }>('computers:admin:locale', d => setLocale(d?.strings));
  useNuiEvent<PlacerHud>('computers:placer:hud', d => usePlacer.getState().set(d ?? { active: false }));

  const visible = open && !hidden;
  useEffect(() => announce(visible), [visible]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useAdmin.getState().open && !useAdmin.getState().hidden) void close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // People sit down at computers and get up again while the panel is open: keep the snapshot fresh.
  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => !useAdmin.getState().busy && !document.querySelector('[data-modal]') && void refresh(), refreshMs);
    return () => window.clearInterval(id);
  }, [visible, refreshMs]);

  useEffect(() => {
    if (!isEnvBrowser()) return;
    void import('@/admin/nui/mockServer').then(({ mockSnapshot }) => useAdmin.getState().openWith(mockSnapshot()));
  }, []);

  if (placing && !visible) return <PlacementHud />;
  if (!visible) return null;
  return <AdminPanel />;
}
