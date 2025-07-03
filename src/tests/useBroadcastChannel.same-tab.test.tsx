import { renderHook, act } from '@testing-library/react';
import { useBroadcastChannel } from '../hooks/useBroadcastChannel';

let mockChannels: any[] = [];

class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = jest.fn((data: any) => {
    // Simulate broadcasting to all channels with the same name
    const targetChannels = mockChannels.filter(
      channel => channel.name === this.name && channel !== this
    );

    targetChannels.forEach(channel => {
      if (channel.onmessage) {
        // Use setTimeout to simulate async behavior
        setTimeout(() => {
          // Support both single and batched (array) messages
          if (Array.isArray(data)) {
            data.forEach(msg => channel.onmessage!({ data: msg } as MessageEvent));
          } else {
            channel.onmessage!({ data } as MessageEvent);
          }
        }, 0);
      }
    });
  });
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
      setTimeout(() => {
        // Support both single and batched (array) messages
        if (Array.isArray(data)) {
          data.forEach(msg => this.onmessage!({ data: msg } as MessageEvent));
        } else {
          this.onmessage!({ data } as MessageEvent);
        }
      }, 0);
    }
  }
}

const waitForAsync = async () => {
  // Wait for all async operations to complete
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
  });
};

beforeAll(() => {
  global.BroadcastChannel = MockBroadcastChannel as any;
});

beforeEach(() => {
  mockChannels = [];
  jest.clearAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  delete (global as any).BroadcastChannel;
});

describe('useBroadcastChannel - Same Tab Multi-Hook Behavior', () => {
  const CHANNEL_NAME = 'test-channel';

  // Common options to disable cleanup intervals in tests
  const testOptions = {
    cleaningInterval: 0, // Disable auto cleanup to avoid act warnings
    deduplicationTTL: 60000, // Long TTL for tests
    batchingDelayMs: 0, // Disable batching for immediate delivery in tests
  };

  describe('1. Two Hooks with Different Source Names', () => {
    it('should allow hooks with different sources to receive messages from each other', async () => {
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'source-1',
        })
      );

      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'source-2',
        })
      );

      await waitForAsync();

      // Hook 1 sends a message
      act(() => {
        hook1.current.postMessage('greeting', { from: 'hook1' });
      });

      await waitForAsync();

      // Hook 2 should receive the message
      expect(hook2.current.messages).toHaveLength(1);
      expect(hook2.current.messages[0].message).toEqual({ from: 'hook1' });
      expect(hook2.current.messages[0].source).toBe('source-1');

      // Hook 2 sends a message
      act(() => {
        hook2.current.postMessage('response', { from: 'hook2' });
      });

      await waitForAsync();

      // Hook 1 should receive the message
      expect(hook1.current.messages).toHaveLength(1);
      expect(hook1.current.messages[0].message).toEqual({ from: 'hook2' });
      expect(hook1.current.messages[0].source).toBe('source-2');
    });

    it('should not deduplicate messages from different sources', async () => {
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'source-1',
        })
      );

      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'source-2',
        })
      );

      await waitForAsync();

      // Both hooks send identical message content
      act(() => {
        hook1.current.postMessage('test', { data: 'same' });
        hook2.current.postMessage('test', { data: 'same' });
      });

      await waitForAsync();

      // Both hooks should receive messages from the other source
      expect(hook1.current.messages).toHaveLength(1);
      expect(hook2.current.messages).toHaveLength(1);
      expect(hook1.current.messages[0].source).toBe('source-2');
      expect(hook2.current.messages[0].source).toBe('source-1');
    });
  });

  describe('2. Two Hooks with Same Source Name', () => {
    it('should filter self-originated messages correctly with same source', async () => {
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'same-source',
        })
      );

      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'same-source',
        })
      );

      await waitForAsync();

      // Hook 1 sends a message
      act(() => {
        hook1.current.postMessage('test', { from: 'hook1' });
      });

      await waitForAsync();

      // Neither hook should receive the message (filtered as self-originated)
      expect(hook1.current.messages).toHaveLength(0);
      expect(hook2.current.messages).toHaveLength(0);

      // Hook 1 should have the message in sentMessages
      expect(hook1.current.sentMessages).toHaveLength(1);
      expect(hook2.current.sentMessages).toHaveLength(0);
    });

    it('should handle cleanup properly on unmount with same source', async () => {
      const { result: hook1, unmount: unmount1 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'same-source',
        })
      );

      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'same-source',
        })
      );

      await waitForAsync();

      // Verify both hooks are working (channel name includes namespace suffix)
      expect(hook1.current.channelName).toBe(`${CHANNEL_NAME}`);
      expect(hook2.current.channelName).toBe(`${CHANNEL_NAME}`);

      // Unmount hook1
      unmount1();

      // Hook2 should still work normally
      act(() => {
        hook2.current.postMessage('after-unmount', { test: true });
      });

      expect(hook2.current.sentMessages).toHaveLength(1);
      expect(hook2.current.error).toBeNull();
    });
  });

  describe('3. Deduplication in Same Tab', () => {
    it('should deduplicate identical messages from same source', async () => {
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'test-source',
        })
      );

      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'test-source',
        })
      );

      await waitForAsync();

      // Simulate external message with same ID arriving multiple times
      const duplicateMessage = {
        id: 'duplicate-id',
        type: 'test',
        message: { data: 'test' },
        source: 'external-source',
        timestamp: Date.now(),
      };

      act(() => {
        // Simulate the same message to both channels
        mockChannels.forEach(channel => {
          channel.simulateMessage(duplicateMessage);
          channel.simulateMessage(duplicateMessage); // Send duplicate
        });
      });

      await waitForAsync();

      // Should only receive the message once due to deduplication
      expect(hook1.current.messages).toHaveLength(1);
      expect(hook2.current.messages).toHaveLength(1);
    });
  });

  describe('4. Cleanup on Unmount', () => {
    it('should not interfere with other hooks when one unmounts', async () => {
      const { result: hook1, unmount: unmount1 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'source-1',
        })
      );

      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'source-2',
        })
      );

      await waitForAsync();

      // Verify both hooks work initially
      act(() => {
        hook1.current.postMessage('test', { from: 'hook1' });
      });

      await waitForAsync();
      expect(hook2.current.messages).toHaveLength(1);

      // Unmount hook1
      unmount1();

      // Hook2 should continue working normally
      act(() => {
        hook2.current.postMessage('after-unmount', { from: 'hook2' });
      });

      expect(hook2.current.sentMessages).toHaveLength(1);
    });
  });

  describe('5. Different keepLatestMessage Values', () => {
    it('should handle different keepLatestMessage settings correctly', async () => {
      const { result: hookWithHistory } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'source-history',
          keepLatestMessage: false,
        })
      );

      const { result: hookLatestOnly } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'source-latest',
          keepLatestMessage: true,
        })
      );

      await waitForAsync();

      // Send multiple messages from external source
      const externalMessages = [
        {
          id: 'msg-1',
          type: 'test',
          message: { count: 1 },
          source: 'external',
          timestamp: Date.now(),
        },
        {
          id: 'msg-2',
          type: 'test',
          message: { count: 2 },
          source: 'external',
          timestamp: Date.now() + 1,
        },
        {
          id: 'msg-3',
          type: 'test',
          message: { count: 3 },
          source: 'external',
          timestamp: Date.now() + 2,
        },
      ];

      for (const msg of externalMessages) {
        act(() => {
          mockChannels.forEach(channel => {
            channel.simulateMessage(msg);
          });
        });
        await waitForAsync();
      }

      // Hook with history should have all messages
      expect(hookWithHistory.current.messages).toHaveLength(3);

      // Hook with keepLatestMessage should only have the last message
      expect(hookLatestOnly.current.messages).toHaveLength(1);
      expect(hookLatestOnly.current.messages[0].message.count).toBe(3);
    });
  });

  describe('6. Different registeredTypes with Same Source', () => {
    it('should filter messages based on registeredTypes independently', async () => {
      const { result: hookTypeA } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'test-source',
          registeredTypes: ['typeA'],
        })
      );

      const { result: hookTypeB } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'test-source',
          registeredTypes: ['typeB'],
        })
      );

      await waitForAsync();

      // Send messages of different types
      const messages = [
        {
          id: 'msg-a',
          type: 'typeA',
          message: { data: 'for-a' },
          source: 'external',
          timestamp: Date.now(),
        },
        {
          id: 'msg-b',
          type: 'typeB',
          message: { data: 'for-b' },
          source: 'external',
          timestamp: Date.now(),
        },
        {
          id: 'msg-c',
          type: 'typeC',
          message: { data: 'for-neither' },
          source: 'external',
          timestamp: Date.now(),
        },
      ];

      for (const msg of messages) {
        act(() => {
          mockChannels.forEach(channel => {
            channel.simulateMessage(msg);
          });
        });
        await waitForAsync();
      }

      // Each hook should only receive messages of its registered type
      expect(hookTypeA.current.messages).toHaveLength(1);
      expect(hookTypeA.current.messages[0].type).toBe('typeA');

      expect(hookTypeB.current.messages).toHaveLength(1);
      expect(hookTypeB.current.messages[0].type).toBe('typeB');
    });
  });

  describe('7. Same Source, Same Type, Multiple Listeners', () => {
    it('should handle multiple hooks with same source and overlapping types', async () => {
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'same-source',
          registeredTypes: ['shared-type'],
        })
      );

      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'same-source',
          registeredTypes: ['shared-type'],
        })
      );

      await waitForAsync();

      // Send a message from external source
      const message = {
        id: 'shared-msg',
        type: 'shared-type',
        message: { data: 'shared' },
        source: 'external',
        timestamp: Date.now(),
      };

      act(() => {
        mockChannels.forEach(channel => {
          channel.simulateMessage(message);
        });
      });

      await waitForAsync();

      // Both hooks should receive the message
      expect(hook1.current.messages).toHaveLength(1);
      expect(hook2.current.messages).toHaveLength(1);
      expect(hook1.current.messages[0].message).toEqual({ data: 'shared' });
      expect(hook2.current.messages[0].message).toEqual({ data: 'shared' });
    });
  });

  describe('8. Same Source, One with registeredTypes, One Without', () => {
    it('should handle mixed type registration correctly', async () => {
      const { result: hookSpecific } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'test-source',
          registeredTypes: ['specific-type'],
        })
      );

      const { result: hookAll } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'test-source',
          registeredTypes: [], // Empty array means listen to all
        })
      );

      await waitForAsync();

      // Send messages of different types
      const messages = [
        {
          id: 'msg-specific',
          type: 'specific-type',
          message: { data: 'specific' },
          source: 'external',
          timestamp: Date.now(),
        },
        {
          id: 'msg-other',
          type: 'other-type',
          message: { data: 'other' },
          source: 'external',
          timestamp: Date.now(),
        },
      ];

      for (const msg of messages) {
        act(() => {
          mockChannels.forEach(channel => {
            channel.simulateMessage(msg);
          });
        });
        await waitForAsync();
      }

      // Specific hook should only receive specific-type
      expect(hookSpecific.current.messages).toHaveLength(1);
      expect(hookSpecific.current.messages[0].type).toBe('specific-type');

      // Hook listening to all should receive both
      expect(hookAll.current.messages).toHaveLength(2);
    });
  });

  describe('9. Rapid Message Burst Between Hooks', () => {
    it('should handle rapid message bursts correctly', async () => {
      const { result: sender } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'sender',
        })
      );

      const { result: receiver } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'receiver',
        })
      );

      await waitForAsync();

      // Send rapid burst of messages
      act(() => {
        for (let i = 0; i < 10; i++) {
          sender.current.postMessage('burst', { count: i });
        }
      });

      await waitForAsync();

      // Receiver should get all messages
      expect(receiver.current.messages).toHaveLength(10);
      expect(sender.current.sentMessages).toHaveLength(10);
    });

    it('should respect deduplication during rapid bursts', async () => {
      const { result: hook } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'test-source',
        })
      );

      await waitForAsync();

      // Simulate rapid duplicate messages
      const duplicateMessage = {
        id: 'rapid-duplicate',
        type: 'test',
        message: { data: 'duplicate' },
        source: 'external',
        timestamp: Date.now(),
      };

      act(() => {
        for (let i = 0; i < 5; i++) {
          mockChannels.forEach(channel => {
            channel.simulateMessage(duplicateMessage);
          });
        }
      });

      await waitForAsync();

      // Should only receive one message due to deduplication
      expect(hook.current.messages).toHaveLength(1);
    });
  });

  describe('10. Source Reinitialization with Same Name', () => {
    it('should handle remounting with same source name cleanly', async () => {
      const { result: hook1, unmount } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'reusable-source',
          keepLatestMessage: false,
        })
      );

      await waitForAsync();

      // Send initial message
      act(() => {
        hook1.current.postMessage('initial', { phase: 1 });
      });

      expect(hook1.current.sentMessages).toHaveLength(1);

      // Unmount and remount with different config
      unmount();

      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'reusable-source',
          keepLatestMessage: true,
        })
      );

      await waitForAsync();

      // New instance should start fresh
      expect(hook2.current.sentMessages).toHaveLength(0);
      expect(hook2.current.messages).toHaveLength(0);

      // Should work normally
      act(() => {
        hook2.current.postMessage('after-remount', { phase: 2 });
      });

      expect(hook2.current.sentMessages).toHaveLength(1);
    });
  });

  describe('11. Hook Sends Message to Itself', () => {
    it('should correctly handle self-originated messages', async () => {
      const { result: hook } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'self-sender',
          registeredTypes: ['self-type'],
        })
      );

      await waitForAsync();

      // Hook sends a message that matches its own registered types
      act(() => {
        hook.current.postMessage('self-type', { self: true });
      });

      await waitForAsync();

      // Should not receive its own message
      expect(hook.current.messages).toHaveLength(0);
      // But should have it in sent messages
      expect(hook.current.sentMessages).toHaveLength(1);
      expect(hook.current.sentMessages[0].type).toBe('self-type');
    });
  });

  describe('Additional Edge Cases', () => {
    it('should handle clearMessagesByType coordination in same tab', async () => {
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'source-1',
        })
      );

      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'source-2',
        })
      );

      await waitForAsync();

      // Send messages of different types from different sources
      act(() => {
        hook1.current.postMessage('typeA', { from: 'hook1' });
        hook1.current.postMessage('typeB', { from: 'hook1' });
      });

      await waitForAsync();

      // Both messages should be received by hook2
      expect(hook2.current.messages).toHaveLength(2);

      // Clear specific type from hook2
      act(() => {
        hook2.current.clearReceivedMessages({ types: ['typeA'] });
      });

      // Hook2 should only have typeB message left
      expect(hook2.current.messages).toHaveLength(1);
      expect(hook2.current.messages[0].type).toBe('typeB');

      // Hook1's messages should be unaffected
      expect(hook1.current.sentMessages).toHaveLength(2);
    });

    it('should handle namespace isolation correctly', async () => {
      const { result: hook1 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'source-1',
          namespace: 'ns1',
        })
      );

      const { result: hook2 } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'source-2',
          namespace: 'ns2',
        })
      );

      await waitForAsync();

      // Hooks should be on different resolved channels
      expect(hook1.current.channelName).toBe(`${CHANNEL_NAME}-ns1`);
      expect(hook2.current.channelName).toBe(`${CHANNEL_NAME}-ns2`);

      // Messages should not cross namespaces
      act(() => {
        hook1.current.postMessage('test', { from: 'hook1' });
      });

      await waitForAsync();

      // Hook2 should not receive the message (different namespace)
      expect(hook2.current.messages).toHaveLength(0);
      expect(hook1.current.sentMessages).toHaveLength(1);
    });

    it('should handle different keepLatestMessage settings with same source name', async () => {
      const { result: hookWithHistory } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'same-source',
          keepLatestMessage: false,
        })
      );

      const { result: hookLatestOnly } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'same-source',
          keepLatestMessage: true,
        })
      );

      await waitForAsync();

      // Send multiple messages from external source
      const externalMessages = [
        {
          id: 'msg-1',
          type: 'test',
          message: { count: 1 },
          source: 'external',
          timestamp: Date.now(),
        },
        {
          id: 'msg-2',
          type: 'test',
          message: { count: 2 },
          source: 'external',
          timestamp: Date.now() + 1,
        },
        {
          id: 'msg-3',
          type: 'test',
          message: { count: 3 },
          source: 'external',
          timestamp: Date.now() + 2,
        },
      ];

      for (const msg of externalMessages) {
        act(() => {
          mockChannels.forEach(channel => {
            channel.simulateMessage(msg);
          });
        });
        await waitForAsync();
      }

      // Hook with history should have all messages
      expect(hookWithHistory.current.messages).toHaveLength(3);

      // Hook with keepLatestMessage should only have the last message
      expect(hookLatestOnly.current.messages).toHaveLength(1);
      expect(hookLatestOnly.current.messages[0].message.count).toBe(3);
    });

    it('should explicitly block self-originated messages even with matching registered types', async () => {
      const { result: hook } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'self-sender',
          registeredTypes: ['self-type', 'another-type'],
        })
      );

      await waitForAsync();

      // Hook sends messages that match its own registered types
      act(() => {
        hook.current.postMessage('self-type', { self: true });
        hook.current.postMessage('another-type', { self: true });
      });

      await waitForAsync();

      // Should not receive its own messages despite matching registered types
      expect(hook.current.messages).toHaveLength(0);

      // But should have them in sent messages
      expect(hook.current.sentMessages).toHaveLength(2);
      expect(hook.current.sentMessages[0].source).toBe('self-sender');
      expect(hook.current.sentMessages[1].source).toBe('self-sender');

      // Verify that source === sourceName is the blocking condition
      expect(hook.current.sentMessages.every(msg => msg.source === 'self-sender')).toBe(true);
    });

    it('should handle combined config differences with same source name', async () => {
      const { result: hookSpecificLatest } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'shared-source',
          registeredTypes: ['typeA'],
          keepLatestMessage: true,
        })
      );

      const { result: hookAllHistory } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          sourceName: 'shared-source',
          registeredTypes: [], // Listen to all types
          keepLatestMessage: false,
        })
      );

      await waitForAsync();

      // Send multiple messages of different types
      const messages = [
        {
          id: 'msg-a1',
          type: 'typeA',
          message: { data: 'a1' },
          source: 'external',
          timestamp: Date.now(),
        },
        {
          id: 'msg-b1',
          type: 'typeB',
          message: { data: 'b1' },
          source: 'external',
          timestamp: Date.now() + 1,
        },
        {
          id: 'msg-a2',
          type: 'typeA',
          message: { data: 'a2' },
          source: 'external',
          timestamp: Date.now() + 2,
        },
      ];

      for (const msg of messages) {
        act(() => {
          mockChannels.forEach(channel => {
            channel.simulateMessage(msg);
          });
        });
        await waitForAsync();
      }

      // Hook with specific type + keepLatest should only have latest typeA
      expect(hookSpecificLatest.current.messages).toHaveLength(1);
      expect(hookSpecificLatest.current.messages[0].type).toBe('typeA');
      expect(hookSpecificLatest.current.messages[0].message.data).toBe('a2');

      // Hook listening to all + history should have all messages
      expect(hookAllHistory.current.messages).toHaveLength(3);
      expect(hookAllHistory.current.messages.map(m => m.type)).toEqual(['typeA', 'typeB', 'typeA']);
    });

    it('should respect deduplication TTL for duplicate message IDs', async () => {
      const { result: hook } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
          deduplicationTTL: 1000, // 1 second TTL
        })
      );

      await waitForAsync();

      // Send the same message multiple times within TTL window
      const duplicateMessage = {
        id: 'duplicate-id',
        type: 'test',
        message: { data: 'duplicate' },
        source: 'external',
        timestamp: Date.now(),
      };

      act(() => {
        mockChannels.forEach(channel => {
          channel.simulateMessage(duplicateMessage);
          channel.simulateMessage(duplicateMessage); // Immediate duplicate
        });
      });

      await waitForAsync();

      // Should only receive one message due to deduplication
      expect(hook.current.messages).toHaveLength(1);
      expect(hook.current.messages[0].message.data).toBe('duplicate');
    });

    it('should drop messages that just cross expiration boundary', async () => {
      const { result: hook } = renderHook(() =>
        useBroadcastChannel(CHANNEL_NAME, {
          ...testOptions,
        })
      );

      await waitForAsync();

      const now = Date.now();

      // Message that just expired
      const expiredMessage = {
        id: 'just-expired',
        type: 'test',
        message: { data: 'expired' },
        source: 'external',
        timestamp: now - 1000,
        expirationDate: now - 10, // Expired 10ms ago (more buffer to avoid timing issues)
      };

      // Message that's still valid
      const validMessage = {
        id: 'still-valid',
        type: 'test',
        message: { data: 'valid' },
        source: 'external',
        timestamp: now - 1000,
        expirationDate: now + 5000, // Expires in 5 seconds (more buffer)
      };

      act(() => {
        mockChannels.forEach(channel => {
          channel.simulateMessage(expiredMessage);
          channel.simulateMessage(validMessage);
        });
      });

      await waitForAsync();

      // Should only receive the valid message
      expect(hook.current.messages).toHaveLength(1);
      expect(hook.current.messages[0].message.data).toBe('valid');
    });
  });
});
