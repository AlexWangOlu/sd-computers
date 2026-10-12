import { useEffect, useRef } from 'react';

/**
 * A tiny in-page event bus for pushes the server sends while apps are open (new mail). App.tsx
 * emits; any mounted app subscribes with useBus. Events:
 *   'mail:received'      { mailbox: string, message: { id, senderName, senderEmail, subject, preview } }
 *   'messages:incoming'  sd-phone's pushed conversation (apps/messages/types.ts IncomingPush)
 *   'messages:seen'      { conversation, seenAt } - a 1:1 peer read my texts (ms)
 */
type Handler = (data: unknown) => void;
const listeners = new Map<string, Set<Handler>>();

export function emit(event: string, data?: unknown): void {
  listeners.get(event)?.forEach(fn => fn(data));
}

export function useBus<T = unknown>(event: string, handler: (data: T) => void): void {
  const saved = useRef(handler);
  saved.current = handler;
  useEffect(() => {
    const fn: Handler = d => saved.current(d as T);
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(fn);
    return () => {
      set?.delete(fn);
    };
  }, [event]);
}
