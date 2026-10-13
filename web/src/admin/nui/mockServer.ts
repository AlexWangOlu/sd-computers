import type { Auto, Computer, Placed, Prop, Reply, Snapshot } from '@/admin/types';

// The panel in a browser tab (npm run dev -> /admin.html): a stand-in for the game and the server,
// so every tab, dialog and toast can be worked on without either. Placing "runs the gizmo" by
// hiding the panel for a moment, then bringing it back with the computer placed.

let nextId = 4;

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
  { key: 'placed_3', order: 7, id: 3, source: 'world', label: 'Booking desk', hostname: 'BOOKING-DESK-03', style: 'retro', styleSet: true, prop: 'prop_monitor_03b', x: 461.0, y: -988.4, z: 24.8, heading: 300, groups: { police: 0 }, pin: false, users: [] },
];

// The props that are a computer on their own, as the Automatic tab has them.
let auto: Auto = {
  enabled: true,
  computers: computers
    .filter(c => c.source === 'model')
    .map(c => ({ key: c.key, label: c.label, enabled: true, base: c.styleSet ? c.style : null, models: (c.models ?? []).map(model => ({ model, on: true, own: true })) })),
};
const autoModels = (key: string) => auto.computers.find(a => a.key === key);

// The props a computer can be placed as: the config's, then the ones added from the panel.
let props: Prop[] = [
  { model: 'prop_monitor_01a', label: 'Flat monitor', kind: 'monitor' },
  { model: 'prop_monitor_01b', label: 'Flat monitor (off)', kind: 'monitor' },
  { model: 'prop_monitor_02', label: 'HD monitor', kind: 'monitor' },
  { model: 'prop_monitor_03b', label: 'CRT monitor', kind: 'monitor' },
  { model: 'prop_monitor_w_large', label: 'Widescreen monitor', kind: 'monitor' },
  { model: 'prop_monitor_04a', label: 'Widescreen monitor (browser)', kind: 'monitor' },
  { model: 'ex_prop_monitor_01_ex', label: 'All-in-one', kind: 'monitor' },
  { model: 'v_serv_ct_monitor01', label: 'Control room monitor', kind: 'monitor' },
  { model: 'prop_dyn_pc', label: 'Tower PC', kind: 'tower' },
  { model: 'prop_dyn_pc_02', label: 'Tower PC (dark)', kind: 'tower' },
  { model: 'prop_pc_01a', label: 'Tower PC (beige)', kind: 'tower' },
  { model: 'prop_pc_02a', label: 'Tower PC (silver)', kind: 'tower' },
  { model: 'prop_laptop_01a', label: 'Laptop', kind: 'laptop' },
  { model: 'p_laptop_02_s', label: 'Laptop (white keys)', kind: 'laptop' },
  { model: 'prop_laptop_lester', label: 'Laptop (browsing)', kind: 'laptop' },
  { model: 'prop_laptop_lester2', label: 'Laptop (idle)', kind: 'laptop' },
  { model: 'xm_prop_x17_laptop_lester_01', label: 'Gaming laptop', kind: 'laptop' },
];

export const mockSnapshot = (): Snapshot => ({
  canEdit: true,
  computers: computers.map((c, i) => {
    const a = c.source === 'model' ? autoModels(c.key) : undefined;
    const models = a ? a.models.filter(m => m.on).map(m => m.model) : c.models;
    return { ...c, order: i + 1, models, off: a ? !auto.enabled || !a.enabled || models?.length === 0 : undefined, style: a?.style ?? c.style, styleSet: a ? !!a.style || c.styleSet : c.styleSet };
  }),
  props,
  auto,
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

type Fields = { id?: number; label?: string; prop?: string; style?: string | null; jobs?: Record<string, number> | null; key?: string; model?: string; enabled?: boolean; kind?: Prop['kind'] };

const applyFields = (c: Computer, d: Fields): Computer => ({
  ...c,
  label: d.label ?? c.label,
  hostname: d.label && d.label !== c.label ? hostname(d.label, c.id ?? 0) : c.hostname,
  prop: c.source === 'world' ? c.prop : (d.prop ?? c.prop), // (a picked prop is the game's: it stays what it is)
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
      const count = computers.filter(x => x.source === 'placed' || x.source === 'world').length;
      computers = computers.filter(x => x.source !== 'placed' && x.source !== 'world');
      return ok({ count });
    }
    case 'placecomputer': {
      const id = nextId++;
      const base: Computer = { key: `placed_${id}`, order: 0, id, source: 'placed', label: 'Computer', hostname: '', style: 'modern', styleSet: false, x: 120.5 + id * 3.1, y: -1040.2 - id * 2.4, z: 29.3, heading: (id * 47) % 360, pin: false, users: [] };
      computers = [...computers, applyFields({ ...base, hostname: hostname(d.label ?? 'Computer', id) }, d)];
      afterGizmo({ what: 'computer', action: 'placed', success: true });
      return { ok: true };
    }
    case 'pickcomputer': {
      // (the admin "aimed at" a widescreen monitor somewhere)
      const id = nextId++;
      const base: Computer = { key: `placed_${id}`, order: 0, id, source: 'world', label: 'Computer', hostname: '', style: 'modern', styleSet: false, prop: 'prop_monitor_w_large', x: 446.9, y: -974.7 - id, z: 30.4, heading: 165, pin: false, users: [] };
      computers = [...computers, applyFields({ ...base, hostname: hostname(d.label ?? 'Computer', id) }, { ...d, prop: undefined })];
      afterGizmo({ what: 'computer', action: 'picked', success: true });
      return { ok: true };
    }
    case 'setauto':
      auto = { ...auto, enabled: d.enabled === true };
      return ok();
    case 'setautocomputer':
      if (!autoModels(d.key ?? '')) return fail('That no longer exists');
      auto = { ...auto, computers: auto.computers.map(a => (a.key === d.key ? { ...a, enabled: d.enabled === true } : a)) };
      return ok();
    case 'setautomodel':
      if (!autoModels(d.key ?? '')?.models.some(m => m.model === d.model)) return fail('That request made no sense');
      auto = { ...auto, computers: auto.computers.map(a => (a.key === d.key ? { ...a, models: a.models.map(m => (m.model === d.model ? { ...m, on: d.enabled === true } : m)) } : a)) };
      return ok();
    case 'setautostyle':
      if (!autoModels(d.key ?? '')) return fail('That no longer exists');
      auto = { ...auto, computers: auto.computers.map(c => (c.key === d.key ? { ...c, style: d.style || null } : c)) };
      return ok();
    case 'setautomodelstyle':
      auto = { ...auto, computers: auto.computers.map(c => (c.key === d.key ? { ...c, models: c.models.map(m => (m.model === d.model ? { ...m, style: d.style || null } : m)) } : c)) };
      return ok();
    case 'addprop': {
      if (!d.model || props.some(x => x.model === d.model)) return fail('That prop is already on the list');
      if (d.model.includes('nope')) return fail(`The game has no prop called ${d.model}`);
      props = [...props, { model: d.model, label: d.label || d.model, kind: d.kind, custom: true }];
      // (a prop nobody lists is offered to every model computer, off)
      auto = { ...auto, computers: auto.computers.map(c => ({ ...c, models: [...c.models, { model: d.model!, on: false, own: false }] })) };
      return ok();
    }
    case 'removeprop':
      if (computers.some(x => x.prop === d.model)) return fail('A computer is placed as that prop - delete it first');
      props = props.filter(x => !(x.custom && x.model === d.model));
      auto = { ...auto, computers: auto.computers.map(c => ({ ...c, models: c.models.filter(m => m.own || m.model !== d.model) })) };
      return ok();
    case 'movecomputer': {
      computers = computers.map(x => (x.id === d.id ? { ...x, x: (x.x ?? 0) + 1.25, heading: ((x.heading ?? 0) + 15) % 360 } : x));
      afterGizmo({ what: 'computer', action: 'moved', success: true });
      return { ok: true };
    }
    default:
      return fail(`Unknown verb ${callback}`);
  }
}
