import { useCallback, useEffect, useRef, useState } from 'react';
import { createStateSession, StateSyncResult } from '../utils/stateSession';

export interface SyncedStateOptions<T> {
  namespace?: string;
  syncWindowMs?: number;
  /** Optional application payload check, used for incoming and local values. */
  validate?: (value: unknown) => value is T;
}
export interface SyncedStateStatus {
  error: string | null;
  sync: () => Promise<SyncedStateSyncResult>;
}

export type SyncedStateSyncResult = StateSyncResult | 'unavailable';
export type SyncedStateSetter<T> = (value: T | ((current: T) => T)) => boolean;

/** Current-value sync on a separate same-origin channel. No persistence/atomic updates. */
export const useSyncedState = <T>(
  channel: string,
  key: string,
  initialValue: T,
  options: SyncedStateOptions<T> = {}
): [T, SyncedStateSetter<T>, SyncedStateStatus] => {
  const namespace = options.namespace ?? '';
  const windowMs = options.syncWindowMs ?? 250;
  // A distinct transport prevents raw state packets reaching envelope consumers.
  const identity = JSON.stringify([channel, namespace, key]);
  const validator = useRef(options.validate);
  validator.current = options.validate;
  const syncWindow = useRef(windowMs);
  syncWindow.current = windowMs;
  const initial = useRef({ identity, value: initialValue });
  if (initial.current.identity !== identity) initial.current = { identity, value: initialValue };
  const [view, setView] = useState({ identity, value: initialValue, error: null as string | null });
  const active = useRef<{
    identity: string;
    session: ReturnType<typeof createStateSession<T>>;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    const value = initial.current.value;
    setView({ identity, value, error: null });
    const reportError = (error: unknown) => {
      if (alive)
        setView(current => ({
          ...current,
          error: error instanceof Error ? error.message : String(error),
        }));
    };
    if (!channel || !key) {
      reportError(new Error('Invalid state channel, key or sync window'));
      return () => {
        alive = false;
      };
    }
    if (typeof BroadcastChannel === 'undefined') {
      reportError(new Error('BroadcastChannel is unavailable'));
      return () => {
        alive = false;
      };
    }
    try {
      const transport = new BroadcastChannel(
        `react-broadcast-sync:state:v1:${JSON.stringify([channel, namespace])}`
      );
      const session = createStateSession<T>(
        key,
        value,
        transport,
        state => {
          if (alive) setView(current => ({ ...current, identity, value: state.value }));
        },
        reportError,
        value => (validator.current ? validator.current(value) : true)
      );
      active.current = { identity, session };
      void session.sync(syncWindow.current);
      return () => {
        alive = false;
        if (active.current?.session === session) active.current = null;
        session.dispose();
      };
    } catch (error) {
      reportError(error);
      return () => {
        alive = false;
      };
    }
  }, [channel, namespace, key, identity]);

  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      const current = active.current;
      if (!current || current.identity !== identity) return false;
      const value =
        typeof next === 'function'
          ? (next as (current: T) => T)(current.session.getSnapshot().value)
          : next;
      const sent = current.session.setValue(value);
      if (sent) setView(view => ({ ...view, error: null }));
      return sent;
    },
    [identity]
  );
  const sync = useCallback(() => {
    const current = active.current;
    return current?.identity === identity
      ? current.session.sync(syncWindow.current)
      : Promise.resolve('unavailable' as const);
  }, [identity]);
  return [
    view.identity === identity ? view.value : initial.current.value,
    setValue,
    {
      error: view.identity === identity ? view.error : null,
      sync,
    },
  ];
};
