import type { RpcResult } from '@/types';
import { t } from '@/i18n';
import { fetchNui, isEnvBrowser } from './bridge';
import { mockRpc } from './mock';

/**
 * Call one server app action. In game this posts to the client's 'computers:rpc' passthrough,
 * which forwards to the server's guarded dispatcher (server/computers/rpc.lua). In a plain
 * browser (`npm run dev`) it answers from the mock handlers in nui/mock/, so every app can be
 * built and clicked through without FiveM.
 */
export async function rpc<T = unknown>(endpoint: string, payload?: Record<string, unknown>): Promise<RpcResult<T>> {
  if (isEnvBrowser()) return mockRpc<T>(endpoint, payload ?? {});
  const res = await fetchNui<RpcResult<T>>('computers:rpc', { endpoint, payload: payload ?? {} });
  return res ?? { ok: false, error: t('ui.common.no_response') };
}
