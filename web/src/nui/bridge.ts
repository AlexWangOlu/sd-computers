
declare global {
  interface Window {
    GetParentResourceName?: () => string;
  }
}

// The OS runs in a frame of the resource's NUI page (src/host). FiveM only injects
// GetParentResourceName into the top frame, so look there too (same origin, so allowed).
const nameFn = (): (() => string) | undefined => {
  if (typeof window.GetParentResourceName === 'function') return window.GetParentResourceName;
  try {
    const up = window.parent as Window | undefined;
    if (up && up !== window && typeof up.GetParentResourceName === 'function') return up.GetParentResourceName;
  } catch {
    // cross-origin parent: a plain browser tab embedding us, not the game
  }
  return undefined;
};

export const isEnvBrowser = (): boolean => nameFn() === undefined;

const resourceName = (): string => nameFn()?.() ?? 'sd-computers';

export async function fetchNui<Resp = unknown, Req = unknown>(
  callback: string,
  data?: Req,
): Promise<Resp | null> {
  if (isEnvBrowser()) return null;
  try {
    const resp = await fetch(`https://${resourceName()}/${callback}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data ?? {}),
    });
    return (await resp.json()) as Resp;
  } catch {
    return null;
  }
}
