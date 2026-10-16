import { t } from '@/i18n';
import type { MockHandler } from './index';
import { fail, ok } from './index';

// Browser mocks for Security Cameras (server/computers/shell.lua cameras:*): what the MRPD front
// desk shows a police officer - the station's own cameras, and one out in the car park.

const CAMERAS = [
  { id: 'mrpd_lobby', label: '大厅', area: '米申罗警局' },
  { id: 'mrpd_entrance', label: '正门', area: '米申罗警局' },
  { id: 'mrpd_cells', label: '拘留室', area: '米申罗警局' },
  { id: 'mrpd_garage', label: '车库坡道', area: '米申罗警局' },
  { id: 'impound_gate', label: '大门', area: '扣押场' },
];

const handlers: Record<string, MockHandler> = {
  'cameras:list': () => ok(CAMERAS.map(c => ({ ...c }))),

  // (the position is the game's business; the page only shows whose picture it is)
  'cameras:watch': ({ id }) => {
    const cam = CAMERAS.find(c => c.id === id);
    if (!cam) return fail(t('cameras.err_unknown'));
    return ok({ ...cam, x: 0, y: 0, z: 0, pitch: -20, roll: 0, yaw: 0, fov: 70, pan: 60, tilt: 25, zoom: 3, filter: 'cctv' });
  },
};

export default handlers;
