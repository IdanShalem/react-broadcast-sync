import { compareStateVersions, isStateVersion, nextStateClock, StateVersion } from './stateVersion';

/** Internal draft. No public hook, transport, timers or automatic replay. */
export const STATE_PROTOCOL = 1;
export type StatePacket<T> =
  | { protocol: 1; key: string; type: 'request'; requestId: string }
  | {
      protocol: 1;
      key: string;
      type: 'response';
      requestId: string;
      version: StateVersion | null;
      value: T;
    }
  | { protocol: 1; key: string; type: 'set'; version: StateVersion; value: T };

export interface StateSnapshot<T> {
  value: T;
  version: StateVersion | null;
  clock: number;
  pending: string | null;
}

export const initialStateSnapshot = <T>(value: T): StateSnapshot<T> => ({
  value,
  version: null,
  clock: 0,
  pending: null,
});

/** Payload shape only; this neither authenticates peers nor validates app values. */
export const isStatePacket = <T>(value: unknown): value is StatePacket<T> => {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<StatePacket<T>>;
  if (p.protocol !== STATE_PROTOCOL || typeof p.key !== 'string' || !p.key) return false;
  if (p.type === 'request') return typeof p.requestId === 'string' && p.requestId.length > 0;
  if (!Object.prototype.hasOwnProperty.call(p, 'value')) return false;
  if (p.type === 'set') return isStateVersion(p.version);
  return (
    p.type === 'response' &&
    typeof p.requestId === 'string' &&
    p.requestId.length > 0 &&
    (p.version === null || isStateVersion(p.version))
  );
};

export const startStateRequest = <T>(
  state: StateSnapshot<T>,
  key: string,
  requestId: string
): { state: StateSnapshot<T>; packet: StatePacket<T> } => ({
  state: { ...state, pending: requestId },
  packet: { protocol: STATE_PROTOCOL, key, type: 'request', requestId },
});

/** An old timeout must not close a newer sync request. */
export const finishStateRequest = <T>(
  state: StateSnapshot<T>,
  requestId: string
): StateSnapshot<T> => (state.pending === requestId ? { ...state, pending: null } : state);

export const localStateWrite = <T>(
  state: StateSnapshot<T>,
  key: string,
  source: string,
  value: T
): { state: StateSnapshot<T>; packet: StatePacket<T> } | null => {
  if (!key || !source) return null;
  const clock = nextStateClock(state.clock, state.version?.clock ?? 0);
  if (clock === null) return null;
  const version = { clock, source };
  return {
    state: { ...state, value, version, clock },
    packet: { protocol: STATE_PROTOCOL, key, type: 'set', value, version },
  };
};

/** Only requests produce a reply; accepting a value never emits a set packet. */
export const receiveStatePacket = <T>(
  state: StateSnapshot<T>,
  key: string,
  input: unknown
): { state: StateSnapshot<T>; reply?: StatePacket<T> } => {
  if (!isStatePacket<T>(input) || input.key !== key) return { state };
  if (input.type === 'request') {
    return {
      state,
      reply: {
        protocol: STATE_PROTOCOL,
        key,
        type: 'response',
        requestId: input.requestId,
        version: state.version,
        value: state.value,
      },
    };
  }
  // An uncommitted peer fallback must not become authoritative shared state.
  if (input.version === null) return { state };
  const observed = { ...state, clock: Math.max(state.clock, input.version.clock) };
  if (
    (input.type === 'response' && (state.pending === null || input.requestId !== state.pending)) ||
    (state.version !== null && compareStateVersions(input.version, state.version) <= 0)
  )
    return { state: observed };
  return {
    state: { ...observed, value: input.value, version: input.version },
  };
};
