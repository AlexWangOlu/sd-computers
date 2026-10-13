import { t } from '@/i18n';
import type { MockHandler } from './index';
import { fail, ok } from './index';

// Browser mocks for Security Cameras (server/computers/shell.lua cameras:*): what the MRPD front
// desk shows a police officer - the station's own cameras, and one out in the car park.

const CAMERAS = [
  { id: 'mrpd_lobby', label: 'Lobby', area: 'Mission Row Police Station' },
  { id: 'mrpd_entrance', label: 'Front entrance', area: 'Mission Row Police Station' },
  { id: 'mrpd_cells', label: 'Holding cells', area: 'Mission Row Police Station' },
  { id: 'mrpd_garage', label: 'Garage ramp', area: 'Mission Row Police Station' },
  { id: 'impound_gate', label: 'Gate', area: 'Impound lot' },
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
