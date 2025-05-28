import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useBroadcastChannel } from './hooks/useBroadcastChannel';  
import { BroadcastMessage } from './types/types';

interface BroadcastContextValue {
  messages: BroadcastMessage[];
  error: string | null;
  channel: BroadcastChannel | null;
}

const BroadcastChannelContext = createContext<BroadcastContextValue | undefined>(undefined);

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('BroadcastChannel error:', error);
  }

  render() {
    if (this.state.hasError) {
      return <div>Error occurred in BroadcastProvider</div>;
    }
    return this.props.children;
  }
}

interface BroadcastProviderProps {
  channelName: string;
  children: React.ReactNode;
}

export const BroadcastProvider: React.FC<BroadcastProviderProps> = ({ children, channelName }) => {
  const { messages, error: hookError } = useBroadcastChannel(channelName); 

  const [error, setError] = React.useState<string | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      setError('BroadcastChannel is not supported in this browser. Please check browser compatibility.');
      return;
    }
    const bc = new BroadcastChannel(channelName);
    channel.current = bc;

    return () => {
      bc.close();
    };
  }, [channelName]);

  const value = useMemo(
    () => ({ messages, error: error || hookError, channel: channel.current }),
    [messages, error, hookError]
  );

  return (
    <ErrorBoundary>
      <BroadcastChannelContext.Provider value={value}>
        {children}
      </BroadcastChannelContext.Provider>
    </ErrorBoundary>
  );
};

export const useBroadcastProvider = (): BroadcastContextValue => {
  const context = useContext(BroadcastChannelContext);
  if (!context) {
    throw new Error('useBroadcastProvider must be used within a BroadcastProvider');
  }
  return context;
};
