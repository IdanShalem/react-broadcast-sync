import { createStateSession, StateSessionRecoveryOptions } from '../utils/stateSession';

class Port {
  listeners = new Set<(event: MessageEvent) => void>();
  posted: unknown[] = [];
  fail = false;
  closed = false;
  addEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }
  postMessage(packet: unknown) {
    if (this.fail) throw new Error('clone failed');
    // Per the HTML standard a closed channel throws InvalidStateError before
    // the message is serialized or delivered.
    if (this.closed)
      throw new DOMException('Failed to post on a closed channel', 'InvalidStateError');
    this.posted.push(packet);
  }
  deliver(data: unknown) {
    for (const listener of this.listeners) listener({ data } as MessageEvent);
  }
  close() {
    this.closed = true;
  }
}
const setup = () => {
  const port = new Port();
  const changed = jest.fn();
  const error = jest.fn();
  const session = createStateSession('filters', 'default', () => port, changed, error);
  return { port, changed, error, session };
};

/** Recovery harness: each factory call appends a fresh, optionally born-dead port. */
const setupRecovery = (options: Partial<StateSessionRecoveryOptions> = {}) => {
  const ports: Port[] = [];
  let bornDead = false;
  const changed = jest.fn();
  const error = jest.fn();
  const recovered = jest.fn();
  const session = createStateSession(
    'filters',
    'default',
    () => {
      const port = new Port();
      if (bornDead) port.closed = true;
      ports.push(port);
      return port;
    },
    changed,
    error,
    undefined,
    () => ({
      recovery: options.recovery ?? 'auto',
      maxRecoveryAttempts: options.maxRecoveryAttempts ?? 3,
      syncWindowMs: options.syncWindowMs ?? 250,
      onRecovered: recovered,
    })
  );
  return {
    ports,
    changed,
    error,
    recovered,
    session,
    armBornDead: () => {
      bornDead = true;
    },
    healBornDead: () => {
      bornDead = false;
    },
  };
};
const reply = (request: unknown, clock: number, value: string) => ({
  ...(request as object),
  type: 'response',
  version: { clock, source: 'peer' },
  value,
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('reports no peer without making defaults authoritative', async () => {
  const { session, port } = setup();
  const promise = session.sync();
  port.deliver({ ...reply(port.posted[0], 0, 'peer default'), version: null });
  jest.advanceTimersByTime(250);
  expect(await promise).toBe('no-peer');
  expect(session.getSnapshot().value).toBe('default');
  expect(session.getSnapshot().version).toBeNull();
  session.dispose();
});

it('collects multiple replies until deadline and does not rebroadcast them', async () => {
  const { session, port } = setup();
  const promise = session.sync();
  port.deliver(reply(port.posted[0], 10, 'new'));
  port.deliver(reply(port.posted[0], 2, 'old'));
  expect(session.getSnapshot().value).toBe('new');
  expect(port.posted).toHaveLength(1);
  jest.advanceTimersByTime(250);
  expect(await promise).toBe('received');
  port.deliver(reply(port.posted[0], 20, 'expired'));
  expect(session.getSnapshot().value).toBe('new');
  session.dispose();
});

it('cancels superseded sync and closes exactly once on disposal', async () => {
  const { session, port, changed } = setup();
  const first = session.sync();
  const second = session.sync();
  expect(await first).toBe('cancelled');
  session.dispose();
  session.dispose();
  expect(await second).toBe('cancelled');
  expect(port.listeners.size).toBe(0);
  expect(port.closed).toBe(true);
  const calls = changed.mock.calls.length;
  port.deliver(reply(port.posted[1], 20, 'late'));
  jest.runAllTimers();
  expect(changed.mock.calls).toHaveLength(calls);
  expect(session.setValue('after dispose')).toBe(false);
  expect(await session.sync()).toBe('cancelled');
});

it('surfaces send/clone failure without committing a false successful write', async () => {
  const { session, port, error } = setup();
  port.fail = true;
  expect(session.setValue('lost')).toBe(false);
  expect(session.getSnapshot().value).toBe('default');
  expect(await session.sync()).toBe('send-failed');
  expect(session.getSnapshot().pending).toBeNull();
  expect(error).toHaveBeenCalledTimes(2);
  port.fail = false;
  expect(session.setValue('saved')).toBe(true);
  expect(session.getSnapshot().value).toBe('saved');
  session.dispose();
});

it('preserves original versions when responding to a request, never sends set on receipt', () => {
  const { session, port } = setup();
  session.setValue('saved');
  const version = session.getSnapshot().version;
  port.deliver({ protocol: 1, key: 'filters', type: 'request', requestId: 'other' });
  expect(port.posted[1]).toMatchObject({ type: 'response', value: 'saved', version });
  port.deliver({
    protocol: 1,
    key: 'filters',
    type: 'set',
    version: { clock: 20, source: 'peer' },
    value: 'incoming',
  });
  expect(session.getSnapshot().value).toBe('incoming');
  expect(port.posted).toHaveLength(2);
  session.dispose();
});

it('uses a new source and fresh fallback when a disposed connection is replaced', () => {
  const first = setup();
  first.session.setValue('one');
  first.session.dispose();
  const second = setup();
  expect(second.session.getSnapshot().value).toBe('default');
  second.session.setValue('two');
  expect(first.session.getSnapshot().version?.source).not.toBe(
    second.session.getSnapshot().version?.source
  );
  second.session.dispose();
});

it('rejects invalid windows without leaving a timer', async () => {
  const { session, port, error } = setup();
  expect(await session.sync(-1)).toBe('send-failed');
  expect(await session.sync(Infinity)).toBe('send-failed');
  expect(await session.sync(2147483648)).toBe('send-failed');
  expect(port.posted).toHaveLength(0);
  expect(error).toHaveBeenCalledTimes(3);
  session.dispose();
});

it('counts a matching committed response even if equal, not an unrelated live write', async () => {
  const { session, port } = setup();
  session.setValue('local');
  const first = session.sync();
  port.deliver({
    protocol: 1,
    key: 'filters',
    type: 'set',
    version: { clock: 10, source: 'peer' },
    value: 'live',
  });
  jest.advanceTimersByTime(250);
  expect(await first).toBe('no-peer');
  const second = session.sync();
  port.deliver(reply(port.posted[2], 10, 'live'));
  jest.advanceTimersByTime(250);
  expect(await second).toBe('received');
  session.dispose();
});

it('recovers a provably closed transport, retries the write and resyncs', async () => {
  const { session, ports, recovered, error } = setupRecovery();
  expect(session.setValue('before')).toBe(true);
  // Out-of-band close of the held transport, then a local edit while down.
  ports[0].close();
  expect(session.setValue('after kill')).toBe(true);
  expect(ports).toHaveLength(2);
  expect(ports[0].listeners.size).toBe(0);
  expect(ports[1].posted[0]).toMatchObject({ type: 'set', value: 'after kill' });
  expect(recovered).toHaveBeenCalledTimes(1);
  // The recovery resync re-runs the late-join request on the fresh transport.
  const request = ports[1].posted[1] as { type: string; requestId: string };
  expect(request.type).toBe('request');
  expect(error).not.toHaveBeenCalled();
  expect(session.getSnapshot().value).toBe('after kill');
  // A stale reply to the resync cannot replace the newer local edit.
  ports[1].deliver({
    protocol: 1,
    key: 'filters',
    type: 'response',
    requestId: request.requestId,
    version: { clock: 1, source: 'peer' },
    value: 'stale',
  });
  expect(session.getSnapshot().value).toBe('after kill');
  // A genuinely newer peer state still wins, so the tab converges after downtime.
  ports[1].deliver({
    protocol: 1,
    key: 'filters',
    type: 'response',
    requestId: request.requestId,
    version: { clock: 10, source: 'peer' },
    value: 'peer newer',
  });
  expect(session.getSnapshot().value).toBe('peer newer');
  expect(session.setValue('local again')).toBe(true);
  expect(session.getSnapshot().version?.clock).toBe(11);
  session.dispose();
});

it('manual recovery reports the dead transport and only reconnect revives it', async () => {
  const { session, ports, recovered, error } = setupRecovery({ recovery: 'manual' });
  ports[0].close();
  expect(session.setValue('lost')).toBe(false);
  expect(session.getSnapshot().value).toBe('default');
  expect(ports).toHaveLength(1);
  expect(recovered).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledTimes(1);
  // The provably dead ref is dropped, so an explicit reconnect can start fresh.
  expect(session.reconnect()).toBe(true);
  expect(ports).toHaveLength(2);
  expect(ports[1].posted[0]).toMatchObject({ type: 'request' });
  expect(session.setValue('rescued')).toBe(true);
  expect(recovered).not.toHaveBeenCalled();
  session.dispose();
});

it('exhausts the recovery budget on born-dead replacements, then reconnect rescues', async () => {
  const { session, ports, error, armBornDead, healBornDead } = setupRecovery({
    maxRecoveryAttempts: 2,
  });
  ports[0].close();
  armBornDead();
  expect(session.setValue('x1')).toBe(false); // attempt 1: retry on born-dead fails
  expect(session.setValue('x2')).toBe(false); // attempt 2: same
  expect(session.setValue('x3')).toBe(false); // cap reached: dead ref dropped
  expect(ports).toHaveLength(3);
  healBornDead();
  expect(session.reconnect()).toBe(true);
  expect(ports).toHaveLength(4);
  expect(session.setValue('rescued')).toBe(true);
  expect(error.mock.calls.length).toBeGreaterThan(0);
  session.dispose();
});

it('reconnect is a no-op while the transport is open', () => {
  const { session, ports } = setupRecovery();
  expect(session.reconnect()).toBe(false);
  expect(ports).toHaveLength(1);
  session.dispose();
});

it('a disposed session never recovers and a creation failure reports once', async () => {
  const { session, ports, error, recovered } = setupRecovery();
  ports[0].close();
  session.dispose();
  expect(session.setValue('after dispose')).toBe(false);
  expect(await session.sync()).toBe('cancelled');
  expect(session.reconnect()).toBe(false);
  expect(ports).toHaveLength(1);
  expect(recovered).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();

  const failingError = jest.fn();
  const broken = createStateSession(
    'filters',
    'default',
    () => {
      throw new Error('denied');
    },
    jest.fn(),
    failingError
  );
  expect(failingError).toHaveBeenCalledTimes(1);
  expect(broken.setValue('x')).toBe(false);
  expect(await broken.sync()).toBe('send-failed');
  broken.dispose();
});
