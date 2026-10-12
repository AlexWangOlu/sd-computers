import type { MockHandler } from './index';
import { ok } from './index';

// shell:launch / profile:save (server/computers/shell.lua).
const handlers: Record<string, MockHandler> = {
  'shell:launch': () => ok(),
  'profile:save': p => ok(p.settings),
};

export default handlers;
