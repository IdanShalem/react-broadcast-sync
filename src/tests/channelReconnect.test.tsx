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

test('a closed channel reports a closed-channel error, cleared by a successful reconnect', () => {
  const { result } = renderHook(() => useBroadcastChannel('reco', { batchingDelayMs: 0 }));
  act(() => result.current.closeChannel());
  act(() => result.current.postMessage('event', 'while closed'));
  expect(result.current.error).toBe(
    'BroadcastChannel is closed. Call reconnect() to open it again.'
  );
  let ok = false;
  act(() => {
    ok = result.current.reconnect();
  });
  expect(ok).toBe(true);
  expect(result.current.error).toBeNull();
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

class AutoChannel {
  static instances: AutoChannel[] = [];
  static failCreate = false;
  static bornDead = false;
  name: string;
  closed = false;
  closeByExternal = false;
  failClone = false;
  listeners = new Map<string, EventListener>();
  delivered: unknown[] = [];
  constructor(name: string) {
    if (AutoChannel.failCreate) throw new Error('creation failure');
    this.name = name;
    AutoChannel.instances.push(this);
    if (AutoChannel.bornDead) this.closed = true;
  }
  postMessage = jest.fn((data: unknown) => {
    if (this.closed) throw new DOMException('Closed', 'InvalidStateError');
    if (this.failClone) throw new DOMException('Not cloneable', 'DataCloneError');
    // dispatch to open peers on the same name (never to self)
    for (const peer of AutoChannel.instances) {
      if (peer !== this && !peer.closed && peer.name === this.name) {
        peer.listeners.get('message')?.({ data } as MessageEvent);
        peer.delivered.push(data);
      }
    }
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

describe('automatic recovery (recovery: auto)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    AutoChannel.instances = [];
    AutoChannel.failCreate = false;
    AutoChannel.bornDead = false;
    global.BroadcastChannel = AutoChannel as unknown as typeof BroadcastChannel;
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const killExternally = () => {
    // browser kills the hook's channel: object closed, hook ref untouched
    AutoChannel.instances[0].closed = true;
  };

  test('provable closure recreates the channel and retries that send exactly once', () => {
    const onChannelRecovered = jest.fn();
    const first = renderHook(() =>
      useBroadcastChannel('auto', { batchingDelayMs: 0, recovery: 'auto', onChannelRecovered })
    );
    const peer = new AutoChannel('auto'); // second tab
    killExternally();
    act(() => first.result.current.postMessage('event', 'payload'));
    expect(AutoChannel.instances).toHaveLength(3); // first, peer, recreated
    expect(peer.delivered).toHaveLength(1); // provably-undelivered retry: no duplicate
    expect(onChannelRecovered).toHaveBeenCalledTimes(1);
    expect(first.result.current.error).toBeNull();
    expect(first.result.current.sentMessages).toHaveLength(1); // one logged attempt
    first.unmount();
  });

  test('a payload error (DataCloneError) never triggers recovery', () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('auto', { batchingDelayMs: 0, recovery: 'auto' })
    );
    AutoChannel.instances[0].failClone = true;
    act(() => result.current.postMessage('event', 'bad'));
    expect(result.current.error).toBe('Failed to send message');
    expect(AutoChannel.instances).toHaveLength(1);
  });

  test('the default policy recovers from provable closure', () => {
    const { result } = renderHook(() => useBroadcastChannel('auto', { batchingDelayMs: 0 }));
    const peer = new AutoChannel('auto');
    killExternally();
    act(() => result.current.postMessage('event', 'x'));
    expect(result.current.error).toBeNull();
    expect(AutoChannel.instances).toHaveLength(3); // hook, peer, recreated
    expect(peer.delivered).toHaveLength(1);
  });

  test("an explicit 'manual' opt-out does not recover", () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('auto', { batchingDelayMs: 0, recovery: 'manual' })
    );
    killExternally();
    act(() => result.current.postMessage('event', 'x'));
    expect(result.current.error).toBe('Failed to send message');
    expect(AutoChannel.instances).toHaveLength(1);
  });

  test('recovery is bounded when recreation keeps failing', () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('auto', { batchingDelayMs: 0, recovery: 'auto', maxRecoveryAttempts: 2 })
    );
    killExternally();
    AutoChannel.failCreate = true;
    act(() => result.current.postMessage('event', 'a'));
    expect(result.current.error).toBe('Failed to send message'); // recovery attempted, failed
    act(() => result.current.postMessage('event', 'b'));
    act(() => result.current.postMessage('event', 'c'));
    expect(AutoChannel.instances).toHaveLength(1); // recreation never succeeded
    // dead object dropped after exhaustion: same down-channel signal as after closeChannel()
    expect(result.current.error).toBe(
      'BroadcastChannel is closed. Call reconnect() to open it again.'
    );
    // explicit reconnect still works once the browser heals
    AutoChannel.failCreate = false;
    let ok = false;
    act(() => {
      ok = result.current.reconnect();
    });
    expect(ok).toBe(true);
    expect(AutoChannel.instances).toHaveLength(2);
  });

  test('a successful recovery resets the consecutive-failure budget', () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('auto', { batchingDelayMs: 0, recovery: 'auto', maxRecoveryAttempts: 1 })
    );
    killExternally(); // hook's instance 0 dies out of band
    const peer = new AutoChannel('auto'); // second tab, instance 1
    // Two successive external kills each recover: without the reset the second
    // would already hit maxRecoveryAttempts: 1.
    act(() => result.current.postMessage('event', 'first'));
    expect(result.current.error).toBeNull();
    AutoChannel.instances[AutoChannel.instances.length - 1].closed = true; // recreated channel dies too
    act(() => result.current.postMessage('event', 'second'));
    expect(result.current.error).toBeNull();
    expect(peer.delivered).toHaveLength(2); // each retried send delivered exactly once
  });

  test('consecutive failed retries hit the cap, then explicit reconnect rescues', () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('auto', { batchingDelayMs: 0, recovery: 'auto', maxRecoveryAttempts: 2 })
    );
    const peer = new AutoChannel('auto'); // second tab
    killExternally();
    AutoChannel.bornDead = true; // recreation succeeds but the new object is dead too
    act(() => result.current.postMessage('event', 'a')); // failed recovery attempt 1
    expect(result.current.error).toBe('Failed to send message');
    act(() => result.current.postMessage('event', 'b')); // failed recovery attempt 2
    act(() => result.current.postMessage('event', 'c')); // cap reached: drop, no recreation
    expect(AutoChannel.instances).toHaveLength(4); // original + peer + 2 born-dead recreations
    expect(peer.delivered).toHaveLength(0); // no ghost deliveries from dead transports
    act(() => result.current.postMessage('event', 'd')); // ref dropped: down-channel signal
    expect(result.current.error).toBe(
      'BroadcastChannel is closed. Call reconnect() to open it again.'
    );
    AutoChannel.bornDead = false;
    let ok = false;
    act(() => {
      ok = result.current.reconnect();
    });
    expect(ok).toBe(true);
    act(() => result.current.postMessage('event', 'e'));
    expect(peer.delivered).toHaveLength(1); // explicit rescue path delivers again
  });

  test('a successful send clears a stale send error', () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('auto', { batchingDelayMs: 0, recovery: 'auto' })
    );
    AutoChannel.instances[0].failClone = true;
    act(() => result.current.postMessage('event', 'bad'));
    expect(result.current.error).toBe('Failed to send message');
    AutoChannel.instances[0].failClone = false;
    act(() => result.current.postMessage('event', 'good'));
    expect(result.current.error).toBeNull();
  });

  test('a successful recovery clears a stale error from an earlier failure', () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('auto', { batchingDelayMs: 0, recovery: 'auto' })
    );
    AutoChannel.instances[0].failClone = true;
    act(() => result.current.postMessage('event', 'bad'));
    expect(result.current.error).toBe('Failed to send message');
    AutoChannel.instances[0].failClone = false;
    killExternally();
    act(() => result.current.postMessage('event', 'good'));
    expect(result.current.error).toBeNull();
  });

  test('an explicit closeChannel() never auto-recovers', () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('auto', { batchingDelayMs: 0, recovery: 'auto' })
    );
    act(() => result.current.closeChannel());
    act(() => result.current.postMessage('event', 'x'));
    expect(AutoChannel.instances).toHaveLength(1);
    expect(result.current.sentMessages).toHaveLength(0);
  });

  test('a dead channel during batch flush recreates and retries the batch once', () => {
    const { result } = renderHook(() => useBroadcastChannel('auto', { recovery: 'auto' }));
    const peer = new AutoChannel('auto');
    act(() => result.current.postMessage('event', 'batched'));
    killExternally();
    act(() => {
      jest.advanceTimersByTime(30);
    });
    expect(AutoChannel.instances).toHaveLength(3);
    expect(peer.delivered).toHaveLength(1);
  });
});
