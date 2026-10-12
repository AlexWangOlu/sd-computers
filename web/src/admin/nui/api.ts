import { fetchNui } from './bridge';
import { useAdmin } from '@/admin/store/admin';
import { t } from '@/admin/i18n';
import type { Reply, Snapshot } from '@/admin/types';

type WithSnapshot = { snapshot?: Snapshot };

// One panel action = one NUI callback under computers:admin:<verb>. Every reply carries a fresh
// snapshot, so the panel always re-renders from the server's state rather than its own guess.
export async function act<T extends object = object>(verb: string, payload: Record<string, unknown> = {}, recordText?: string): Promise<Reply<T & WithSnapshot>> {
  const store = useAdmin.getState();
  store.setBusy(true);
  const reply = (await fetchNui<Reply<T & WithSnapshot>>(`computers:admin:${verb}`, payload)) ?? { success: false, message: t('toast.failed') };
  store.setBusy(false);
  if (reply.data?.snapshot) store.setSnapshot(reply.data.snapshot);
  if (reply.success) {
    if (recordText) {
      store.record(recordText, true);
      store.toast(recordText, true);
    }
  } else {
    store.toast(reply.message ?? t('toast.failed'), false);
    if (recordText) store.record(recordText, false);
  }
  return reply;
}

// Placing and moving run the gizmo with the panel hidden; the panel comes back with computers:admin:show.
export async function place(verb: 'placecomputer' | 'movecomputer', payload: Record<string, unknown>): Promise<void> {
  useAdmin.getState().setBusy(true);
  await fetchNui(`computers:admin:${verb}`, payload);
}

export async function refresh(): Promise<void> {
  const reply = await fetchNui<Reply<WithSnapshot>>('computers:admin:snapshot');
  if (reply?.success && reply.data?.snapshot) useAdmin.getState().setSnapshot(reply.data.snapshot);
}

export async function close(): Promise<void> {
  useAdmin.getState().close();
  await fetchNui('computers:admin:close');
}
