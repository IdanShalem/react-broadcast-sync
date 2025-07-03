import { renderHook, act, waitFor } from '@testing-library/react';
import { useBroadcastChannel } from '../hooks/useBroadcastChannel';
import { getInternalMessageType } from '../utils/messageUtils';

let mockChannels: any[] = [];

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
    mockChannels.push(this); // keep your existing tracking
  }

  postMessage = jest.fn((data: any) => {
    const others = MockBroadcastChannel.channels[this.name] || [];
    for (const channel of others) {
      if (channel !== this && !channel.closed && channel._onmessage) {
        // Support both single and batched (array) messages
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

  get onmessage() {
    return this._onmessage;
  }
  set onmessage(fn) {
    this._onmessage = fn;
  }

  simulateMessage(data: any) {
    if (this.closed || !this._onmessage) return;
    // Support both single and batched (array) messages
    if (Array.isArray(data)) {
      data.forEach(msg => this._onmessage!({ data: msg } as MessageEvent));
    } else {
      this._onmessage({ data } as MessageEvent);
    }
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
  MockBroadcastChannel.channels = {};
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
  describe('Core Functionality', () => {
    it('posts and receives message', async () => {
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel('test-channel', { sourceName: 'source-1' })
      );
      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel('test-channel', { sourceName: 'source-2' })
      );
      await waitForChannel();

      act(() => {
        hook1.current.postMessage('greeting', { text: 'hi' });
      });

      await waitFor(() => {
        expect(hook2.current.messages.length).toBe(1);
      });

      expect(hook2.current.messages[0].message).toEqual({ text: 'hi' });
      expect(hook2.current.messages[0].source).toBe('source-1');
    });

    it('ignores self messages', async () => {
      const { result } = renderHook(() => useBroadcastChannel('test-channel'));
      await waitForChannel();

      act(() => {
        result.current.postMessage('test', 'msg');
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.sentMessages.length).toBe(1);
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

  describe('Message Clearing', () => {
    it('clears a specific received message', async () => {
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

    it('clears all received messages', async () => {
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

    it('clears a specific sent message', async () => {
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

      expect(result.current.messages.length).toBe(1);

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
        source: externalSource,
      };

      act(() => {
        channel.simulateMessage(msg1);
        channel.simulateMessage(msg2);
      });

      await waitFor(() => {
        expect(result.current.messages.length).toBe(2);
      });

      act(() => {
        channel.simulateMessage(internalClear);
      });

      await waitFor(() => {
        expect(result.current.messages.length).toBe(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('handles channel not available error on postMessage', () => {
      const original = global.BroadcastChannel;
      delete (global as any).BroadcastChannel;

      const { result } = renderHook(() => useBroadcastChannel('test-channel'));

      act(() => {
        result.current.postMessage('test', { a: 1 });
      });

      expect(result.current.error).toBe(
        'BroadcastChannel is not supported in this browser. Please check browser compatibility.'
      );

      global.BroadcastChannel = original;
    });

    it('sets error when BroadcastChannel is not supported on initialization', () => {
      const original = global.BroadcastChannel;
      delete (global as any).BroadcastChannel;

      const { result } = renderHook(() => useBroadcastChannel('unsupported-channel'));

      expect(result.current.error).toBe(
        'BroadcastChannel is not supported in this browser. Please check browser compatibility.'
      );
      global.BroadcastChannel = original;
    });

    it('handles error when posting message fails', async () => {
      const { result } = renderHook(() =>
        useBroadcastChannel('test-channel', { batchingDelayMs: 0 })
      );
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

      act(() => {
        channel.simulateMessage(badMessage);
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Error processing broadcast message');
      });
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
  });

  describe('Message Lifecycle & Cleanup', () => {
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

      expect(result.current.messages.length).toBe(0);
      jest.useRealTimers();
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
  });

  describe('Hook Options', () => {
    it('handles registered types filtering', async () => {
      const { result } = renderHook(() =>
        useBroadcastChannel('test-channel', {
          registeredTypes: ['allowed-type'],
        })
      );
      await waitForChannel();
      const channel = mockChannels[0];

      act(() => {
        channel.simulateMessage({
          id: 'unregistered',
          type: 'unregistered-type',
          message: 'test',
          source: 'another-tab',
          timestamp: Date.now(),
        });
      });

      expect(result.current.messages.length).toBe(0);

      act(() => {
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
  });

  describe('getLatestMessage', () => {
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
  });

  describe('Channel Management', () => {
    it('closes the BroadcastChannel and removes event listener', async () => {
      const { unmount } = renderHook(() =>
        useBroadcastChannel('test-channel', { sourceName: 'another-tab' })
      );
      await waitForChannel();
      const channel = mockChannels[0];
      expect(channel.close).not.toHaveBeenCalled();

      unmount();
      expect(channel.close).toHaveBeenCalled();
      expect(channel.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('is idempotent (safe to call multiple times)', async () => {
      const { result } = renderHook(() =>
        useBroadcastChannel('test-channel', { sourceName: 'another-tab' })
      );
      await waitForChannel();
      const channel = mockChannels[0];

      act(() => {
        result.current.closeChannel();
      });
      expect(channel.close).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.closeChannel();
      });
      // Should not throw or call close again
      expect(channel.close).toHaveBeenCalledTimes(1);
    });

    it('does not send messages after closeChannel is called', async () => {
      const { result } = renderHook(() =>
        useBroadcastChannel('test-channel', { sourceName: 'another-tab' })
      );
      await waitForChannel();
      const channel = mockChannels[0];

      act(() => {
        result.current.closeChannel();
      });

      act(() => {
        result.current.postMessage('test', { data: 'should not send' });
      });
      expect(channel.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'test' })
      );
    });

    it('does not receive messages after closeChannel is called', async () => {
      const { result } = renderHook(() =>
        useBroadcastChannel('test-channel', { sourceName: 'another-tab' })
      );
      await waitForChannel();
      const channel = mockChannels[0];

      act(() => {
        result.current.closeChannel();
      });

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

  describe('Ping Functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return empty array when BroadcastChannel is not available', async () => {
      const original = global.BroadcastChannel;
      delete (global as any).BroadcastChannel;

      const { result } = renderHook(() => useBroadcastChannel('test-channel'));

      let sources: string[] = [];
      await act(async () => {
        sources = await result.current.ping();
      });

      expect(sources).toEqual([]);
      expect(result.current.error).toBe(
        'BroadcastChannel is not supported in this browser. Please check browser compatibility.'
      );

      global.BroadcastChannel = original;
    });

    it('should collect active sources within timeout period', async () => {
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel('test-channel', { sourceName: 'source-1' })
      );
      renderHook(() => useBroadcastChannel('test-channel', { sourceName: 'source-2' }));
      renderHook(() => useBroadcastChannel('test-channel', { sourceName: 'source-3' }));

      await waitForChannel();

      let activeSources: string[] = [];
      await act(async () => {
        const pingPromise = hook1.current.ping(100);
        await Promise.resolve();
        jest.advanceTimersByTime(100);
        activeSources = await pingPromise;
      });

      expect(activeSources).toHaveLength(2);
      expect(activeSources).toContain('source-2');
      expect(activeSources).toContain('source-3');
      expect(activeSources).not.toContain('source-1');
    });

    it('should respect custom timeout duration', async () => {
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel('test-channel', { sourceName: 'source-1' })
      );
      renderHook(() => useBroadcastChannel('test-channel', { sourceName: 'source-2' }));

      await waitForChannel();

      let activeSources: string[] = [];
      await act(async () => {
        const pingPromise = hook1.current.ping(500);
        await Promise.resolve();
        jest.advanceTimersByTime(500);
        activeSources = await pingPromise;
      });

      expect(activeSources).toHaveLength(1);
      expect(activeSources).toContain('source-2');
    });

    it('should handle multiple concurrent pings', async () => {
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel('test-channel', { sourceName: 'source-1' })
      );
      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel('test-channel', { sourceName: 'source-2' })
      );

      await waitForChannel();

      let sources1: string[] = [];
      let sources2: string[] = [];
      await act(async () => {
        const p1 = hook1.current.ping(200);
        const p2 = hook2.current.ping(200);
        await Promise.resolve();
        jest.advanceTimersByTime(201);
        [sources1, sources2] = await Promise.all([p1, p2]);
      });

      expect(sources1).toHaveLength(1);
      expect(sources1).toContain('source-2');
      expect(sources2).toHaveLength(1);
      expect(sources2).toContain('source-1');
    });

    it('should not collect responses after timeout', async () => {
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel('test-channel', { sourceName: 'source-1' })
      );
      renderHook(() => useBroadcastChannel('test-channel', { sourceName: 'source-2' }));

      await waitForChannel();
      const hook1Channel = mockChannels[0];

      let activeSources: string[] = [];
      await act(async () => {
        const pingPromise = hook1.current.ping(500);
        await Promise.resolve();
        // Simulate a late response after timeout
        jest.advanceTimersByTime(501);
        await Promise.resolve();
        hook1Channel.simulateMessage({
          id: 'late-pong',
          type: getInternalMessageType('PONG', 'test-channel'),
          message: null,
          source: 'source-3',
          timestamp: Date.now(),
        });
        activeSources = await pingPromise;
      });

      expect(activeSources).toHaveLength(1);
      expect(activeSources).toContain('source-2');
      expect(activeSources).not.toContain('source-3');
    });

    it('should handle closed channels during ping', async () => {
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel('test-channel', { sourceName: 'source-1' })
      );
      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel('test-channel', { sourceName: 'source-2' })
      );

      await waitForChannel();

      act(() => {
        hook2.current.closeChannel();
      });

      let activeSources: string[] = [];
      await act(async () => {
        const pingPromise = hook1.current.ping(100);
        await Promise.resolve();
        jest.advanceTimersByTime(150);
        activeSources = await pingPromise;
      });

      expect(activeSources).toHaveLength(0);
    });

    it('should ignore second ping call if one is in progress', async () => {
      const { result } = renderHook(() => useBroadcastChannel('test-channel', { sourceName: 'A' }));
      renderHook(() => useBroadcastChannel('test-channel', { sourceName: 'B' }));

      await waitForChannel();

      let res1: string[] = [];
      let res2: string[] = [];
      await act(async () => {
        const p1 = result.current.ping(200);
        await Promise.resolve();
        const p2 = result.current.ping(200);
        jest.advanceTimersByTime(201);
        [res1, res2] = await Promise.all([p1, p2]);
      });

      expect(res1).toContain('B');
      expect(res2).toHaveLength(0);
    });

    it('should expose isPingInProgress state', async () => {
      const { result } = renderHook(() =>
        useBroadcastChannel('test-channel', { sourceName: 'source-1' })
      );

      await waitForChannel();

      expect(result.current.isPingInProgress).toBe(false);

      let sources: string[] = [];
      await act(async () => {
        const pingPromise = result.current.ping(300);
        await Promise.resolve();
        expect(result.current.isPingInProgress).toBe(true);
        jest.advanceTimersByTime(301);
        sources = await pingPromise;
      });

      expect(Array.isArray(sources)).toBe(true);
      expect(result.current.isPingInProgress).toBe(false);
    });
  });

  describe('Batching', () => {
    it('batches multiple messages sent within the delay', async () => {
      jest.useFakeTimers();
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel('batch-channel', { batchingDelayMs: 50, sourceName: 'A' })
      );
      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel('batch-channel', { sourceName: 'B' })
      );
      await waitForChannel();
      act(() => {
        hook1.current.postMessage('type1', { a: 1 });
        hook1.current.postMessage('type2', { b: 2 });
      });
      // Fast-forward batching delay
      act(() => {
        jest.advanceTimersByTime(51);
      });
      // Both messages should be received as a batch (array)
      await waitFor(() => {
        expect(hook2.current.messages.length).toBe(2);
        expect(hook2.current.messages[0].type).toBe('type1');
        expect(hook2.current.messages[1].type).toBe('type2');
      });
      jest.useRealTimers();
    });

    it('excluded types are sent immediately', async () => {
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel('batch-channel', {
          batchingDelayMs: 50,
          excludedBatchMessageTypes: ['urgent'],
          sourceName: 'A',
        })
      );
      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel('batch-channel', { sourceName: 'B' })
      );
      await waitForChannel();
      act(() => {
        hook1.current.postMessage('urgent', { now: true });
      });
      // Should be received immediately, not batched
      await waitFor(() => {
        expect(hook2.current.messages.length).toBe(1);
        expect(hook2.current.messages[0].type).toBe('urgent');
      });
    });

    it('flushes unsent batched messages on unmount', async () => {
      const { result, unmount } = renderHook(() =>
        useBroadcastChannel('batch-channel', { batchingDelayMs: 0, sourceName: 'A' })
      );
      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel('batch-channel', { sourceName: 'B' })
      );
      await waitForChannel();
      act(() => {
        result.current.postMessage('type1', { a: 1 });
      });
      // Unmount (should not affect immediate send)
      unmount();
      await waitFor(() => {
        expect(hook2.current.messages.length).toBe(1);
        expect(hook2.current.messages[0].type).toBe('type1');
      });
    });

    it('handles both single and batch messages in the event handler', async () => {
      const { result } = renderHook(() =>
        useBroadcastChannel('batch-channel', { sourceName: 'A' })
      );
      await waitForChannel();
      const channel = mockChannels[0];
      // Simulate receiving a single message
      act(() => {
        channel.simulateMessage({
          id: '1',
          type: 'single',
          message: 'one',
          source: 'B',
          timestamp: Date.now(),
        });
      });
      // Simulate receiving a batch (array)
      act(() => {
        channel.simulateMessage([
          {
            id: '2',
            type: 'batch1',
            message: 'two',
            source: 'B',
            timestamp: Date.now(),
          },
          {
            id: '3',
            type: 'batch2',
            message: 'three',
            source: 'B',
            timestamp: Date.now(),
          },
        ]);
      });
      expect(result.current.messages.length).toBe(3);
      expect(result.current.messages[0].type).toBe('single');
      expect(result.current.messages[1].type).toBe('batch1');
      expect(result.current.messages[2].type).toBe('batch2');
    });
  });
});
