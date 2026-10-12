import {
  finishStateRequest,
  initialStateSnapshot,
  isStatePacket,
  localStateWrite,
  receiveStatePacket,
  startStateRequest,
  StatePacket,
} from '../utils/stateProtocol';

const request = (id = 'join') =>
  startStateRequest(initialStateSnapshot('fallback'), 'filters', id).state;
const response = (clock: number, source: string, value = source) => ({
  protocol: 1,
  key: 'filters',
  type: 'response',
  requestId: 'join',
  version: { clock, source },
  value,
});

it('joins written state and replies with the original version, not a new write', () => {
  const write = localStateWrite(initialStateSnapshot('fallback'), 'filters', 'a', 'saved')!;
  const req = startStateRequest(request(), 'filters', 'join');
  const reply = receiveStatePacket(write.state, 'filters', req.packet);
  expect(reply.state).toBe(write.state);
  expect(reply.reply).toEqual({ ...response(1, 'a', 'saved') });
  const received = receiveStatePacket(req.state, 'filters', reply.reply);
  expect(received.state.value).toBe('saved');
  expect(received.reply).toBeUndefined();
});

it('gathers greatest response independently of peer arrival order', () => {
  const peers = [response(1, 'z'), response(5, 'a'), response(5, 'b')];
  for (const order of [peers, [...peers].reverse(), [peers[1], peers[0], peers[2]]]) {
    const state = order.reduce((s, p) => receiveStatePacket(s, 'filters', p).state, request());
    expect(state.value).toBe('b');
    expect(state.pending).toBe('join');
    expect(finishStateRequest(state, 'join').pending).toBeNull();
  }
});

it('does not let stale bootstrap replace a newer local edit or live write', () => {
  const observed = receiveStatePacket(request(), 'filters', response(20, 'a')).state;
  const edited = localStateWrite(observed, 'filters', 'local', 'edit')!;
  expect(edited.state.version?.clock).toBe(21);
  expect(receiveStatePacket(edited.state, 'filters', response(20, 'z')).state.value).toBe('edit');
  const live = { ...response(30, 'live'), type: 'set' };
  const received = receiveStatePacket(edited.state, 'filters', live);
  expect(received.reply).toBeUndefined();
  expect(receiveStatePacket(received.state, 'filters', response(29, 'peer')).state.value).toBe(
    'live'
  );
});

it('converges concurrent writes without rebroadcast in either order', () => {
  const a = localStateWrite(initialStateSnapshot(''), 'filters', 'a', 'A')!;
  const b = localStateWrite(initialStateSnapshot(''), 'filters', 'b', 'B')!;
  for (const order of [
    [a.packet, b.packet],
    [b.packet, a.packet],
  ]) {
    const final = order.reduce((s, p) => {
      const received = receiveStatePacket(s, 'filters', p);
      expect(received.reply).toBeUndefined();
      return received.state;
    }, initialStateSnapshot(''));
    expect(final.value).toBe('B');
  }
});

it('observes an unmatched/expired response clock without applying its value', () => {
  const unmatched = { ...response(100, 'peer'), requestId: 'old' };
  const state = receiveStatePacket(request(), 'filters', unmatched).state;
  expect(state.value).toBe('fallback');
  expect(localStateWrite(state, 'filters', 'a', 'edit')?.state.clock).toBe(101);
  const closed = finishStateRequest(state, 'join');
  expect(receiveStatePacket(closed, 'filters', response(102, 'peer')).state.value).toBe('fallback');
});

it('does not let an old timer end a new request', () => {
  const state = startStateRequest(request(), 'filters', 'new').state;
  expect(finishStateRequest(state, 'join')).toBe(state);
  expect(receiveStatePacket(state, 'filters', response(1, 'peer')).state.value).toBe('fallback');
});

it('keeps disagreeing uncommitted defaults separate and supports no-peer timeout', () => {
  const state = request();
  const fallback = { ...response(0, 'peer', 'other default'), version: null };
  expect(receiveStatePacket(state, 'filters', fallback).state).toBe(state);
  expect(finishStateRequest(state, 'join').value).toBe('fallback');
});

it.each([
  null,
  {},
  { ...response(1, 'a'), protocol: 2 },
  { ...response(1, 'a'), key: '' },
  { ...response(1, 'a'), requestId: '' },
  { ...response(1, 'a'), version: { clock: -1, source: 'a' } },
  { ...response(1, 'a'), version: { clock: Number.MAX_SAFE_INTEGER + 1, source: 'a' } },
  { ...response(1, 'a'), type: 'unknown' },
  { protocol: 1, key: 'filters', type: 'set', version: { clock: 1, source: 'a' } },
])('ignores malformed packets without state changes: %p', packet => {
  const state = request();
  expect(isStatePacket(packet)).toBe(false);
  expect(receiveStatePacket(state, 'filters', packet).state).toBe(state);
});

it('isolates keys and ignores duplicate versions, even with different values', () => {
  const state = receiveStatePacket(request(), 'filters', response(1, 'a')).state;
  expect(receiveStatePacket(state, 'filters', { ...response(100, 'a'), key: 'other' }).state).toBe(
    state
  );
  expect(receiveStatePacket(state, 'filters', response(1, 'a', 'changed')).state.value).toBe('a');
});

it('allows undefined app values but rejects invalid local writes/clock overflow', () => {
  const packet: StatePacket<undefined> = {
    protocol: 1,
    type: 'set',
    key: 'filters',
    version: { clock: 1, source: 'a' },
    value: undefined,
  };
  expect(isStatePacket(packet)).toBe(true);
  const state = { ...request(), clock: Number.MAX_SAFE_INTEGER };
  expect(localStateWrite(state, 'filters', 'a', 'x')).toBeNull();
  expect(localStateWrite(request(), 'filters', '', 'x')).toBeNull();
  expect(localStateWrite(request(), '', 'a', 'x')).toBeNull();
});
