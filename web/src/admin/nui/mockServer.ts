import type { Auto, Camera, Computer, Job, Placed, Printer, Prop, Reply, Snapshot } from '@/admin/types';

// The panel in a browser tab (npm run dev -> /admin.html): a stand-in for the game and the server,
// so every tab, dialog and toast can be worked on without either. Placing "runs the gizmo" by
// hiding the panel for a moment, then bringing it back with the computer placed.

let nextId = 4;

let computers: Computer[] = [
  { key: 'mrpd_frontdesk', order: 1, source: 'config', label: '米申罗警局前台', hostname: 'LSPD-MRPD-FD01', style: 'retro', styleSet: true, x: 441.2, y: -978.9, z: 30.9, heading: 0, groups: { police: 0 }, boss: 'police', pin: true, users: ['Jessica Hale'] },
  { key: 'pillbox_reception', order: 2, source: 'config', label: '圆堡山医疗中心接待处', hostname: 'PILLBOX-RECEP01', style: 'modern', styleSet: true, x: 310.9, y: -597.4, z: 43.4, heading: 340, groups: { ambulance: 0 }, boss: 'ambulance', pin: false, users: [] },
  {
    key: 'public_pc', order: 3, source: 'model', label: '电脑', hostname: 'LS-WORKSTATION', style: 'modern', styleSet: false, pin: false, users: ['Mike Rodriguez', 'Ana Flores'],
    models: ['prop_monitor_01a', 'prop_monitor_01b', 'prop_monitor_02', 'prop_monitor_03b', 'prop_monitor_w_large', 'prop_monitor_04a', 'ex_prop_monitor_01_ex', 'v_serv_ct_monitor01'],
  },
  { key: 'business_laptop', order: 4, source: 'model', label: '商用笔记本', hostname: 'BIZ-LAPTOP', style: 'mac', styleSet: true, boss: '*', pin: false, users: [], models: ['prop_laptop_01a', 'p_laptop_02_s', 'prop_laptop_lester', 'prop_laptop_lester2'] },
  { key: 'placed_1', order: 5, id: 1, source: 'placed', label: '修车行办公室', hostname: 'MECHANIC-OFF-01', style: 'mac', styleSet: true, prop: 'prop_laptop_01a', x: -339.6, y: -156.9, z: 39.8, heading: 87, groups: { mechanic: 2 }, boss: 'mechanic', pin: false, users: [] },
  { key: 'placed_2', order: 6, id: 2, source: 'placed', label: 'Vanilla Unicorn 后室', hostname: 'VANILLA-UNIC-02', style: 'modern', styleSet: false, prop: 'prop_monitor_01a', x: 95.4, y: -1294.1, z: 29.6, heading: 211.5, pin: false, users: ['Devon Price'] },
  { key: 'placed_3', order: 7, id: 3, source: 'world', label: '收押登记台', hostname: 'BOOKING-DESK-03', style: 'retro', styleSet: true, prop: 'prop_monitor_03b', x: 461.0, y: -988.4, z: 24.8, heading: 300, groups: { police: 0 }, pin: false, users: [] },
];

// The printers: stood from the panel, or picked.
let nextPrinter = 3;
let printers: Printer[] = [
  { id: 1, label: '前台打印机', prop: 'prop_printer_01', x: 443.1, y: -980.2, z: 30.7, heading: 90, waiting: 3 },
  { id: 2, label: '档案室复印机', prop: 'prop_copier_01', world: true, x: 452.6, y: -985.9, z: 30.7, heading: 180, waiting: 0 },
];
const PRINTER_PROPS = [
  { model: 'prop_printer_01', label: '激光打印机' },
  { model: 'prop_printer_02', label: '桌面打印机' },
  { model: 'v_res_printer', label: '家用打印机' },
  { model: 'prop_copier_01', label: '复印机' },
];

// The security cameras: the config's, then the ones put up from the panel.
let nextCamera = 3;
let cameras: Camera[] = [
  { key: 'mrpd_lobby', source: 'config', label: '大厅', area: '米申罗警局', x: 435.7, y: -987.5, z: 33.8, pitch: -20, yaw: -32, fov: 70, groups: { police: 0 } },
  { key: 'mrpd_entrance', source: 'config', label: '正门', area: '米申罗警局', x: 433.4, y: -976.6, z: 34.3, pitch: -24, yaw: 150, fov: 75, groups: { police: 0 } },
  { key: 'pillbox_reception', source: 'config', label: '接待处', area: '圆堡山医疗中心', x: 303.9, y: -590.6, z: 46.0, pitch: -22, yaw: -145, fov: 70, groups: { ambulance: 0 }, computers: ['pillbox_reception'] },
  { key: 'placed_cam_1', id: 1, source: 'placed', label: '车间', area: "Benny's Original Motor Works", x: -211.4, y: -1324.8, z: 34.2, pitch: -28, yaw: 96, fov: 80, groups: { mechanic: 2 } },
  { key: 'placed_cam_2', id: 2, source: 'placed', label: '军团广场', area: null, x: 190.2, y: -938.6, z: 38.9, pitch: -15, yaw: -60, fov: 60 },
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
  { model: 'prop_monitor_01a', label: '平面显示器', kind: 'monitor' },
  { model: 'prop_monitor_01b', label: '平面显示器（关机）', kind: 'monitor' },
  { model: 'prop_monitor_02', label: '高清显示器', kind: 'monitor' },
  { model: 'prop_monitor_03b', label: 'CRT 显示器', kind: 'monitor' },
  { model: 'prop_monitor_w_large', label: '宽屏显示器', kind: 'monitor' },
  { model: 'prop_monitor_04a', label: '宽屏显示器（网页）', kind: 'monitor' },
  { model: 'ex_prop_monitor_01_ex', label: '一体机', kind: 'monitor' },
  { model: 'v_serv_ct_monitor01', label: '控制室显示器', kind: 'monitor' },
  { model: 'prop_laptop_01a', label: '笔记本', kind: 'laptop' },
  { model: 'p_laptop_02_s', label: '笔记本（白色键盘）', kind: 'laptop' },
  { model: 'prop_laptop_lester', label: '笔记本（浏览网页）', kind: 'laptop' },
  { model: 'prop_laptop_lester2', label: '笔记本（待机）', kind: 'laptop' },
  { model: 'xm_prop_x17_laptop_lester_01', label: '游戏笔记本', kind: 'laptop' },
];

// Which props have a screen: every one the config ships has one measured; one added from the panel
// has none until it is drawn.
let screens: Snapshot['screens'] = Object.fromEntries(props.map(p => [p.model, 'config' as const]));

// The framework's jobs, by label (a job nobody is boss of cannot be given the Business Manager).
const jobs: Job[] = [
  { name: 'ambulance', label: 'EMS', boss: true },
  { name: 'bus', label: 'Bus', boss: false },
  { name: 'cardealer', label: 'Vehicle Dealer', boss: true },
  { name: 'unemployed', label: 'Civilian', boss: false },
  { name: 'judge', label: 'Honorary', boss: false },
  { name: 'lawyer', label: 'Law Firm', boss: true },
  { name: 'police', label: 'LSPD', boss: true },
  { name: 'mechanic', label: 'Mechanic', boss: true },
  { name: 'realestate', label: 'Real Estate', boss: true },
  { name: 'reporter', label: 'Reporter', boss: true },
  { name: 'bcso', label: 'Sheriff', boss: true },
  { name: 'taxi', label: 'Taxi', boss: true },
  { name: 'tow', label: 'Towing', boss: false },
].sort((a, b) => a.label.localeCompare(b.label));

export const mockSnapshot = (): Snapshot => ({
  canEdit: true,
  computers: computers.map((c, i) => {
    const a = c.source === 'model' ? autoModels(c.key) : undefined;
    const models = a ? a.models.filter(m => m.on).map(m => m.model) : c.models;
    return { ...c, order: i + 1, models, off: a ? !auto.enabled || !a.enabled || models?.length === 0 : undefined, style: a?.style ?? c.style, styleSet: a ? !!a.style || c.styleSet : c.styleSet };
  }),
  cameras: { enabled: true, max: 200, list: cameras },
  printers: { enabled: true, max: 200, range: 30, item: 'printed_document', props: PRINTER_PROPS, list: printers },
  props,
  screens,
  auto,
  styles: [
    { key: 'modern', name: 'SD OS Pro', build: '4.2.2610', wallpaper: 'petals-dark', accent: '#4cc2ff', theme: 'dark', wallpapers: ['花瓣（深色）', '花瓣（浅色）', '星云', '黄昏', '洋流', '纯色'], default: true },
    { key: 'mac', name: 'SD OS Harbor', build: '2.6', wallpaper: 'harbor-dunes', accent: '#0a84ff', theme: 'light', wallpapers: ['沙丘', '潮汐', '极光', '石墨'], default: false },
    { key: 'retro', name: 'SD Desktop', build: '3.11', wallpaper: 'retro-teal', accent: '#000080', theme: 'light', wallpapers: ['青绿', '编织', '砖块', '星空', '午夜'], default: false },
  ],
  jobs,
  boss: { available: true },
  defaultStyle: 'modern',
  rules: { boot: true, reach: 2.5, maxLabel: 48 },
  refreshMs: 5000,
});

const ok = <T extends object>(data?: T): Reply<T & { snapshot: Snapshot }> => ({ success: true, data: { ...(data as T), snapshot: mockSnapshot() } });
const fail = (message: string): Reply<{ snapshot: Snapshot }> => ({ success: false, message, data: { snapshot: mockSnapshot() } });

const hostname = (label: string, id: number) => `${label.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 12).replace(/-+$/, '') || 'PC'}-${String(id).padStart(2, '0')}`;

type Fields = { id?: number; label?: string; prop?: string; style?: string | null; jobs?: Record<string, number> | null; boss?: string | null; key?: string; model?: string; enabled?: boolean; kind?: Prop['kind']; area?: string | null };

// What the game does around the camera tool: hide the panel, show its HUD for a moment, then bring
// the panel back with the outcome.
const afterCamtool = (moving: boolean, placed: Placed) => {
  window.postMessage({ action: 'computers:admin:hide' }, '*');
  window.postMessage({ action: 'computers:camtool:hud', data: { active: true, moving, x: 190.2, y: -938.6, z: 38.9, pitch: -18, yaw: -60, fov: 62.5 } }, '*');
  window.setTimeout(() => {
    window.postMessage({ action: 'computers:camtool:hud', data: { active: false } }, '*');
    window.postMessage({ action: 'computers:admin:show', data: { snapshot: mockSnapshot(), placed } }, '*');
  }, 2500);
};

const applyFields = (c: Computer, d: Fields): Computer => ({
  ...c,
  label: d.label ?? c.label,
  hostname: d.label && d.label !== c.label ? hostname(d.label, c.id ?? 0) : c.hostname,
  prop: c.source === 'world' ? c.prop : (d.prop ?? c.prop), // (a picked prop is the game's: it stays what it is)
  style: d.style || 'modern',
  styleSet: !!d.style,
  groups: d.jobs ?? null,
  boss: d.boss ?? null,
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
      if (!c) return fail('该目标已不存在。');
      computers = computers.map(x => (x === c ? applyFields(c, d) : x));
      return ok();
    }
    case 'deletecomputer':
      if (!computers.some(x => x.id === d.id)) return fail('该目标已不存在。');
      computers = computers.filter(x => x.id !== d.id);
      return ok();
    case 'removeconfigcomputer':
    case 'restoreconfigcomputer': {
      // (one of the config's locations: taken away, or put back - it stays in the list either way)
      const c = computers.find(x => x.key === d.key && x.source === 'config');
      if (!c) return fail('该目标已不存在。');
      const removed = callback.endsWith('removeconfigcomputer');
      computers = computers.map(x => (x === c ? { ...c, removed, users: removed ? [] : c.users } : x));
      return ok();
    }
    case 'teleportcamera':
    case 'teleportprinter':
      return ok();
    case 'placeprinter':
    case 'pickprinter': {
      const id = nextPrinter++;
      const world = callback.endsWith('pickprinter');
      printers = [...printers, { id, label: d.label || '打印机', prop: world ? 'prop_printer_02' : (d.prop ?? 'prop_printer_01'), world: world || undefined, x: 120.5 + id * 3.1, y: -1040.2 - id * 2.4, z: 29.3, heading: (id * 47) % 360, waiting: 0 }];
      afterGizmo({ what: 'printer', action: world ? 'picked' : 'placed', success: true });
      return { ok: true };
    }
    case 'moveprinter': {
      printers = printers.map(p => (p.id === d.id ? { ...p, x: p.x + 1.5, heading: (p.heading + 90) % 360 } : p));
      afterGizmo({ what: 'printer', action: 'moved', success: true });
      return { ok: true };
    }
    case 'updateprinter': {
      const p = printers.find(x => x.id === d.id);
      if (!p) return fail('该目标已不存在。');
      printers = printers.map(x => (x === p ? { ...p, label: d.label ?? p.label, prop: p.world ? p.prop : (d.prop ?? p.prop) } : x));
      return ok();
    }
    case 'deleteprinter':
      if (!printers.some(x => x.id === d.id)) return fail('该目标已不存在。');
      printers = printers.filter(x => x.id !== d.id);
      return ok();
    case 'placecamera': {
      const id = nextCamera++;
      cameras = [...cameras, { key: `placed_cam_${id}`, id, source: 'placed', label: d.label || '摄像头', area: d.area || null, x: 120.5 + id * 3.1, y: -1040.2 - id * 2.4, z: 33.3, pitch: -18, yaw: (id * 47) % 360 - 180, fov: 62.5, groups: d.jobs ?? null }];
      afterCamtool(false, { what: 'camera', action: 'placed', success: true });
      return { ok: true };
    }
    case 'movecamera': {
      cameras = cameras.map(c => (c.id === d.id ? { ...c, x: c.x + 1.5, pitch: -18, fov: 62.5 } : c));
      afterCamtool(true, { what: 'camera', action: 'moved', success: true });
      return { ok: true };
    }
    case 'updatecamera': {
      const c = cameras.find(x => x.id === d.id && x.source === 'placed');
      if (!c) return fail('该目标已不存在。');
      cameras = cameras.map(x => (x === c ? { ...c, label: d.label ?? c.label, area: d.area || null, groups: d.jobs ?? null } : x));
      return ok();
    }
    case 'deletecamera':
      if (!cameras.some(x => x.id === d.id && x.source === 'placed')) return fail('该目标已不存在。');
      cameras = cameras.filter(x => x.id !== d.id);
      return ok();
    case 'removeconfigcamera':
    case 'restoreconfigcamera': {
      // (one of the config's cameras: taken away, or put back - it stays in the list either way)
      const c = cameras.find(x => x.key === d.key && x.source === 'config');
      if (!c) return fail('该目标已不存在。');
      cameras = cameras.map(x => (x === c ? { ...c, removed: callback.endsWith('removeconfigcamera') } : x));
      return ok();
    }
    case 'deleteallcomputers': {
      const count = computers.filter(x => x.source === 'placed' || x.source === 'world').length;
      computers = computers.filter(x => x.source !== 'placed' && x.source !== 'world');
      return ok({ count });
    }
    case 'placecomputer': {
      const id = nextId++;
      const base: Computer = { key: `placed_${id}`, order: 0, id, source: 'placed', label: '电脑', hostname: '', style: 'modern', styleSet: false, x: 120.5 + id * 3.1, y: -1040.2 - id * 2.4, z: 29.3, heading: (id * 47) % 360, pin: false, users: [] };
      computers = [...computers, applyFields({ ...base, hostname: hostname(d.label ?? '电脑', id) }, d)];
      afterGizmo({ what: 'computer', action: 'placed', success: true });
      return { ok: true };
    }
    case 'pickcomputer': {
      // (the admin "aimed at" a widescreen monitor somewhere)
      const id = nextId++;
      const base: Computer = { key: `placed_${id}`, order: 0, id, source: 'world', label: '电脑', hostname: '', style: 'modern', styleSet: false, prop: 'prop_monitor_w_large', x: 446.9, y: -974.7 - id, z: 30.4, heading: 165, pin: false, users: [] };
      computers = [...computers, applyFields({ ...base, hostname: hostname(d.label ?? '电脑', id) }, { ...d, prop: undefined })];
      afterGizmo({ what: 'computer', action: 'picked', success: true });
      return { ok: true };
    }
    case 'setauto':
      auto = { ...auto, enabled: d.enabled === true };
      return ok();
    case 'setautocomputer':
      if (!autoModels(d.key ?? '')) return fail('该目标已不存在。');
      auto = { ...auto, computers: auto.computers.map(a => (a.key === d.key ? { ...a, enabled: d.enabled === true } : a)) };
      return ok();
    case 'setautomodel':
      if (!autoModels(d.key ?? '')?.models.some(m => m.model === d.model)) return fail('该请求无效。');
      auto = { ...auto, computers: auto.computers.map(a => (a.key === d.key ? { ...a, models: a.models.map(m => (m.model === d.model ? { ...m, on: d.enabled === true } : m)) } : a)) };
      return ok();
    case 'setautostyle':
      if (!autoModels(d.key ?? '')) return fail('该目标已不存在。');
      auto = { ...auto, computers: auto.computers.map(c => (c.key === d.key ? { ...c, style: d.style || null } : c)) };
      return ok();
    case 'setautomodelstyle':
      auto = { ...auto, computers: auto.computers.map(c => (c.key === d.key ? { ...c, models: c.models.map(m => (m.model === d.model ? { ...m, style: d.style || null } : m)) } : c)) };
      return ok();
    case 'addprop': {
      if (!d.model || props.some(x => x.model === d.model)) return fail('该道具已在列表中。');
      if (d.model.includes('nope')) return fail(`游戏里没有名为 ${d.model} 的道具。`);
      props = [...props, { model: d.model, label: d.label || d.model, kind: d.kind, custom: true }];
      // (a prop nobody lists is offered to every model computer, off)
      auto = { ...auto, computers: auto.computers.map(c => ({ ...c, models: [...c.models, { model: d.model!, on: false, own: false }] })) };
      return ok();
    }
    case 'removeprop':
      if (computers.some(x => x.prop === d.model)) return fail('该道具上已放置了一台电脑，请先删除它。');
      props = props.filter(x => !(x.custom && x.model === d.model));
      auto = { ...auto, computers: auto.computers.map(c => ({ ...c, models: c.models.filter(m => m.own || m.model !== d.model) })) };
      return ok();
    case 'setupscreen': {
      // (the screen tool: its HUD shows over nothing here, for as long as a quick drawing takes)
      const label = props.find(x => x.model === d.model)?.label ?? d.model;
      window.postMessage({ action: 'computers:admin:hide' }, '*');
      window.postMessage(
        { action: 'computers:screener:hud', data: { active: true, label, model: d.model, x: -0.0015, y: -0.066, z: 0.313, w: 0.429, h: 0.315, tilt: 4.9, heading: 0, drawn: true, over: 'resize', view: 'front', picture: true, canUndo: true } },
        '*',
      );
      window.setTimeout(() => {
        screens = { ...screens, [d.model!]: 'custom' };
        window.postMessage({ action: 'computers:screener:hud', data: { active: false } }, '*');
        window.postMessage({ action: 'computers:admin:show', data: { snapshot: mockSnapshot(), placed: { what: 'screen', action: 'saved', success: true } } }, '*');
      }, 2500);
      return { ok: true };
    }
    case 'resetscreen': {
      if (screens[d.model ?? ''] !== 'custom') return fail('该目标已不存在。');
      const { [d.model!]: _, ...rest } = screens;
      // (one of the config's props goes back to the screen the config has for it; one added here to none)
      screens = props.some(x => x.model === d.model && !x.custom) ? { ...rest, [d.model!]: 'config' } : rest;
      return ok();
    }
    case 'movecomputer': {
      computers = computers.map(x => (x.id === d.id ? { ...x, x: (x.x ?? 0) + 1.25, heading: ((x.heading ?? 0) + 15) % 360 } : x));
      afterGizmo({ what: 'computer', action: 'moved', success: true });
      return { ok: true };
    }
    default:
      return fail(`未知指令 ${callback}`);
  }
}
