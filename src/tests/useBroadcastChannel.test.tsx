import { renderHook, act } from '@testing-library/react';
import { useBroadcastChannel } from '../hooks/useBroadcastChannel';

let mockChannels: any[] = [];

class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = jest.fn();
  close = jest.fn();
  addEventListener = jest.fn((event: string, callback: (event: MessageEvent) => void) => {
    if (event === 'message') {
      this.onmessage = callback;
    }
  });
  removeEventListener = jest.fn();

  constructor(name: string) {
    this.name = name;
    mockChannels.push(this);
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }
}

const waitForChannel = async () => {
  return new Promise<void>((resolve) => {
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

    act(() => {
      result.current.postMessage('greeting', { text: 'hi' });
    });

    const incomingMessage = {
      id: 'external-1',
      type: 'greeting',
      message: { text: 'hi' },
      source: 'another-tab',
      timestamp: Date.now()
    };

    act(() => {
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
      timestamp: Date.now()
    };

    act(() => {
      channel.simulateMessage(msg);
    });

    expect(result.current.messages.length).toBe(1);

    act(() => {
      result.current.clearMessage('123');
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
        timestamp: Date.now()
      });
      channel.simulateMessage({
        id: '2',
        type: 'b',
        message: 'b',
        source: 'x',
        timestamp: Date.now()
      });
    });

    expect(result.current.messages.length).toBe(2);

    act(() => {
      result.current.clearAllMessages();
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
      result.current.clearSentMessage(sentId);
    });

    expect(result.current.sentMessages.length).toBe(0);
  });

  it('handles channel not available error', () => {
    jest.useFakeTimers();

    const original = global.BroadcastChannel;
    // @ts-ignore
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

    expect(result.current.error).toBe('BroadcastChannel is not supported in this browser. Please check browser compatibility.');
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
      expirationDate: Date.now() - 1000000
    };

    act(() => {
      channel.simulateMessage(expiredMessage);
    });

    expect(result.current.messages.length).toBe(0);
  });

  it('handles duplicate messages within TTL', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel', { deduplicationTTL: 5000 }));
    await waitForChannel();
    const channel = mockChannels[0];

    const message = {
      id: 'duplicate-1',
      type: 'test',
      message: 'duplicate',
      source: 'another-tab',
      timestamp: Date.now()
    };

    act(() => {
      channel.simulateMessage(message);
      channel.simulateMessage(message);
    });

    expect(result.current.messages.length).toBe(1);
  });

  it('handles internal clear message from other source', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];

    act(() => {
      channel.simulateMessage({
        id: 'to-clear',
        type: 'test',
        message: 'will be cleared',
        source: 'another-tab',
        timestamp: Date.now()
      });
    });

    expect(result.current.messages.length).toBe(1);

    act(() => {
      channel.simulateMessage({
        id: 'to-clear',
        type: '__INTERNAL__:CLEAR_MESSAGE:' + btoa('react-broadcast-sync:CLEAR_MESSAGE:test-channel-'),
        source: 'another-tab',
        timestamp: Date.now()
      });
    });

    expect(result.current.messages.length).toBe(0);
  });

  it('handles internal clear all messages from other source', async () => {
    const { result } = renderHook(() => useBroadcastChannel('test-channel'));
    await waitForChannel();
    const channel = mockChannels[0];

    act(() => {
      channel.simulateMessage({
        id: 'msg1',
        type: 'test1',
        message: 'first',
        source: 'another-tab',
        timestamp: Date.now()
      });
      channel.simulateMessage({
        id: 'msg2',
        type: 'test2',
        message: 'second',
        source: 'another-tab',
        timestamp: Date.now()
      });
    });

    expect(result.current.messages.length).toBe(2);

    act(() => {
      channel.simulateMessage({
        id: '__INTERNAL__:CLEAR_ALL_MESSAGES:' + btoa('react-broadcast-sync:CLEAR_ALL_MESSAGES:test-channel-'),
        type: '__INTERNAL__:CLEAR_ALL_MESSAGES:' + btoa('react-broadcast-sync:CLEAR_ALL_MESSAGES:test-channel-'),
        source: 'another-tab',
        timestamp: Date.now()
      });
    });

    expect(result.current.messages.length).toBe(0);
  });

  it('performs cleanup of expired messages', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useBroadcastChannel('test-channel', { cleaningInterval: 1000 }));
    await waitForChannel();
    const channel = mockChannels[0];

    act(() => {
      channel.simulateMessage({
        id: 'expired-2',
        type: 'test',
        message: 'expired',
        source: 'another-tab',
        timestamp: Date.now() - 1000000,
        expirationDate: Date.now() - 1000000
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
      useBroadcastChannel('test-channel', { registeredTypes: ['allowed-type'] })
    );
    await waitForChannel();
    const channel = mockChannels[0];

    act(() => {
      channel.simulateMessage({
        id: 'unregistered',
        type: 'unregistered-type',
        message: 'test',
        source: 'another-tab',
        timestamp: Date.now()
      });
    });

    expect(result.current.messages.length).toBe(0);

    act(() => {
      channel.simulateMessage({
        id: 'registered',
        type: 'allowed-type',
        message: 'test',
        source: 'another-tab',
        timestamp: Date.now()
      });
    });

    expect(result.current.messages.length).toBe(1);
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
        timestamp: Date.now()
      });
      channel.simulateMessage({
        id: 'msg2',
        type: 'test',
        message: 'second',
        source: 'another-tab',
        timestamp: Date.now()
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
        cleanupDebounceMs: 500
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
        expirationDate: Date.now() - 1000000
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

    channel.postMessage.mockImplementationOnce(() => {
      throw new Error('Failed to post message');
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
      get() { throw new Error('fail'); }
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

    expect(result.current.error).toBe('BroadcastChannel is not supported in this browser. Please check browser compatibility.');

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
});
