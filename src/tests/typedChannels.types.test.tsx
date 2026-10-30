import { renderHook } from '@testing-library/react';
import { useBroadcastChannel } from '../hooks/useBroadcastChannel';
import { BroadcastProvider, useBroadcastProvider } from '../BroadcastProvider';
import { BroadcastActions, TypedBroadcastMessage, TypedOnMessageMap } from '../types/types';

type DashboardEvents = {
  filter: { range: string; team: string };
  logout: undefined;
};

// Never called - the body is compile-time checked with full narrowing.
const typedActionAssertions = (actions: BroadcastActions<DashboardEvents>) => {
  actions.postMessage('filter', { range: '7d', team: 'a' });
  actions.postMessage('logout');
  actions.postMessage('logout', undefined);
  // @ts-expect-error - payload must match the declared shape
  actions.postMessage('filter', { range: 7 });
  // @ts-expect-error - unknown message type
  actions.postMessage('flter', {});
  // @ts-expect-error - logout has an undefined payload
  actions.postMessage('logout', { reason: 'x' });

  const latest = actions.getLatestMessage({ type: 'filter' });
  if (latest) {
    const team: string = latest.message.team;
    void team;
  }
  const logoutLatest = actions.getLatestMessage({ type: 'logout' });
  if (logoutLatest) {
    const payload: undefined = logoutLatest.message;
    void payload;
  }
  // @ts-expect-error - unknown message type
  actions.getLatestMessage({ type: 'flter' });

  actions.clearReceivedMessages({ types: ['filter'] });
  // @ts-expect-error - unknown message type
  actions.clearReceivedMessages({ types: ['flter'] });
  actions.clearSentMessages({ types: ['logout'] });
  actions.requestMessagesHistory({ types: ['logout'] });
  // @ts-expect-error - unknown message type
  actions.requestMessagesHistory({ types: ['flter'] });

  const received = actions.messages[0];
  if (received && received.type === 'filter') {
    const range: string = received.message.range;
    void range;
  }
};
void typedActionAssertions;

// Never called - loose (non-generic) usage keeps the pre-2.5 behavior.
const looseActionAssertions = (actions: BroadcastActions) => {
  actions.postMessage('anything', { whatever: 1 });
  actions.postMessage('no-payload-needed');
  actions.getLatestMessage({ type: 'any-string' });
  actions.clearReceivedMessages({ types: ['any-string'] });
  actions.requestMessagesHistory({ types: ['any-string'] });
  const msg = actions.messages[0];
  if (msg) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyPayload: any = msg.message;
    void anyPayload;
  }
};
void looseActionAssertions;

describe('typed channels', () => {
  it('types postMessage, onMessage and registeredTypes from the declared map', () => {
    const { result } = renderHook(() =>
      useBroadcastChannel<DashboardEvents>('typed-test', {
        onMessage: {
          filter: msg => {
            const range: string = msg.message.range;
            void range;
            // @ts-expect-error - the payload is typed, unknown fields fail
            void msg.message.nope;
          },
          // @ts-expect-error - only declared message types are valid keys
          unknown: () => {},
        },
        registeredTypes: ['filter', 'logout'],
      })
    );
    typedActionAssertions(result.current);
    expect(result.current.channelName).toBe('typed-test');
  });

  it('stays loose when the generic is omitted', () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('loose-test', {
        onMessage: {
          anything: msg => void msg.message.whatever,
        },
        registeredTypes: ['anything'],
      })
    );
    looseActionAssertions(result.current);
    expect(result.current.channelName).toBe('loose-test');
  });

  it('types the provider and its context hook', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BroadcastProvider<DashboardEvents> channelName="typed-provider-test">
        {children}
      </BroadcastProvider>
    );
    const { result } = renderHook(() => useBroadcastProvider<DashboardEvents>(), { wrapper });
    typedActionAssertions(result.current);
    expect(result.current.channelName).toBe('typed-provider-test');
  });

  it('exports the typed helper types', () => {
    const handlers: TypedOnMessageMap<DashboardEvents> = {
      filter: msg => {
        const range: string = msg.message.range;
        void range;
      },
    };
    const message: TypedBroadcastMessage<DashboardEvents, 'logout'> = {
      id: '1',
      type: 'logout',
      message: undefined,
      timestamp: 0,
      source: 's',
    };
    expect([handlers, message]).toHaveLength(2);
  });
});
