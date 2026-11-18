import { renderHook, act } from '@testing-library/react';
import { useBroadcastChannel } from '../hooks/useBroadcastChannel';
import { BroadcastMessage } from '../types/types';

class MockBroadcastChannel {
  static channels: Record<string, MockBroadcastChannel[]> = {};
  /** When set, every postMessage call throws this error. */
  static postError: { name: string; message: string } | null = null;
  /** Throw postError only on the next postMessage call. */
  static failNextPost = false;

  name: string;
  _onmessage: ((event: MessageEvent) => void) | null = null;
  closed = false;
  posted: unknown[] = [];

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels[name]) {
      MockBroadcastChannel.channels[name] = [];
    }
    MockBroadcastChannel.channels[name].push(this);
  }

  postMessage = jest.fn((data: unknown) => {
    if (this.closed) {
      throw new DOMException('Channel is closed', 'InvalidStateError');
    }
    if (MockBroadcastChannel.postError) {
      const { name, message } = MockBroadcastChannel.postError;
      if (MockBroadcastChannel.failNextPost) {
        MockBroadcastChannel.postError = null;
        MockBroadcastChannel.failNextPost = false;
      }
      throw new DOMException(message, name);
    }
    this.posted.push(data);
    const others = MockBroadcastChannel.channels[this.name] || [];
    for (const channel of others) {
      if (channel !== this && !channel.closed && channel._onmessage) {
        if (Array.isArray(data)) {
          data.forEach(msg => channel._onmessage!({ data: msg } as MessageEvent));
        } else {
          channel._onmessage({ data } as MessageEvent);
        }
      }
    }
  });

  close = jest.fn(() => {
    this.closed = true;
    this._onmessage = null;
  });

  addEventListener = jest.fn((event: string, callback: (event: MessageEvent) => void) => {
    if (event === 'message') {
      this._onmessage = callback;
    }
  });

  removeEventListener = jest.fn((event: string, callback: (event: MessageEvent) => void) => {
    if (event === 'message' && this._onmessage === callback) {
      this._onmessage = null;
    }
  });
}

const flushMicrotasks = () => Promise.resolve().then(() => undefined);

describe('sendMessage (promise-returning send)', () => {
  beforeEach(() => {
    MockBroadcastChannel.channels = {};
    MockBroadcastChannel.postError = null;
    MockBroadcastChannel.failNextPost = false;
    (globalThis as any).BroadcastChannel = MockBroadcastChannel;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves with the sent message after the batch flush', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useBroadcastChannel('send-batch', { batchingDelayMs: 20, sourceName: 'tab-a' })
    );

    let settled: { kind: 'resolved' | 'rejected'; value?: unknown } | null = null;
    let promise!: Promise<BroadcastMessage>;
    act(() => {
      promise = result.current.sendMessage('cart-updated', { count: 2 });
      promise.then(
        value => (settled = { kind: 'resolved', value }),
        error => (settled = { kind: 'rejected', value: error })
      );
    });
    await flushMicrotasks();
    expect(settled).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(25);
      await flushMicrotasks();
    });

    expect(settled).not.toBeNull();
    expect(settled!.kind).toBe('resolved');
    const message = settled!.value as BroadcastMessage;
    expect(message.type).toBe('cart-updated');
    expect(message.message).toEqual({ count: 2 });
    expect(message.source).toBe('tab-a');
    expect(typeof message.id).toBe('string');
    expect(typeof message.timestamp).toBe('number');
    // The batch actually left the channel as one array.
    const channel = MockBroadcastChannel.channels['send-batch'][0];
    expect(channel.posted).toHaveLength(1);
    expect(Array.isArray(channel.posted[0])).toBe(true);
  });

  it('resolves immediately when batching is disabled', async () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('send-immediate', { batchingDelayMs: 0, sourceName: 'tab-a' })
    );

    let message: BroadcastMessage | undefined;
    await act(async () => {
      message = await result.current.sendMessage('ping-ui', { at: 1 });
    });

    expect(message?.type).toBe('ping-ui');
    const channel = MockBroadcastChannel.channels['send-immediate'][0];
    expect(channel.posted).toHaveLength(1);
  });

  it('sends immediately when the type is excluded from batching', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useBroadcastChannel('send-excluded', {
        batchingDelayMs: 1000,
        excludedBatchMessageTypes: ['urgent'],
        sourceName: 'tab-a',
      })
    );

    let settled = false;
    await act(async () => {
      await result.current.sendMessage('urgent', { now: true }).then(() => (settled = true));
    });

    expect(settled).toBe(true);
    const channel = MockBroadcastChannel.channels['send-excluded'][0];
    expect(channel.posted).toHaveLength(1);
    expect(Array.isArray(channel.posted[0])).toBe(false);
  });

  it('passes expiration options through to the sent message', async () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('send-expiry', { batchingDelayMs: 0, sourceName: 'tab-a' })
    );

    let message: BroadcastMessage | undefined;
    await act(async () => {
      message = await result.current.sendMessage('temp', { v: 1 }, { expirationDuration: 5000 });
    });

    expect(message?.expirationDate).toBeGreaterThan(Date.now());
  });

  it('rejects when the payload cannot be cloned (DataCloneError)', async () => {
    MockBroadcastChannel.postError = { name: 'DataCloneError', message: 'could not be cloned' };
    const { result } = renderHook(() =>
      useBroadcastChannel('send-clone', { batchingDelayMs: 0, sourceName: 'tab-a' })
    );

    let rejection: unknown = null;
    await act(async () => {
      await result.current.sendMessage('bad', { cyclic: {} }).catch(e => (rejection = e));
    });

    expect(rejection).toBeInstanceOf(DOMException);
    expect((rejection as DOMException).name).toBe('DataCloneError');
    expect(result.current.error).toBe('Failed to send message');
  });

  it('rejects on a closed channel when recovery is manual (immediate path)', async () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('send-manual', {
        batchingDelayMs: 0,
        recovery: 'manual',
        sourceName: 'tab-a',
      })
    );
    // Simulate the channel being closed outside the library.
    const channel = MockBroadcastChannel.channels['send-manual'][0];
    channel.closed = true;

    let rejection: unknown = null;
    await act(async () => {
      await result.current.sendMessage('late', { v: 1 }).catch(e => (rejection = e));
    });

    expect(rejection).toBeInstanceOf(DOMException);
    expect((rejection as DOMException).name).toBe('InvalidStateError');
    expect(result.current.error).toBe('Failed to send message');
  });

  it('resolves through one automatic recovery retry', async () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('send-recover', {
        batchingDelayMs: 0,
        recovery: 'auto',
        sourceName: 'tab-a',
      })
    );
    // The held channel object was closed outside the library.
    const stale = MockBroadcastChannel.channels['send-recover'][0];
    stale.closed = true;

    let message: BroadcastMessage | undefined;
    await act(async () => {
      message = await result.current.sendMessage('retry', { v: 1 });
    });

    expect(message?.type).toBe('retry');
    // Recovery opened a fresh channel and the retry posted there.
    const channels = MockBroadcastChannel.channels['send-recover'];
    expect(channels.length).toBe(2);
    expect(channels[1].posted).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('rejects when the channel was closed before sending', async () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('send-closed', { batchingDelayMs: 0, sourceName: 'tab-a' })
    );

    act(() => {
      result.current.closeChannel();
    });

    let rejection: unknown = null;
    await act(async () => {
      await result.current.sendMessage('late', { v: 1 }).catch(e => (rejection = e));
    });

    expect(rejection).toBeInstanceOf(Error);
  });

  it('settles a pending batched send on unmount (flush succeeds and resolves)', async () => {
    jest.useFakeTimers();
    const { result, unmount } = renderHook(() =>
      useBroadcastChannel('send-unmount-flush', { batchingDelayMs: 60000, sourceName: 'tab-a' })
    );

    let settled: string | null = null;
    act(() => {
      result.current.sendMessage('queued-unmount', { v: 1 }).then(
        () => (settled = 'resolved'),
        () => (settled = 'rejected')
      );
    });
    await flushMicrotasks();
    expect(settled).toBeNull();

    await act(async () => {
      unmount();
      await flushMicrotasks();
    });

    expect(settled).toBe('resolved');
    const channel = MockBroadcastChannel.channels['send-unmount-flush'][0];
    expect(channel.closed).toBe(true);
    expect(channel.posted).toHaveLength(1);
  });

  it('rejects a pending batched send on unmount when the close-flush fails', async () => {
    jest.useFakeTimers();
    const { result, unmount } = renderHook(() =>
      useBroadcastChannel('send-unmount-fail', { batchingDelayMs: 60000, sourceName: 'tab-a' })
    );

    let settled: string | null = null;
    act(() => {
      result.current.sendMessage('queued-unmount-fail', { v: 1 }).then(
        () => (settled = 'resolved'),
        () => (settled = 'rejected')
      );
    });
    await flushMicrotasks();
    expect(settled).toBeNull();

    MockBroadcastChannel.postError = { name: 'DataCloneError', message: 'could not be cloned' };
    await act(async () => {
      unmount();
      await flushMicrotasks();
    });

    expect(settled).toBe('rejected');
  });

  it('resolves a pending batched send when closeChannel flushes the batch', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useBroadcastChannel('send-close-flush', { batchingDelayMs: 1000, sourceName: 'tab-a' })
    );

    let settled: string | null = null;
    act(() => {
      result.current.sendMessage('queued', { v: 1 }).then(
        () => (settled = 'resolved'),
        () => (settled = 'rejected')
      );
    });
    await flushMicrotasks();
    expect(settled).toBeNull();

    await act(async () => {
      result.current.closeChannel();
      await flushMicrotasks();
    });

    expect(settled).toBe('resolved');
    const channel = MockBroadcastChannel.channels['send-close-flush'][0];
    expect(channel.closed).toBe(true);
    expect(channel.posted).toHaveLength(1);
  });

  it('rejects a pending batched send when the flush fails (batched path)', async () => {
    jest.useFakeTimers();
    MockBroadcastChannel.postError = { name: 'DataCloneError', message: 'could not be cloned' };
    const { result } = renderHook(() =>
      useBroadcastChannel('send-batch-fail', { batchingDelayMs: 20, sourceName: 'tab-a' })
    );

    let settled: string | null = null;
    act(() => {
      result.current.sendMessage('bad-batch', { v: 1 }).then(
        () => (settled = 'resolved'),
        () => (settled = 'rejected')
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(25);
      await flushMicrotasks();
    });

    expect(settled).toBe('rejected');
    expect(result.current.error).toBe('Failed to send message');
  });

  it('keeps postMessage fire-and-forget: returns void and creates no promise', async () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('send-fire-forget', { batchingDelayMs: 0, sourceName: 'tab-a' })
    );

    let returned: unknown = 'unset';
    act(() => {
      returned = result.current.postMessage('plain', { v: 1 });
    });

    expect(returned).toBeUndefined();
    const channel = MockBroadcastChannel.channels['send-fire-forget'][0];
    expect(channel.posted).toHaveLength(1);
  });
});
