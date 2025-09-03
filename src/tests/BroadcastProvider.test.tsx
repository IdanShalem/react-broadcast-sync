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
  const { messages, error } = useBroadcastProvider();
  return (
    <div>
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
