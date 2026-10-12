import type {
  BroadcastOptions,
  SendMessageOptions,
  BroadcastMessage,
  BroadcastActions,
  ClearOptions,
  ClearReceivedMessagesOptions,
  ClearSentMessagesOptions,
  GetLatestMessageOptions,
  MessageCallback,
  OnMessageMap,
  BroadcastProviderProps,
} from '../index';

describe('public type exports', () => {
  it('exposes option, callback and props types from the package root', () => {
    const clear: ClearOptions = { ids: ['a'], types: ['t'] };
    const received: ClearReceivedMessagesOptions = { ...clear, sources: ['s'] };
    const sent: ClearSentMessagesOptions = { ...clear, sync: true };
    const latest: GetLatestMessageOptions = { source: 's', type: 't' };
    const cb: MessageCallback = (msg: BroadcastMessage) => void msg;
    const map: OnMessageMap = { t: cb };
    const opts: BroadcastOptions = { onMessage: map };
    const send: SendMessageOptions = { expirationDuration: 1 };
    const props: BroadcastProviderProps = { channelName: 'c', options: opts, children: null };
    const actions: Pick<BroadcastActions, 'channelName'> = { channelName: 'c' };
    expect([clear, received, sent, latest, map, send, props, actions]).toHaveLength(8);
  });
});

it('exports the state hook and typed setter/status from the package root', () => {
  const options: import('../index').SyncedStateOptions<string> = {
    syncWindowMs: 100,
    validate: (v: unknown): v is string => typeof v === 'string',
  };
  const setter: import('../index').SyncedStateSetter<string> = value => typeof value === 'string';
  const result: import('../index').SyncedStateSyncResult = 'no-peer';
  const status: import('../index').SyncedStateStatus = { error: null, sync: async () => result };
  expect([options, setter, status]).toHaveLength(3);
});
