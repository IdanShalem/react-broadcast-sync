import {
  finishStateRequest,
  initialStateSnapshot,
  isStatePacket,
  localStateWrite,
  receiveStatePacket,
  startStateRequest,
  StatePacket,
  StateSnapshot,
} from './stateProtocol';
import { generateSourceName } from './messageUtils';

/** Internal session prototype, not exported from the package root. */
interface StateTransport {
  postMessage(packet: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  close(): void;
}
export type StateSyncResult = 'received' | 'no-peer' | 'send-failed' | 'cancelled';

/** Recovery policy for a provably closed state transport. */
export interface StateSessionRecoveryOptions {
  /** 'auto' recreates the transport and retries the failed send once; 'manual' opts out. */
  recovery: 'auto' | 'manual';
  /** Cap on consecutive failed automatic recovery attempts. */
  maxRecoveryAttempts: number;
  /** Fires after a successful automatic recovery, before the resync request. */
  onRecovered?: () => void;
  /** Window for the resync request issued after a successful recovery. */
  syncWindowMs: number;
}

const DEFAULT_RECOVERY_OPTIONS: StateSessionRecoveryOptions = {
  recovery: 'auto',
  maxRecoveryAttempts: 3,
  syncWindowMs: 250,
};

// InvalidStateError is the only provable closure signal: per the HTML standard,
// postMessage throws it only when the channel object's closed flag is set, and
// the throw happens before serialization or delivery. Silence is never proof.
const isClosedTransportError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { name?: string }).name === 'InvalidStateError';

/** Owns its connections; call dispose before replacing its channel/key. */
export const createStateSession = <T>(
  key: string,
  initialValue: T,
  createTransport: () => StateTransport,
  onChange: (state: StateSnapshot<T>) => void,
  onError: (error: unknown) => void,
  validate: (value: unknown) => boolean = () => true,
  getRecoveryOptions: () => StateSessionRecoveryOptions = () => DEFAULT_RECOVERY_OPTIONS
) => {
  const source = generateSourceName();
  let state = initialStateSnapshot(initialValue);
  let disposed = false;
  let transport: StateTransport | null = null;
  // Consecutive automatic recovery attempts; reset by every successful send.
  let recoveryAttempts = 0;
  let pending:
    | {
        id: string;
        answered: boolean;
        timer: ReturnType<typeof setTimeout>;
        resolve: (result: StateSyncResult) => void;
      }
    | undefined;

  const publish = (next: StateSnapshot<T>) => {
    state = next;
    if (!disposed) onChange(state);
  };
  const receive = (event: MessageEvent) => {
    if (disposed) return;
    if (isStatePacket<T>(event.data) && event.data.key === key && event.data.type !== 'request') {
      try {
        if (!validate(event.data.value)) return;
      } catch (error) {
        onError(error);
        return;
      }
    }
    const received = receiveStatePacket<T>(state, key, event.data);
    if (
      pending &&
      isStatePacket<T>(event.data) &&
      event.data.key === key &&
      event.data.type === 'response' &&
      event.data.requestId === pending.id &&
      event.data.version !== null
    )
      pending.answered = true;
    if (received.state !== state) publish(received.state);
    if (received.reply) send(received.reply);
  };
  const openTransport = (): StateTransport | null => {
    try {
      const opened = createTransport();
      opened.addEventListener('message', receive);
      transport = opened;
      return opened;
    } catch (error) {
      onError(error);
      return null;
    }
  };
  // Drop a provably closed transport object: detach the listener and release
  // the ref. After the drop only an explicit reconnect() can start fresh.
  const dropDeadTransport = (dead: StateTransport) => {
    if (transport !== dead) return;
    dead.removeEventListener('message', receive);
    transport = null;
  };
  const syncImpl = (windowMs = 250): Promise<StateSyncResult> => {
    if (disposed) return Promise.resolve('cancelled');
    if (!Number.isFinite(windowMs) || windowMs < 0 || windowMs > 2147483647) {
      onError(new Error('Invalid state sync window'));
      return Promise.resolve('send-failed');
    }
    finish('cancelled');
    const id = generateSourceName();
    const request = startStateRequest(state, key, id);
    return new Promise(resolve => {
      pending = {
        id,
        answered: false,
        resolve,
        timer: setTimeout(() => finish(pending?.answered ? 'received' : 'no-peer'), windowMs),
      };
      publish(request.state);
      if (!send(request.packet)) finish('send-failed');
    });
  };
  // Automatic recovery fires only on InvalidStateError proof, never on payload
  // errors or silence. The failed send provably never left this tab, so
  // retrying it once on the fresh transport cannot duplicate delivery. Bounded
  // by maxRecoveryAttempts consecutive failures; dispose never reaches this
  // path. A resync request follows a successful recovery so this tab converges
  // with peers again; a newer local edit keeps winning through version order.
  const attemptAutoRecovery = (failed: StateTransport, packet: StatePacket<T>): boolean => {
    const options = getRecoveryOptions();
    if (options.recovery !== 'auto') return false;
    if (transport !== failed) return false;
    if (recoveryAttempts >= options.maxRecoveryAttempts) {
      dropDeadTransport(failed);
      return false;
    }
    recoveryAttempts += 1;
    dropDeadTransport(failed);
    if (openTransport() === null) return false;
    const opened = transport;
    if (!opened) return false;
    try {
      opened.postMessage(packet);
      // The fresh transport provably works (this send just left it), so the
      // consecutive-failure streak is over.
      recoveryAttempts = 0;
    } catch {
      // A born-dead replacement stays current; the next send retries recovery.
      return false;
    }
    try {
      options.onRecovered?.();
    } catch {
      // An application callback failure is not a transport failure.
    }
    void syncImpl(options.syncWindowMs);
    return true;
  };
  const send = (packet: StatePacket<T>): boolean => {
    const current = transport;
    if (!current) {
      onError(new Error('State channel is closed. Call reconnect() to open it again.'));
      return false;
    }
    try {
      current.postMessage(packet);
      recoveryAttempts = 0;
      return true;
    } catch (error) {
      const closedProof = isClosedTransportError(error);
      if (!disposed && closedProof && attemptAutoRecovery(current, packet)) return true;
      // A provably closed transport is useless to keep: this session has no
      // explicit close, so drop the dead ref and let reconnect() revive it.
      if (closedProof) dropDeadTransport(current);
      onError(error);
      return false;
    }
  };
  const finish = (result: StateSyncResult) => {
    if (!pending) return;
    const current = pending;
    pending = undefined;
    clearTimeout(current.timer);
    publish(finishStateRequest(state, current.id));
    current.resolve(result);
  };

  openTransport();

  return {
    getSnapshot: () => state,
    /** A failed send does not commit a local value or claim success. */
    setValue(value: T): boolean {
      if (disposed) return false;
      try {
        if (!validate(value)) {
          onError(new Error('Invalid state value'));
          return false;
        }
      } catch (error) {
        onError(error);
        return false;
      }
      const write = localStateWrite(state, key, source, value);
      if (!write) {
        onError(new Error('Cannot create a safe state version'));
        return false;
      }
      if (!send(write.packet)) return false;
      // A recovery during send already started a resync request; publishing the
      // pre-send write state must not clobber its pending marker.
      publish({ ...write.state, pending: state.pending });
      return true;
    },
    sync: syncImpl,
    /** True when no transport is held (creation failure or exhausted recovery). */
    isDown(): boolean {
      return transport === null;
    },
    /**
     * Explicit transport recovery only: never called automatically. A working
     * connection is never replaced. A successful reconnect resyncs with peers.
     */
    reconnect(): boolean {
      if (disposed || transport) return false;
      if (openTransport() === null) return false;
      recoveryAttempts = 0;
      void syncImpl(getRecoveryOptions().syncWindowMs);
      return true;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      finish('cancelled');
      const current = transport;
      transport = null;
      if (current) {
        current.removeEventListener('message', receive);
        current.close();
      }
    },
  };
};
