import { renderHook, act, waitFor } from '@testing-library/react';
import { useBroadcastChannel } from '../hooks/useBroadcastChannel';
import { getInternalMessageType } from '../utils/messageUtils';

let mockChannels: any[] = [];

class MockBroadcastChannel {
  name: string;
  _onmessage: ((event: MessageEvent) => void) | null = null;
  closed = false;
  postMessage = jest.fn();
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

  get onmessage() {
    return this._onmessage;
  }
  set onmessage(fn) {
    this._onmessage = fn;
  }

  constructor(name: string) {
    this.name = name;
    mockChannels.push(this);
  }

  simulateMessage(data: any) {
    if (this.closed || !this._onmessage) return;
    this._onmessage({ data } as MessageEvent);
  }
}

const waitForChannel = async () => {
  return new Promise<void>(resolve => {
    const checkChannel = () => {
      if (mockChannels.length > 0) {
        resolve();
      } else {
        setTimeout(checkChannel, 0);
      }
    };
    checkChannel();
  });
};

beforeAll(() => {
  global.BroadcastChannel = MockBroadcastChannel as any;
});

beforeEach(() => {
  mockChannels = [];
  global.BroadcastChannel = MockBroadcastChannel as any;
});

afterEach(() => {
  jest.clearAllMocks();
  global.BroadcastChannel = MockBroadcastChannel as any;
});

afterAll(() => {
  delete (global as any).BroadcastChannel;
});

describe('useBroadcastChannel', () => {
  it('posts and receives message', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];

    await act(async () => {
      result.current.postMessage('greeting', { text: 'hi' });
      const incomingMessage = {
        id: 'external-1',
        type: 'greeting',
        message: { text: 'hi' },
        source: 'another-tab',
        timestamp: Date.now(),
      };
      channel.simulateMessage(incomingMessage);
    });
    expect(result.current.messages.length).toBe(1);
    expect(result.current.messages[0].message).toEqual({ text: 'hi' });
  });

  it('ignores self messages', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];

    act(() => {
      result.current.postMessage('test', 'msg');
      const selfMsg = result.current.sentMessages[0];
      channel.simulateMessage(selfMsg);
    });

    expect(result.current.messages).toEqual([]);
  });

  it('clears a specific message', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];

    const msg = {
      id: '123',
      type: 'greeting',
      message: 'hi',
      source: 'external',
      timestamp: Date.now(),
    };

    act(() => {
      channel.simulateMessage(msg);
    });

    expect(result.current.messages.length).toBe(1);

    act(() => {
      result.current.clearReceivedMessages({ ids: ['123'] });
    });

    expect(result.current.messages.length).toBe(0);
  });

  it('clears all messages', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];

    act(() => {
      channel.simulateMessage({
        id: '1',
        type: 'a',
        message: 'a',
        source: 'x',
        timestamp: Date.now(),
      });
      channel.simulateMessage({
        id: '2',
        type: 'b',
        message: 'b',
        source: 'x',
        timestamp: Date.now(),
      });
    });

    expect(result.current.messages.length).toBe(2);

    act(() => {
      result.current.clearReceivedMessages();
    });

    expect(result.current.messages.length).toBe(0);
  });

  it('clears sent message', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();

    act(() => {
      result.current.postMessage('test-type', { key: 'value' });
    });

    const sentId = result.current.sentMessages[0]?.id;
    expect(result.current.sentMessages.length).toBe(1);

    act(() => {
      result.current.clearSentMessages({ ids: [sentId] });
    });

    expect(result.current.sentMessages.length).toBe(0);
  });

  it('handles channel not available error', () => {
    jest.useFakeTimers();

    const original = global.BroadcastChannel;
    // @ts-expect-error - Testing invalid input
    delete global.BroadcastChannel;

    const { result } = renderHook(() => useBroadcastChannel('test-channel'));

    act(() => {
      result.current.postMessage('test', { a: 1 });
    });

    expect(result.current.error).toBe(
      'BroadcastChannel is not supported in this browser. Please check browser compatibility.'
    );

    global.BroadcastChannel = original;
    jest.useRealTimers();
  });

  it('sets error when BroadcastChannel is not supported', () => {
    const original = global.BroadcastChannel;
    delete (global as any).BroadcastChannel;

    const { result } = renderHook(() => useBroadcastChannel('unsupported-channel'));

    expect(result.current.error).toBe(
      'BroadcastChannel is not supported in this browser. Please check browser compatibility.'
    );
    global.BroadcastChannel = original;
  });

  it('handles invalid messages', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];

    act(() => {
      channel.simulateMessage({ invalid: 'message' });
    });

    expect(result.current.messages.length).toBe(0);
  });

  it('handles expired messages', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];

    const expiredMessage = {
      id: 'expired-1',
      type: 'test',
      message: 'expired',
      source: 'another-tab',
      timestamp: Date.now() - 1000000,
      expirationDate: Date.now() - 1000000,
    };

    act(() => {
      channel.simulateMessage(expiredMessage);
    });

    expect(result.current.messages.length).toBe(0);
  });

  it('handles duplicate messages within TTL', async () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('test-channel', { deduplicationTTL: 5000 })
    );
    await waitForChannel();
    const channel = mockChannels[0];

    const message = {
      id: 'duplicate-1',
      type: 'test',
      message: 'duplicate',
      source: 'another-tab',
      timestamp: Date.now(),
    };

    act(() => {
      channel.simulateMessage(message);
      channel.simulateMessage(message);
    });

    expect(result.current.messages.length).toBe(1);
  });

  it('handles internal clear message (single id) from other source', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));

    await waitForChannel();

    const channel = mockChannels[0];
    const externalSource = 'external-source';

    const msg = {
      id: 'to-clear',
      type: 'test',
      message: 'should be removed',
      timestamp: Date.now(),
      source: externalSource,
    };

    const internalClear = {
      id: 'internal-id',
      type: getInternalMessageType('CLEAR_SENT_MESSAGES', 'test-channel'),
      message: { ids: ['to-clear'], types: [] },
      timestamp: Date.now(),
      source: externalSource,
    };

    act(() => {
      channel.simulateMessage(msg);
    });

    // await waitFor(() => {
    expect(result.current.messages.length).toBe(1);
    // });

    act(() => {
      channel.simulateMessage(internalClear);
    });

    expect(result.current.messages.length).toBe(0);
  });

  it('handles internal clear all messages (wildcard) from other source', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));

    await waitForChannel();

    const channel = mockChannels[0];
    const externalSource = 'external-source';

    const msg1 = {
      id: 'msg1',
      type: 'type1',
      message: 'first',
      timestamp: Date.now(),
      source: externalSource,
    };

    const msg2 = {
      id: 'msg2',
      type: 'type2',
      message: 'second',
      timestamp: Date.now(),
      source: externalSource,
    };

    const internalClear = {
      id: 'internal-id',
      type: getInternalMessageType('CLEAR_SENT_MESSAGES', 'test-channel'),
      message: { ids: [], types: [] }, // wildcard
      timestamp: Date.now(),
      source: externalSource, // ✅ MUST match msg1/msg2
    };

    await act(async () => {
      channel.simulateMessage(msg1);
    });
    await act(async () => {
      channel.simulateMessage(msg2);
    });

    await act(() => Promise.resolve());

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2);
    });

    await act(async () => {
      channel.simulateMessage(internalClear);
    });

    await act(() => Promise.resolve());

    await waitFor(() => {
      expect(result.current.messages.length).toBe(0); // ✅ Both cleared
    });
  });

  it('performs cleanup of expired messages', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useBroadcastChannel('test-channel', { cleaningInterval: 1000 })
    );
    await waitForChannel();
    const channel = mockChannels[0];

    act(() => {
      channel.simulateMessage({
        id: 'expired-2',
        type: 'test',
        message: 'expired',
        source: 'another-tab',
        timestamp: Date.now() - 1000000,
        expirationDate: Date.now() - 1000000,
      });
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.messages.length).toBe(0);
    jest.useRealTimers();
  });

  it('handles registered types filtering', async () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('test-channel', {
        registeredTypes: ['allowed-type'],
      })
    );
    await waitForChannel();
    const channel = mockChannels[0];

    await act(async () => {
      channel.simulateMessage({
        id: 'unregistered',
        type: 'unregistered-type',
        message: 'test',
        source: 'another-tab',
        timestamp: Date.now(),
      });
    });

    expect(result.current.messages.length).toBe(0);

    await act(async () => {
      channel.simulateMessage({
        id: 'registered',
        type: 'allowed-type',
        message: 'test',
        source: 'another-tab',
        timestamp: Date.now(),
      });
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBe(1);
    });
  });

  it('handles keepLatestMessage option', async () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('test-channel', { keepLatestMessage: true })
    );
    await waitForChannel();
    const channel = mockChannels[0];

    act(() => {
      channel.simulateMessage({
        id: 'msg1',
        type: 'test',
        message: 'first',
        source: 'another-tab',
        timestamp: Date.now(),
      });
      channel.simulateMessage({
        id: 'msg2',
        type: 'test',
        message: 'second',
        source: 'another-tab',
        timestamp: Date.now(),
      });
    });

    expect(result.current.messages.length).toBe(1);
    expect(result.current.messages[0].message).toBe('second');
  });

  it('handles cleanup debounce', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useBroadcastChannel('test-channel', {
        cleaningInterval: 1000,
        cleanupDebounceMs: 500,
      })
    );
    await waitForChannel();
    const channel = mockChannels[0];

    act(() => {
      channel.simulateMessage({
        id: 'expired-3',
        type: 'test',
        message: 'expired',
        source: 'another-tab',
        timestamp: Date.now() - 1000000,
        expirationDate: Date.now() - 1000000,
      });
    });

    act(() => {
      jest.advanceTimersByTime(1500);
    });
    await Promise.resolve();

    expect(result.current.messages.length).toBe(0);
    jest.useRealTimers();
  });

  it('handles error when posting message fails', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];

    act(() => {
      channel.postMessage.mockImplementationOnce(() => {
        throw new Error('Failed to post message');
      });
    });

    act(() => {
      result.current.postMessage('test', { data: 'test' });
    });

    expect(result.current.error).toBe('Failed to send message');
  });

  it('handles error when processing message fails', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];

    const badMessage: any = {};
    Object.defineProperty(badMessage, 'id', {
      get() {
        throw new Error('fail');
      },
    });
    badMessage.type = 'test';
    badMessage.source = 'z';
    badMessage.timestamp = Date.now();

    await act(async () => {
      channel.simulateMessage(badMessage);
      await Promise.resolve();
    });
    await Promise.resolve();
    expect(result.current.error).toBe('Error processing broadcast message');
    jest.useRealTimers();
  });

  it('handles error when BroadcastChannel initialization fails', () => {
    const originalBroadcastChannel = global.BroadcastChannel;
    delete (global as any).BroadcastChannel;

    const { result } = renderHook(() => useBroadcastChannel('test-channel'));

    expect(result.current.error).toBe(
      'BroadcastChannel is not supported in this browser. Please check browser compatibility.'
    );

    global.BroadcastChannel = originalBroadcastChannel;
  });

  it('creates message with expiration duration', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();

    act(() => {
      result.current.postMessage('test', { data: 'test' }, { expirationDuration: 5000 });
    });

    const sentMessage = result.current.sentMessages[0];
    expect(sentMessage.expirationDate).toBeDefined();
    expect(sentMessage.expirationDate).toBeGreaterThan(Date.now());
  });

  it('returns null if there are no messages', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    expect(result.current.getLatestMessage()).toBeNull();
  });

  it('returns the latest message if no options are provided', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];
    const msg1 = {
      id: '1',
      type: 'typeA',
      message: 'first',
      source: 'source1',
      timestamp: Date.now(),
    };
    const msg2 = {
      id: '2',
      type: 'typeB',
      message: 'second',
      source: 'source2',
      timestamp: Date.now() + 1,
    };
    act(() => {
      channel.simulateMessage(msg1);
      channel.simulateMessage(msg2);
    });
    expect(result.current.getLatestMessage()).toEqual(expect.objectContaining(msg2));
  });

  it('returns the latest message matching type', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];
    const msg1 = {
      id: '1',
      type: 'typeA',
      message: 'first',
      source: 'source1',
      timestamp: Date.now(),
    };
    const msg2 = {
      id: '2',
      type: 'typeB',
      message: 'second',
      source: 'source2',
      timestamp: Date.now() + 1,
    };
    const msg3 = {
      id: '3',
      type: 'typeA',
      message: 'third',
      source: 'source3',
      timestamp: Date.now() + 2,
    };
    act(() => {
      channel.simulateMessage(msg1);
      channel.simulateMessage(msg2);
      channel.simulateMessage(msg3);
    });
    expect(result.current.getLatestMessage({ type: 'typeA' })).toEqual(
      expect.objectContaining(msg3)
    );
  });

  it('returns the latest message matching source', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];
    const msg1 = {
      id: '1',
      type: 'typeA',
      message: 'first',
      source: 'source1',
      timestamp: Date.now(),
    };
    const msg2 = {
      id: '2',
      type: 'typeB',
      message: 'second',
      source: 'source2',
      timestamp: Date.now() + 1,
    };
    const msg3 = {
      id: '3',
      type: 'typeA',
      message: 'third',
      source: 'source1',
      timestamp: Date.now() + 2,
    };
    act(() => {
      channel.simulateMessage(msg1);
      channel.simulateMessage(msg2);
      channel.simulateMessage(msg3);
    });
    expect(result.current.getLatestMessage({ source: 'source1' })).toEqual(
      expect.objectContaining(msg3)
    );
  });

  it('returns the latest message matching both type and source', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];
    const msg1 = {
      id: '1',
      type: 'typeA',
      message: 'first',
      source: 'source1',
      timestamp: Date.now(),
    };
    const msg2 = {
      id: '2',
      type: 'typeB',
      message: 'second',
      source: 'source2',
      timestamp: Date.now() + 1,
    };
    const msg3 = {
      id: '3',
      type: 'typeA',
      message: 'third',
      source: 'source1',
      timestamp: Date.now() + 2,
    };
    act(() => {
      channel.simulateMessage(msg1);
      channel.simulateMessage(msg2);
      channel.simulateMessage(msg3);
    });
    expect(result.current.getLatestMessage({ type: 'typeA', source: 'source1' })).toEqual(
      expect.objectContaining(msg3)
    );
  });

  it('returns null if no message matches the filter', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];
    const msg1 = {
      id: '1',
      type: 'typeA',
      message: 'first',
      source: 'source1',
      timestamp: Date.now(),
    };
    act(() => {
      channel.simulateMessage(msg1);
    });
    expect(result.current.getLatestMessage({ type: 'typeB' })).toBeNull();
    expect(result.current.getLatestMessage({ source: 'source2' })).toBeNull();
    expect(result.current.getLatestMessage({ type: 'typeB', source: 'source2' })).toBeNull();
  });

  it('works with keepLatestMessage=true (only one message)', async () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('test-channel', { keepLatestMessage: true })
    );
    await waitForChannel();
    const channel = mockChannels[0];
    const msg1 = {
      id: '1',
      type: 'typeA',
      message: 'first',
      source: 'source1',
      timestamp: Date.now(),
    };
    act(() => {
      channel.simulateMessage(msg1);
    });
    expect(result.current.getLatestMessage()).toEqual(expect.objectContaining(msg1));
  });

  it('returns the latest message in correct order (last one)', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];
    const msg1 = {
      id: '1',
      type: 'typeA',
      message: 'first',
      source: 'source1',
      timestamp: Date.now(),
    };
    const msg2 = {
      id: '2',
      type: 'typeA',
      message: 'second',
      source: 'source1',
      timestamp: Date.now() + 1,
    };
    act(() => {
      channel.simulateMessage(msg1);
      channel.simulateMessage(msg2);
    });
    expect(result.current.getLatestMessage({ type: 'typeA', source: 'source1' })).toEqual(
      expect.objectContaining(msg2)
    );
  });

  it('treats empty string filters as no filter (returns latest message)', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];
    const msg1 = {
      id: '1',
      type: 'typeA',
      message: 'first',
      source: 'source1',
      timestamp: 1000,
    };
    const msg2 = {
      id: '2',
      type: 'typeB',
      message: 'second',
      source: 'source2',
      timestamp: 2000,
    };
    act(() => {
      channel.simulateMessage(msg1);
      channel.simulateMessage(msg2);
    });
    expect(result.current.getLatestMessage({ type: '', source: '' })).toEqual(
      expect.objectContaining(msg2)
    );
  });

  it('returns the last message in array if timestamps are the same', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];
    const msg1 = {
      id: '1',
      type: 'typeA',
      message: 'first',
      source: 'source1',
      timestamp: 1000,
    };
    const msg2 = {
      id: '2',
      type: 'typeA',
      message: 'second',
      source: 'source1',
      timestamp: 1000,
    };
    act(() => {
      channel.simulateMessage(msg1);
      channel.simulateMessage(msg2);
    });
    expect(result.current.getLatestMessage({ type: 'typeA', source: 'source1' })).toEqual(
      expect.objectContaining(msg2)
    );
    jest.spyOn(Date, 'now').mockRestore?.();
  });

  it('returns the last matching message if multiple match the filters', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];
    const msg1 = {
      id: '1',
      type: 'typeA',
      message: 'first',
      source: 'source1',
      timestamp: 1000,
    };
    const msg2 = {
      id: '2',
      type: 'typeB',
      message: 'second',
      source: 'source2',
      timestamp: 2000,
    };
    const msg3 = {
      id: '3',
      type: 'typeA',
      message: 'third',
      source: 'source1',
      timestamp: 3000,
    };
    act(() => {
      channel.simulateMessage(msg1);
      channel.simulateMessage(msg2);
      channel.simulateMessage(msg3);
    });
    // msg1 and msg3 both match typeA/source1 — expect msg3
    expect(result.current.getLatestMessage({ type: 'typeA', source: 'source1' })).toEqual(
      expect.objectContaining(msg3)
    );
  });

  it('closes the BroadcastChannel and removes event listener', async () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('test-channel', { sourceName: 'another-tab' })
    );
    await waitForChannel();
    const channel = mockChannels[0];
    expect(channel.close).not.toHaveBeenCalled();
    result.current.closeChannel();
    expect(channel.close).toHaveBeenCalled();
    expect(channel.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('is idempotent (safe to call multiple times)', async () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('test-channel', { sourceName: 'another-tab' })
    );
    await waitForChannel();
    const channel = mockChannels[0];
    result.current.closeChannel();
    expect(channel.close).toHaveBeenCalledTimes(1);
    result.current.closeChannel();
    // Should not throw or call close again
    expect(channel.close).toHaveBeenCalledTimes(1);
  });

  it('does not send messages after closeChannel is called', async () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('test-channel', { sourceName: 'another-tab' })
    );
    await waitForChannel();
    const channel = mockChannels[0];
    result.current.closeChannel();
    act(() => {
      result.current.postMessage('test', { data: 'should not send' });
    });
    expect(channel.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'test' }));
  });

  it('does not receive messages after closeChannel is called', async () => {
    const { result } = renderHook(() =>
      useBroadcastChannel('test-channel', { sourceName: 'another-tab' })
    );
    await waitForChannel();
    const channel = mockChannels[0];
    result.current.closeChannel();
    act(() => {
      channel.simulateMessage({
        id: 'should-not-receive',
        type: 'test',
        message: 'no',
        source: 'external',
        timestamp: Date.now(),
      });
    });
    expect(result.current.messages).toHaveLength(0);
  });
});
