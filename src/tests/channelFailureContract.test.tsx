import { act, renderHook } from '@testing-library/react';
import { useBroadcastChannel } from '../hooks/useBroadcastChannel';

class FailureChannel {
  static instances: FailureChannel[] = [];
  static failCreate = false;
  name: string;
  closed = false;
  failSend = false;
  listeners = new Map<string, EventListener>();
  constructor(name: string) {
    if (FailureChannel.failCreate) throw new Error('creation failure');
    this.name = name;
    FailureChannel.instances.push(this);
  }
  postMessage = jest.fn(() => {
    if (this.closed) throw new DOMException('Closed', 'InvalidStateError');
    if (this.failSend) throw new DOMException('Not cloneable', 'DataCloneError');
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
  FailureChannel.instances = [];
  FailureChannel.failCreate = false;
  global.BroadcastChannel = FailureChannel as unknown as typeof BroadcastChannel;
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('constructor failure is reported; rerender alone does not silently recreate', () => {
  FailureChannel.failCreate = true;
  const { result, rerender, unmount } = renderHook(() => useBroadcastChannel('failure'));
  expect(result.current.error).toBe('Failed to create BroadcastChannel');
  FailureChannel.failCreate = false;
  rerender();
  expect(FailureChannel.instances).toHaveLength(0);
  unmount();
});

test('a rejected payload is not replayed or treated as a disconnected channel', () => {
  const { result } = renderHook(() => useBroadcastChannel('failure', { batchingDelayMs: 0 }));
  const channel = FailureChannel.instances[0];
  channel.failSend = true;
  act(() => result.current.postMessage('event', 'rejected'));
  expect(result.current.error).toBe('Failed to send message');
  expect(result.current.sentMessages).toHaveLength(1); // Attempt log, not delivery proof.
  channel.failSend = false;
  act(() => result.current.postMessage('event', 'accepted'));
  expect(result.current.sentMessages).toHaveLength(2);
  expect(channel.postMessage).toHaveBeenCalledTimes(2);
  expect(FailureChannel.instances).toHaveLength(1);
});

test('intentional close is not reopened by rerender or another send', () => {
  const { result, rerender } = renderHook(() =>
    useBroadcastChannel('failure', { batchingDelayMs: 0 })
  );
  act(() => result.current.closeChannel());
  rerender();
  act(() => result.current.postMessage('event', 'after close'));
  expect(FailureChannel.instances).toHaveLength(1);
  expect(FailureChannel.instances[0].postMessage).not.toHaveBeenCalled();
  expect(result.current.sentMessages).toHaveLength(0);
});

test('changing channel identity creates a new connection and closes the old one', () => {
  const { result, rerender } = renderHook(
    ({ name }) => useBroadcastChannel(name, { batchingDelayMs: 0 }),
    { initialProps: { name: 'first' } }
  );
  rerender({ name: 'second' });
  expect(FailureChannel.instances).toHaveLength(2);
  expect(FailureChannel.instances[0].closed).toBe(true);
  act(() => result.current.postMessage('event', 'new channel'));
  expect(FailureChannel.instances[1].postMessage).toHaveBeenCalledTimes(1);
});

test('messageerror has a listener that reports a read error; it is not a disconnect signal', () => {
  renderHook(() => useBroadcastChannel('failure'));
  expect(FailureChannel.instances[0].listeners.has('message')).toBe(true);
  expect(FailureChannel.instances[0].listeners.has('messageerror')).toBe(true);
});
