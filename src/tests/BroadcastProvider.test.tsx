import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BroadcastProvider, useBroadcastProvider } from '../BroadcastProvider';

// Mock BroadcastChannel
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

// Test component that uses the provider
const TestComponent = () => {
  const { messages, error, channelName } = useBroadcastProvider();
  return (
    <div>
      <div data-testid="channel-name">{channelName}</div>
      <div data-testid="error">{error}</div>
      <div data-testid="messages">
        {messages.map(msg => (
          <div key={msg.id} data-testid={`message-${msg.id}`}>
            {msg.message.text}
          </div>
        ))}
      </div>
    </div>
  );
};

describe('BroadcastProvider', () => {
  beforeEach(() => {
    mockChannels = [];
    global.BroadcastChannel = MockBroadcastChannel as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a broadcast channel with the provided name', () => {
    render(
      <BroadcastProvider channelName="test-channel">
        <TestComponent />
      </BroadcastProvider>
    );

    // The provider delegates to useBroadcastChannel which creates one channel
    expect(mockChannels).toHaveLength(1);
    expect(mockChannels[0].name).toBe('test-channel');
  });

  it('provides context values to children', () => {
    render(
      <BroadcastProvider channelName="test-channel">
        <TestComponent />
      </BroadcastProvider>
    );

    expect(screen.getByTestId('error')).toHaveTextContent('');
    expect(screen.getByTestId('messages')).toBeEmptyDOMElement();
  });

  it('handles messages through the provider', () => {
    render(
      <BroadcastProvider channelName="test-channel">
        <TestComponent />
      </BroadcastProvider>
    );

    const message = {
      id: 'test-1',
      type: 'test',
      message: { text: 'Hello' },
      source: 'other-tab',
      timestamp: Date.now(),
    };

    act(() => {
      mockChannels[0].simulateMessage(message);
    });

    expect(screen.getByTestId('message-test-1')).toHaveTextContent('Hello');
  });

  it('handles errors when BroadcastChannel is not supported', () => {
    const originalBroadcastChannel = global.BroadcastChannel;
    delete (global as any).BroadcastChannel;

    render(
      <BroadcastProvider channelName="test-channel">
        <TestComponent />
      </BroadcastProvider>
    );

    expect(screen.getByTestId('error')).toHaveTextContent(
      'BroadcastChannel is not supported in this browser. Please check browser compatibility.'
    );

    // Restore BroadcastChannel for other tests
    global.BroadcastChannel = originalBroadcastChannel;
  });

  it('cleans up channel on unmount', () => {
    const { unmount } = render(
      <BroadcastProvider channelName="test-channel">
        <TestComponent />
      </BroadcastProvider>
    );

    unmount();

    expect(mockChannels[0].close).toHaveBeenCalled();
  });

  it('propagates child component errors (no internal error boundary)', () => {
    const ThrowComponent = () => {
      throw new Error('Test error');
    };

    expect(() => {
      render(
        <BroadcastProvider channelName="test-channel">
          <ThrowComponent />
        </BroadcastProvider>
      );
    }).toThrow('Test error');
  });

  it('throws error when useBroadcastProvider is used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useBroadcastProvider must be used within a BroadcastProvider');

    consoleError.mockRestore();
  });
});

describe('BroadcastProvider options', () => {
  beforeEach(() => {
    mockChannels = [];
    global.BroadcastChannel = MockBroadcastChannel as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('works without options prop (backward compatible)', () => {
    render(
      <BroadcastProvider channelName="test-channel">
        <TestComponent />
      </BroadcastProvider>
    );

    expect(mockChannels).toHaveLength(1);
    expect(mockChannels[0].name).toBe('test-channel');
    expect(screen.getByTestId('error')).toHaveTextContent('');
  });

  it('forwards namespace option — resolved channel name includes namespace', () => {
    render(
      <BroadcastProvider channelName="test-channel" options={{ namespace: 'my-ns' }}>
        <TestComponent />
      </BroadcastProvider>
    );

    expect(mockChannels[0].name).toBe('test-channel-my-ns');
    expect(screen.getByTestId('channel-name')).toHaveTextContent('test-channel-my-ns');
  });

  it('forwards registeredTypes option — messages of unlisted types are ignored', () => {
    render(
      <BroadcastProvider channelName="test-channel" options={{ registeredTypes: ['allowed'] }}>
        <TestComponent />
      </BroadcastProvider>
    );

    const blocked = {
      id: 'blocked-1',
      type: 'blocked',
      message: { text: 'Should not appear' },
      source: 'other-tab',
      timestamp: Date.now(),
    };

    act(() => {
      mockChannels[0].simulateMessage(blocked);
    });

    expect(screen.queryByTestId('message-blocked-1')).not.toBeInTheDocument();
  });

  it('forwards registeredTypes option — messages of listed types are accepted', () => {
    render(
      <BroadcastProvider channelName="test-channel" options={{ registeredTypes: ['allowed'] }}>
        <TestComponent />
      </BroadcastProvider>
    );

    const accepted = {
      id: 'allowed-1',
      type: 'allowed',
      message: { text: 'Should appear' },
      source: 'other-tab',
      timestamp: Date.now(),
    };

    act(() => {
      mockChannels[0].simulateMessage(accepted);
    });

    expect(screen.getByTestId('message-allowed-1')).toHaveTextContent('Should appear');
  });

  it('forwards onMessage catch-all callback — fires for every accepted message', () => {
    const onMessage = jest.fn();

    render(
      <BroadcastProvider channelName="test-channel" options={{ onMessage }}>
        <TestComponent />
      </BroadcastProvider>
    );

    const msg = {
      id: 'cb-1',
      type: 'any',
      message: { text: 'hello' },
      source: 'other-tab',
      timestamp: Date.now(),
    };

    act(() => {
      mockChannels[0].simulateMessage(msg);
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'cb-1', type: 'any' }));
  });

  it('forwards onMessage per-type map — only the matching callback fires', () => {
    const onFoo = jest.fn();
    const onBar = jest.fn();

    render(
      <BroadcastProvider
        channelName="test-channel"
        options={{ onMessage: { foo: onFoo, bar: onBar } }}
      >
        <TestComponent />
      </BroadcastProvider>
    );

    act(() => {
      mockChannels[0].simulateMessage({
        id: 'foo-1',
        type: 'foo',
        message: { text: 'foo' },
        source: 'other-tab',
        timestamp: Date.now(),
      });
    });

    act(() => {
      mockChannels[0].simulateMessage({
        id: 'bar-1',
        type: 'bar',
        message: { text: 'bar' },
        source: 'other-tab',
        timestamp: Date.now(),
      });
    });

    expect(onFoo).toHaveBeenCalledTimes(1);
    expect(onFoo).toHaveBeenCalledWith(expect.objectContaining({ id: 'foo-1' }));
    expect(onBar).toHaveBeenCalledTimes(1);
    expect(onBar).toHaveBeenCalledWith(expect.objectContaining({ id: 'bar-1' }));
  });

  it('forwards keepLatestMessage option — only the latest message is kept in state', () => {
    render(
      <BroadcastProvider channelName="test-channel" options={{ keepLatestMessage: true }}>
        <TestComponent />
      </BroadcastProvider>
    );

    act(() => {
      mockChannels[0].simulateMessage({
        id: 'first-1',
        type: 'update',
        message: { text: 'first' },
        source: 'other-tab',
        timestamp: Date.now(),
      });
    });

    act(() => {
      mockChannels[0].simulateMessage({
        id: 'second-1',
        type: 'update',
        message: { text: 'second' },
        source: 'other-tab',
        timestamp: Date.now() + 1,
      });
    });

    expect(screen.queryByTestId('message-first-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('message-second-1')).toHaveTextContent('second');
  });

  it('forwards multiple options simultaneously', () => {
    const onMessage = jest.fn();

    render(
      <BroadcastProvider
        channelName="test-channel"
        options={{ namespace: 'app', registeredTypes: ['event'], onMessage }}
      >
        <TestComponent />
      </BroadcastProvider>
    );

    expect(mockChannels[0].name).toBe('test-channel-app');

    act(() => {
      mockChannels[0].simulateMessage({
        id: 'blocked-2',
        type: 'other',
        message: { text: 'filtered' },
        source: 'other-tab',
        timestamp: Date.now(),
      });
    });

    expect(onMessage).not.toHaveBeenCalled();
    expect(screen.queryByTestId('message-blocked-2')).not.toBeInTheDocument();

    act(() => {
      mockChannels[0].simulateMessage({
        id: 'event-1',
        type: 'event',
        message: { text: 'ok' },
        source: 'other-tab',
        timestamp: Date.now(),
      });
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('message-event-1')).toHaveTextContent('ok');
  });
});
