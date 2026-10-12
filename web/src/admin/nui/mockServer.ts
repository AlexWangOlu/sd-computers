import type { Computer, Placed, Reply, Snapshot } from '@/admin/types';

// The panel in a browser tab (npm run dev -> /admin.html): a stand-in for the game and the server,
// so every tab, dialog and toast can be worked on without either. Placing "runs the gizmo" by
// hiding the panel for a moment, then bringing it back with the computer placed.

let nextId = 3;

let computers: Computer[] = [
  { key: 'mrpd_frontdesk', order: 1, source: 'config', label: 'MRPD Front Desk', hostname: 'LSPD-MRPD-FD01', style: 'retro', styleSet: true, x: 441.2, y: -978.9, z: 30.9, heading: 0, groups: { police: 0 }, boss: 'police', pin: true, users: ['Jessica Hale'] },
  { key: 'pillbox_reception', order: 2, source: 'config', label: 'Pillbox Reception', hostname: 'PILLBOX-RECEP01', style: 'modern', styleSet: true, x: 310.9, y: -597.4, z: 43.4, heading: 340, groups: { ambulance: 0 }, boss: 'ambulance', pin: false, users: [] },
  {
    key: 'public_pc', order: 3, source: 'model', label: 'Computer', hostname: 'LS-WORKSTATION', style: 'modern', styleSet: false, pin: false, users: ['Mike Rodriguez', 'Ana Flores'],
    models: ['prop_monitor_01a', 'prop_monitor_01b', 'prop_monitor_02', 'prop_monitor_03b', 'prop_monitor_w_large', 'prop_dyn_pc', 'prop_dyn_pc_02', 'prop_pc_01a', 'prop_pc_02a'],
  },
  { key: 'business_laptop', order: 4, source: 'model', label: 'Business Laptop', hostname: 'BIZ-LAPTOP', style: 'mac', styleSet: true, boss: '*', pin: false, users: [], models: ['prop_laptop_01a', 'p_laptop_02_s', 'prop_laptop_lester', 'prop_laptop_lester2'] },
  { key: 'placed_1', order: 5, id: 1, source: 'placed', label: 'Mechanic office', hostname: 'MECHANIC-OFF-01', style: 'mac', styleSet: true, prop: 'prop_laptop_01a', x: -339.6, y: -156.9, z: 39.8, heading: 87, groups: { mechanic: 2 }, pin: false, users: [] },
  { key: 'placed_2', order: 6, id: 2, source: 'placed', label: 'Vanilla Unicorn back room', hostname: 'VANILLA-UNIC-02', style: 'modern', styleSet: false, prop: 'prop_monitor_01a', x: 95.4, y: -1294.1, z: 29.6, heading: 211.5, pin: false, users: ['Devon Price'] },
];

export const mockSnapshot = (): Snapshot => ({
  canEdit: true,
  computers: computers.map((c, i) => ({ ...c, order: i + 1 })),
  props: [
    { model: 'prop_monitor_01a', label: 'Flat monitor', kind: 'monitor' },
    { model: 'prop_monitor_01b', label: 'Flat monitor (off)', kind: 'monitor' },
    { model: 'prop_monitor_02', label: 'HD monitor', kind: 'monitor' },
    { model: 'prop_monitor_03b', label: 'CRT monitor', kind: 'monitor' },
    { model: 'prop_monitor_w_large', label: 'Widescreen monitor', kind: 'monitor' },
    { model: 'prop_dyn_pc', label: 'Tower PC', kind: 'tower' },
    { model: 'prop_dyn_pc_02', label: 'Tower PC (dark)', kind: 'tower' },
    { model: 'prop_pc_01a', label: 'Tower PC (beige)', kind: 'tower' },
    { model: 'prop_pc_02a', label: 'Tower PC (silver)', kind: 'tower' },
    { model: 'prop_laptop_01a', label: 'Laptop', kind: 'laptop' },
    { model: 'p_laptop_02_s', label: 'Laptop (white keys)', kind: 'laptop' },
    { model: 'prop_laptop_lester', label: 'Laptop (browsing)', kind: 'laptop' },
    { model: 'prop_laptop_lester2', label: 'Laptop (idle)', kind: 'laptop' },
  ],
  styles: [
    { key: 'modern', name: 'SD OS Pro', build: '4.2.2610', wallpaper: 'petals-dark', accent: '#4cc2ff', theme: 'dark', wallpapers: ['Petals (dark)', 'Petals (light)', 'Nebula', 'Dusk', 'Currents', 'Solid colour'], default: true },
    { key: 'mac', name: 'SD OS Harbor', build: '2.6', wallpaper: 'harbor-dunes', accent: '#0a84ff', theme: 'light', wallpapers: ['Dunes', 'Tide', 'Aurora', 'Graphite'], default: false },
    { key: 'retro', name: 'SD Desktop', build: '3.11', wallpaper: 'retro-teal', accent: '#000080', theme: 'light', wallpapers: ['Teal', 'Weave', 'Bricks', 'Starfield', 'Midnight'], default: false },
  ],
  defaultStyle: 'modern',
  rules: { boot: true, reach: 2.5, maxLabel: 48 },
  refreshMs: 5000,
});

const ok = <T extends object>(data?: T): Reply<T & { snapshot: Snapshot }> => ({ success: true, data: { ...(data as T), snapshot: mockSnapshot() } });
const fail = (message: string): Reply<{ snapshot: Snapshot }> => ({ success: false, message, data: { snapshot: mockSnapshot() } });

const hostname = (label: string, id: number) => `${label.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 12).replace(/-+$/, '') || 'PC'}-${String(id).padStart(2, '0')}`;

type Fields = { id?: number; label?: string; prop?: string; style?: string | null; jobs?: Record<string, number> | null };

const applyFields = (c: Computer, d: Fields): Computer => ({
  ...c,
  label: d.label ?? c.label,
  hostname: d.label && d.label !== c.label ? hostname(d.label, c.id ?? 0) : c.hostname,
  prop: d.prop ?? c.prop,
  style: d.style || 'modern',
  styleSet: !!d.style,
  groups: d.jobs ?? null,
});

// What the game does around the gizmo: hide the panel, then show it again with the outcome.
const afterGizmo = (placed: Placed) => {
  window.postMessage({ action: 'computers:admin:hide' }, '*');
  window.setTimeout(() => window.postMessage({ action: 'computers:admin:show', data: { snapshot: mockSnapshot(), placed } }, '*'), 900);
};

export async function mockNui(callback: string, data: unknown): Promise<unknown> {
  await new Promise(resolve => window.setTimeout(resolve, 140));
  const d = (data ?? {}) as Fields;
  switch (callback.replace('computers:admin:', '')) {
    case 'snapshot':
      return ok();
    case 'close':
      // (a browser tab has nowhere to close to: come straight back, as reopening it in the game would)
      window.setTimeout(() => window.postMessage({ action: 'computers:admin:open', data: { snapshot: mockSnapshot() } }, '*'), 700);
      return { ok: true };
    case 'teleport':
      return ok();
    case 'updatecomputer': {
      const c = computers.find(x => x.id === d.id);
      if (!c) return fail('That no longer exists');
      computers = computers.map(x => (x === c ? applyFields(c, d) : x));
      return ok();
    }
    case 'deletecomputer':
      if (!computers.some(x => x.id === d.id)) return fail('That no longer exists');
      computers = computers.filter(x => x.id !== d.id);
      return ok();
    case 'deleteallcomputers': {
      const count = computers.filter(x => x.source === 'placed').length;
      computers = computers.filter(x => x.source !== 'placed');
      return ok({ count });
    }
    case 'placecomputer': {
      const id = nextId++;
      const base: Computer = { key: `placed_${id}`, order: 0, id, source: 'placed', label: 'Computer', hostname: '', style: 'modern', styleSet: false, x: 120.5 + id * 3.1, y: -1040.2 - id * 2.4, z: 29.3, heading: (id * 47) % 360, pin: false, users: [] };
      computers = [...computers, applyFields({ ...base, hostname: hostname(d.label ?? 'Computer', id) }, d)];
      afterGizmo({ what: 'computer', action: 'placed', success: true });
      return { ok: true };
    }
    case 'movecomputer': {
      computers = computers.map(x => (x.id === d.id ? { ...x, x: (x.x ?? 0) + 1.25, heading: ((x.heading ?? 0) + 15) % 360 } : x));
      afterGizmo({ what: 'computer', action: 'moved', success: true });
      return { ok: true };
    }
    default:
      return fail(`Unknown verb ${callback}`);
  }
}
