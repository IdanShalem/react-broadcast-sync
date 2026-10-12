import { createStateSession } from '../utils/stateSession';

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
  const session = createStateSession('filters', 'default', port, changed, error);
  return { port, changed, error, session };
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
  expect(port.posted).toHaveLength(0);
  expect(error).toHaveBeenCalledTimes(2);
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
