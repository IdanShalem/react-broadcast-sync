import React, { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { useSyncedState } from '../hooks/useSyncedState';

class Channel {
  static ports: Channel[] = [];
  name: string;
  closed = false;
  fail = false;
  listeners = new Set<(event: MessageEvent) => void>();
  posted: unknown[] = [];
  constructor(name: string) {
    this.name = name;
    Channel.ports.push(this);
  }
  postMessage(packet: unknown) {
    if (this.fail) throw new Error('clone failed');
    this.posted.push(packet);
    // Browser delivery is asynchronous, including replies.
    for (const peer of Channel.ports)
      if (peer !== this && !peer.closed && peer.name === this.name) peer.queue(packet);
  }
  queued = new Set<ReturnType<typeof setTimeout>>();
  queue(packet: unknown) {
    const timer = setTimeout(() => {
      this.queued.delete(timer);
      this.deliver(packet);
    }, 0);
    this.queued.add(timer);
  }
  deliver(packet: unknown) {
    if (!this.closed)
      for (const listener of this.listeners) listener({ data: packet } as MessageEvent);
  }
  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }
  close() {
    this.closed = true;
    for (const timer of this.queued) clearTimeout(timer);
    this.queued.clear();
  }
}
const original = global.BroadcastChannel;
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  Channel.ports = [];
  global.BroadcastChannel = Channel as unknown as typeof BroadcastChannel;
});
afterEach(() => {
  global.BroadcastChannel = original;
  jest.useRealTimers();
});
const tick = async (ms = 300) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

it('StrictMode leaves one active connection, syncs a late hook and cleans every timer/listener', async () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <StrictMode>{children}</StrictMode>
  );
  const a = renderHook(() => useSyncedState('app', 'filters', 'default'), { wrapper });
  expect(Channel.ports.filter(p => !p.closed)).toHaveLength(1);
  act(() => {
    expect(a.result.current[1]('written')).toBe(true);
  });
  const b = renderHook(() => useSyncedState('app', 'filters', 'fallback'), { wrapper });
  await tick();
  expect(b.result.current[0]).toBe('written');
  act(() => {
    b.result.current[1](value => value + '!');
  });
  await tick();
  expect(a.result.current[0]).toBe('written!');
  a.unmount();
  b.unmount();
  expect(Channel.ports.every(p => p.closed && p.listeners.size === 0)).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

it('resets key/channel changes and makes old setters/sync calls inert', async () => {
  const hook = renderHook(({ channel, key }) => useSyncedState(channel, key, key), {
    initialProps: { channel: 'a', key: 'one' },
  });
  act(() => {
    hook.result.current[1]('edited');
  });
  const oldSetter = hook.result.current[1];
  const oldSync = hook.result.current[2].sync;
  hook.rerender({ channel: 'a', key: 'two' });
  expect(hook.result.current[0]).toBe('two');
  expect(oldSetter('old edit')).toBe(false);
  expect(await oldSync()).toBe('unavailable');
  expect(Channel.ports[0].closed).toBe(true);
  hook.rerender({ channel: 'b', key: 'two' });
  expect(Channel.ports[1].closed).toBe(true);
  hook.unmount();
  expect(jest.getTimerCount()).toBe(0);
});

it('keeps fallback stable across rerenders and isolates namespaces', async () => {
  const a = renderHook(
    ({ fallback }) => useSyncedState('app', 'k', fallback, { namespace: 'one' }),
    { initialProps: { fallback: 'first' } }
  );
  const b = renderHook(() => useSyncedState('app', 'k', 'other', { namespace: 'two' }));
  a.rerender({ fallback: 'ignored' });
  expect(a.result.current[0]).toBe('first');
  expect(Channel.ports).toHaveLength(2);
  act(() => {
    a.result.current[1]('saved');
  });
  await tick();
  expect(b.result.current[0]).toBe('other');
  a.unmount();
  b.unmount();
});

it('supports explicit no-peer sync and cancels it on unmount', async () => {
  const hook = renderHook(() => useSyncedState('app', 'k', 'fallback'));
  let promise: ReturnType<(typeof hook.result.current)[2]['sync']>;
  act(() => {
    promise = hook.result.current[2].sync();
  });
  await tick();
  expect(await promise!).toBe('no-peer');
  act(() => {
    promise = hook.result.current[2].sync();
  });
  hook.unmount();
  expect(await promise!).toBe('cancelled');
});

it('reports unsupported browser, invalid input and constructor failure without throwing', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.BroadcastChannel = undefined as any;
  const unsupported = renderHook(() => useSyncedState('a', 'k', 'fallback'));
  expect(unsupported.result.current[2].error).toBe('BroadcastChannel is unavailable');
  expect(unsupported.result.current[1]('x')).toBe(false);
  expect(await unsupported.result.current[2].sync()).toBe('unavailable');
  unsupported.unmount();
  global.BroadcastChannel = class {
    constructor() {
      throw new Error('denied');
    }
  } as unknown as typeof BroadcastChannel;
  const failed = renderHook(() => useSyncedState('a', 'k', 'fallback'));
  expect(failed.result.current[2].error).toBe('denied');
  failed.unmount();
  const invalid = renderHook(() => useSyncedState('', 'k', 'fallback'));
  expect(invalid.result.current[2].error).toMatch(/Invalid/);
  invalid.unmount();
});

it('does not change local state on a send failure and can retry a later write', () => {
  const hook = renderHook(() => useSyncedState('a', 'k', 'fallback'));
  Channel.ports[0].fail = true;
  act(() => {
    expect(hook.result.current[1]('lost')).toBe(false);
  });
  expect(hook.result.current[0]).toBe('fallback');
  expect(hook.result.current[2].error).toBe('clone failed');
  Channel.ports[0].fail = false;
  act(() => {
    expect(hook.result.current[1]('saved')).toBe(true);
  });
  expect(hook.result.current[0]).toBe('saved');
  hook.unmount();
});

it('changing only the sync window does not reset a committed value or reopen transport', async () => {
  const hook = renderHook(
    ({ ms }) => useSyncedState('app', 'k', 'fallback', { syncWindowMs: ms }),
    { initialProps: { ms: 250 } }
  );
  act(() => {
    hook.result.current[1]('saved');
  });
  hook.rerender({ ms: 50 });
  expect(hook.result.current[0]).toBe('saved');
  expect(Channel.ports).toHaveLength(1);
  let pending: ReturnType<(typeof hook.result.current)[2]['sync']>;
  act(() => {
    pending = hook.result.current[2].sync();
  });
  await tick(50);
  expect(await pending!).toBe('no-peer');
  hook.unmount();
});

it('validates incoming/local values and clears a prior error on successful write', async () => {
  const validate = (value: unknown): value is string => typeof value === 'string';
  const hook = renderHook(() => useSyncedState('a', 'k', 'fallback', { validate }));
  act(() => {
    Channel.ports[0].deliver({
      protocol: 1,
      key: 'k',
      type: 'set',
      value: 42,
      version: { clock: 2, source: 'peer' },
    });
  });
  expect(hook.result.current[0]).toBe('fallback');
  act(() => {
    expect(hook.result.current[1](42 as unknown as string)).toBe(false);
  });
  expect(hook.result.current[2].error).toBe('Invalid state value');
  act(() => {
    expect(hook.result.current[1]('valid')).toBe(true);
  });
  expect(hook.result.current[2].error).toBeNull();
  hook.unmount();
});

it('contains a throwing application validator instead of throwing from the message listener', () => {
  const hook = renderHook(() =>
    useSyncedState('a', 'k', 'fallback', {
      validate: (_value: unknown): _value is string => {
        throw new Error('bad validator');
      },
    })
  );
  act(() => {
    Channel.ports[0].deliver({
      protocol: 1,
      key: 'k',
      type: 'set',
      value: 'v',
      version: { clock: 2, source: 'peer' },
    });
  });
  expect(hook.result.current[0]).toBe('fallback');
  expect(hook.result.current[2].error).toBe('bad validator');
  hook.unmount();
});
