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

/** Owns this connection; call dispose before replacing its channel/key. */
export const createStateSession = <T>(
  key: string,
  initialValue: T,
  transport: StateTransport,
  onChange: (state: StateSnapshot<T>) => void,
  onError: (error: unknown) => void
) => {
  const source = generateSourceName();
  let state = initialStateSnapshot(initialValue);
  let disposed = false;
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
  const send = (packet: StatePacket<T>): boolean => {
    try {
      transport.postMessage(packet);
      return true;
    } catch (error) {
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
  const receive = (event: MessageEvent) => {
    if (disposed) return;
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
  transport.addEventListener('message', receive);

  return {
    getSnapshot: () => state,
    /** A failed send does not commit a local value or claim success. */
    setValue(value: T): boolean {
      if (disposed) return false;
      const write = localStateWrite(state, key, source, value);
      if (!write) {
        onError(new Error('Cannot create a safe state version'));
        return false;
      }
      if (!send(write.packet)) return false;
      publish(write.state);
      return true;
    },
    sync(windowMs = 250): Promise<StateSyncResult> {
      if (disposed) return Promise.resolve('cancelled');
      if (!Number.isFinite(windowMs) || windowMs < 0) {
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
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      finish('cancelled');
      transport.removeEventListener('message', receive);
      transport.close();
    },
  };
};
