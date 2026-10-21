import { act, renderHook } from '@testing-library/react';
import { useBroadcastChannel } from '../hooks/useBroadcastChannel';

class ReconnectChannel {
  static instances: ReconnectChannel[] = [];
  static failCreate = false;
  name: string;
  closed = false;
  listeners = new Map<string, EventListener>();
  constructor(name: string) {
    if (ReconnectChannel.failCreate) throw new Error('creation failure');
    this.name = name;
    ReconnectChannel.instances.push(this);
  }
  postMessage = jest.fn(() => {
    if (this.closed) throw new DOMException('Closed', 'InvalidStateError');
  });
  close = jest.fn(() => {
    this.closed = true;
  });
  addEventListener = jest.fn((name: string, listener: EventListener) => {
    this.listeners.set(name, listener);
  });
  removeEventListener = jest.fn((name: string) => {
    this.listeners.delete(name);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  ReconnectChannel.instances = [];
  ReconnectChannel.failCreate = false;
  global.BroadcastChannel = ReconnectChannel as unknown as typeof BroadcastChannel;
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('reconnect recovers from a creation failure and the new connection works', () => {
  ReconnectChannel.failCreate = true;
  const { result } = renderHook(() => useBroadcastChannel('reco', { batchingDelayMs: 0 }));
  expect(result.current.error).toBe('Failed to create BroadcastChannel');
  expect(ReconnectChannel.instances).toHaveLength(0);

  ReconnectChannel.failCreate = false;
  let ok = false;
  act(() => {
    ok = result.current.reconnect();
  });
  expect(ok).toBe(true);
  expect(ReconnectChannel.instances).toHaveLength(1);
  expect(ReconnectChannel.instances[0].listeners.has('message')).toBe(true);

  act(() => result.current.postMessage('event', 'after reconnect'));
  expect(ReconnectChannel.instances[0].postMessage).toHaveBeenCalledTimes(1);
  expect(result.current.sentMessages).toHaveLength(1);
});

test('reconnect is a no-op while the channel is open', () => {
  const { result } = renderHook(() => useBroadcastChannel('reco'));
  let ok = true;
  act(() => {
    ok = result.current.reconnect();
  });
  expect(ok).toBe(false);
  expect(ReconnectChannel.instances).toHaveLength(1);
});

test('a deliberate close stays closed until an explicit reconnect', () => {
  const { result, rerender } = renderHook(() =>
    useBroadcastChannel('reco', { batchingDelayMs: 0 })
  );
  act(() => result.current.closeChannel());
  rerender();
  act(() => result.current.postMessage('event', 'while closed'));
  expect(ReconnectChannel.instances).toHaveLength(1);
  expect(ReconnectChannel.instances[0].postMessage).not.toHaveBeenCalled();

  let ok = false;
  act(() => {
    ok = result.current.reconnect();
  });
  expect(ok).toBe(true);
  expect(ReconnectChannel.instances).toHaveLength(2);
  expect(ReconnectChannel.instances[0].closed).toBe(true);

  act(() => result.current.postMessage('event', 'reopened'));
  expect(ReconnectChannel.instances[1].postMessage).toHaveBeenCalledTimes(1);
});

test('reconnect keeps the tab source identity', () => {
  const { result } = renderHook(() => useBroadcastChannel('reco', { batchingDelayMs: 0 }));
  act(() => result.current.postMessage('event', 'before'));
  act(() => result.current.closeChannel());
  act(() => {
    result.current.reconnect();
  });
  act(() => result.current.postMessage('event', 'after'));
  const [before, after] = result.current.sentMessages;
  expect(after.source).toBe(before.source);
});

test('reconnected channel receives messages through the same handler path', () => {
  const { result } = renderHook(() => useBroadcastChannel('reco', { batchingDelayMs: 0 }));
  act(() => result.current.closeChannel());
  act(() => {
    result.current.reconnect();
  });
  const channel = ReconnectChannel.instances[1];
  const incoming = {
    id: 'm1',
    type: 'event',
    message: 'hello',
    timestamp: Date.now(),
    source: 'other-tab',
  };
  act(() => {
    channel.listeners.get('message')?.({ data: incoming } as MessageEvent);
  });
  expect(result.current.messages).toHaveLength(1);
  expect(result.current.messages[0].id).toBe('m1');
});

test('messageerror is reported as a read error, not treated as disconnection', () => {
  const { result } = renderHook(() => useBroadcastChannel('reco', { batchingDelayMs: 0 }));
  const channel = ReconnectChannel.instances[0];
  expect(channel.listeners.has('messageerror')).toBe(true);
  act(() => {
    channel.listeners.get('messageerror')?.({} as Event);
  });
  expect(result.current.error).toBe('Failed to read an incoming message');
  act(() => result.current.postMessage('event', 'still open'));
  expect(channel.postMessage).toHaveBeenCalledTimes(1);
  expect(ReconnectChannel.instances).toHaveLength(1);
});
