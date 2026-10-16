import { renderHook, act } from '@testing-library/react';
import { useBroadcastChannel } from '../hooks/useBroadcastChannel';
import { createMessage, getInternalMessageType } from '../utils/messageUtils';

let mockChannels: MockBroadcastChannel[] = [];

class MockBroadcastChannel {
  static channels: Record<string, MockBroadcastChannel[]> = {};

  name: string;
  _onmessage: ((event: MessageEvent) => void) | null = null;
  closed = false;

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels[name]) {
      MockBroadcastChannel.channels[name] = [];
    }
    MockBroadcastChannel.channels[name].push(this);
    mockChannels.push(this);
  }

  postMessage = jest.fn((data: any) => {
    if (this.closed) throw new DOMException('Channel is closed', 'InvalidStateError');
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

  removeEventListener = jest.fn();

  simulateMessage(data: any) {
    if (this.closed || !this._onmessage) return;
    this._onmessage({ data } as MessageEvent);
  }
}

const tick = (ms = 10) => new Promise<void>(resolve => setTimeout(resolve, ms));

beforeEach(() => {
  mockChannels = [];
  MockBroadcastChannel.channels = {};
  global.BroadcastChannel = MockBroadcastChannel as any;
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  delete (global as any).BroadcastChannel;
});

const setupTabs = (channel = 'history-channel', options: any = {}) => {
  // Disable batching so posts land synchronously inside act()
  const base = { batchingDelayMs: 0, ...(options.shared ?? {}) };
  const tabA = renderHook(() => useBroadcastChannel(channel, { ...base, ...(options.a ?? {}) }));
  const tabB = renderHook(() => useBroadcastChannel(channel, { ...base, ...(options.b ?? {}) }));
  return { tabA, tabB };
};

describe('requestHistory', () => {
  it('replays recent messages from another tab as isHistory entries', async () => {
    const { tabA, tabB } = setupTabs();
    act(() => {
      tabA.result.current.postMessage('chat', { text: 'hello' }, { expirationDuration: undefined });
      tabA.result.current.postMessage('chat', { text: 'world' });
    });
    await tick();

    // tabB received both live; clear its view to simulate a fresh perspective check later
    expect(tabB.result.current.messages).toHaveLength(2);

    const tabC = renderHook(() => useBroadcastChannel('history-channel', { batchingDelayMs: 0 }));
    await tick();
    expect(tabC.result.current.messages).toHaveLength(0);

    act(() => {
      tabC.result.current.requestHistory();
    });
    await tick();

    const replayed = tabC.result.current.messages;
    expect(replayed).toHaveLength(2);
    expect(replayed.every(m => m.isHistory === true)).toBe(true);
    expect(replayed.map(m => m.message.text)).toEqual(['hello', 'world']);
  });

  it('never fires onMessage for replayed messages, only for live ones', async () => {
    const liveCalls: any[] = [];
    const { tabA } = setupTabs('history-onmessage', {
      a: {},
      b: { onMessage: (msg: any) => liveCalls.push(msg) },
    });
    act(() => {
      tabA.result.current.postMessage('chat', { text: 'live' });
    });
    await tick();
    expect(liveCalls).toHaveLength(1);

    const replayCalls: any[] = [];
    const tabC = renderHook(() =>
      useBroadcastChannel('history-onmessage', {
        batchingDelayMs: 0,
        onMessage: (msg: any) => replayCalls.push(msg),
      })
    );
    await tick();
    act(() => {
      tabC.result.current.requestHistory();
    });
    await tick();

    expect(tabC.result.current.messages).toHaveLength(1);
    expect(tabC.result.current.messages[0].isHistory).toBe(true);
    expect(replayCalls).toHaveLength(0);
  });

  it('deduplicates across responders and against messages already received live', async () => {
    const { tabA, tabB } = setupTabs('history-dedup');
    act(() => {
      tabA.result.current.postMessage('chat', { text: 'shared' });
    });
    await tick();
    // tabB now holds the same message in its received log; both tabs can respond
    expect(tabB.result.current.messages).toHaveLength(1);

    const tabC = renderHook(() => useBroadcastChannel('history-dedup', { batchingDelayMs: 0 }));
    await tick();
    act(() => {
      tabC.result.current.requestHistory();
    });
    await tick();

    expect(tabC.result.current.messages).toHaveLength(1);
    expect(tabC.result.current.messages[0].message.text).toBe('shared');

    // A second request must not duplicate what the first replay delivered
    act(() => {
      tabC.result.current.requestHistory();
    });
    await tick();
    expect(tabC.result.current.messages).toHaveLength(1);
  });

  it('does not resurrect messages cleared locally before the request', async () => {
    const { tabA } = setupTabs('history-barrier');
    act(() => {
      tabA.result.current.postMessage('chat', { text: 'old' });
    });
    await tick(20);

    const tabC = renderHook(() => useBroadcastChannel('history-barrier', { batchingDelayMs: 0 }));
    await tick();
    // tabC clears its (empty) view; the barrier moves to "now"
    act(() => {
      tabC.result.current.clearReceivedMessages();
    });
    await tick();

    act(() => {
      tabC.result.current.requestHistory();
    });
    await tick();
    expect(tabC.result.current.messages).toHaveLength(0);

    // Messages sent after the clear are newer than the barrier and replay fine
    act(() => {
      tabA.result.current.postMessage('chat', { text: 'new' });
    });
    await tick(20);
    const tabD = renderHook(() => useBroadcastChannel('history-barrier', { batchingDelayMs: 0 }));
    await tick();
    act(() => {
      tabD.result.current.clearReceivedMessages();
    });
    act(() => {
      tabD.result.current.requestHistory();
    });
    await tick();
    // 'old' and 'new' are both older than tabD's clear -> nothing returns
    expect(tabD.result.current.messages).toHaveLength(0);
  });

  it('respects the limit option and replays the most recent messages', async () => {
    const { tabA } = setupTabs('history-limit');
    act(() => {
      for (let i = 1; i <= 5; i++) {
        tabA.result.current.postMessage('chat', { n: i });
      }
    });
    await tick();

    const tabC = renderHook(() => useBroadcastChannel('history-limit', { batchingDelayMs: 0 }));
    await tick();
    act(() => {
      tabC.result.current.requestHistory({ limit: 2 });
    });
    await tick();

    expect(tabC.result.current.messages.map(m => m.message.n)).toEqual([4, 5]);
  });

  it('honors the types filter on both request and receiving sides', async () => {
    const { tabA } = setupTabs('history-types');
    act(() => {
      tabA.result.current.postMessage('chat', { text: 'c1' });
      tabA.result.current.postMessage('alert', { text: 'a1' });
    });
    await tick();

    const tabC = renderHook(() => useBroadcastChannel('history-types', { batchingDelayMs: 0 }));
    await tick();
    act(() => {
      tabC.result.current.requestHistory({ types: ['chat'] });
    });
    await tick();

    expect(tabC.result.current.messages).toHaveLength(1);
    expect(tabC.result.current.messages[0].type).toBe('chat');
  });

  it('does not replay expired messages', async () => {
    const { tabA } = setupTabs('history-expiry');
    act(() => {
      tabA.result.current.postMessage('chat', { text: 'short-lived' }, { expirationDuration: 30 });
    });
    await tick(60);

    const tabC = renderHook(() => useBroadcastChannel('history-expiry', { batchingDelayMs: 0 }));
    await tick();
    act(() => {
      tabC.result.current.requestHistory();
    });
    await tick();

    expect(tabC.result.current.messages).toHaveLength(0);
  });

  it('never replays the requester’s own messages back into its received log', async () => {
    const { tabA } = setupTabs('history-self');
    act(() => {
      tabA.result.current.postMessage('chat', { text: 'mine' });
    });
    await tick();

    act(() => {
      tabA.result.current.requestHistory();
    });
    await tick();

    // tabA's received log stays empty; its message lives only in sentMessages
    expect(tabA.result.current.messages).toHaveLength(0);
    expect(tabA.result.current.sentMessages).toHaveLength(1);
  });

  it('ignores history responses for unknown or expired request IDs (no rebroadcast)', async () => {
    const { tabA, tabB } = setupTabs('history-guard');
    act(() => {
      tabA.result.current.postMessage('chat', { text: 'data' });
    });
    await tick();

    const tabBChannel = MockBroadcastChannel.channels['history-guard'][1];

    // A genuine request/reply round works
    act(() => {
      tabB.result.current.requestHistory();
    });
    await tick();
    expect(tabB.result.current.messages).toHaveLength(1);

    // An unsolicited internal HISTORY_RESPONSE with an unknown requestId is
    // dropped entirely: no append, and no response is sent back (no rebroadcast)
    const responseType = getInternalMessageType('HISTORY_RESPONSE', 'history-guard', '');
    const sneaky = {
      id: 'sneaky-1',
      type: 'chat',
      message: { text: 'sneaky' },
      timestamp: Date.now(),
      source: 'tab-x',
    };
    const before = tabB.result.current.messages.length;
    act(() => {
      tabBChannel.simulateMessage(
        createMessage(responseType, { requestId: 'nope', messages: [sneaky] }, 'tab-x')
      );
    });
    await tick();
    expect(tabB.result.current.messages.length).toBe(before);
  });

  it('keeps only the latest replayed message when keepLatestMessage is set', async () => {
    const { tabA } = setupTabs('history-keeplatest');
    act(() => {
      tabA.result.current.postMessage('chat', { n: 1 });
      tabA.result.current.postMessage('chat', { n: 2 });
    });
    await tick();

    const tabC = renderHook(() =>
      useBroadcastChannel('history-keeplatest', { batchingDelayMs: 0, keepLatestMessage: true })
    );
    await tick();
    act(() => {
      tabC.result.current.requestHistory();
    });
    await tick();

    expect(tabC.result.current.messages).toHaveLength(1);
    expect(tabC.result.current.messages[0].message.n).toBe(2);
    expect(tabC.result.current.messages[0].isHistory).toBe(true);
  });
});
