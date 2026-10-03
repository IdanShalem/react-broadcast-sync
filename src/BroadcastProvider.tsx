import React, { createContext, useContext } from 'react';
import { useBroadcastChannel } from './hooks/useBroadcastChannel';
import { BroadcastActions, BroadcastOptions } from './types/types';

const BroadcastChannelContext = createContext<BroadcastActions | undefined>(undefined);

export interface BroadcastProviderProps {
  /** Name of the BroadcastChannel. Combined with `options.namespace` when one is set. */
  channelName: string;
  /** Same options as `useBroadcastChannel`. */
  options?: BroadcastOptions;
  children: React.ReactNode;
}

/**
 * Opens one BroadcastChannel (by calling `useBroadcastChannel` once) and shares it with all
 * descendants through context. Read it with `useBroadcastProvider()`.
 *
 * Same rules as the hook: the tab ignores its own messages, `messages` is an event log (not
 * current state), and a tab opened later does not receive earlier messages.
 *
 * ```tsx
 * <BroadcastProvider channelName="app" options={{ namespace: 'v1' }}>
 *   <App />
 * </BroadcastProvider>
 * ```
 */
export const BroadcastProvider: React.FC<BroadcastProviderProps> = ({
  children,
  channelName,
  options,
}) => {
  const BroadcastChannelActions = useBroadcastChannel(channelName, options, 'provider');

  return (
    <BroadcastChannelContext.Provider value={BroadcastChannelActions}>
      {children}
    </BroadcastChannelContext.Provider>
  );
};

/**
 * Returns the channel actions shared by the nearest `BroadcastProvider`.
 *
 * @throws Error if called outside a `BroadcastProvider`.
 */
export const useBroadcastProvider = (): BroadcastActions => {
  const context = useContext(BroadcastChannelContext);
  if (!context) {
    throw new Error('useBroadcastProvider must be used within a BroadcastProvider');
  }
  return context;
};
