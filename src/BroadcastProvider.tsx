import React, { createContext, useContext } from 'react';
import { useBroadcastChannel } from './hooks/useBroadcastChannel';
import {
  BroadcastActions,
  BroadcastMessageMap,
  BroadcastOptions,
  LooseMessageMap,
  NoInferMessageMap,
} from './types/types';

const BroadcastChannelContext = createContext<BroadcastActions | undefined>(undefined);

export interface BroadcastProviderProps<TMap extends BroadcastMessageMap = LooseMessageMap> {
  /** Name of the BroadcastChannel. Combined with `options.namespace` when one is set. */
  channelName: string;
  /** Same options as `useBroadcastChannel`. */
  options?: BroadcastOptions<NoInferMessageMap<TMap>>;
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
export const BroadcastProvider = <TMap extends BroadcastMessageMap = LooseMessageMap>({
  children,
  channelName,
  options,
}: BroadcastProviderProps<TMap>): React.ReactElement => {
  const BroadcastChannelActions = useBroadcastChannel<TMap>(channelName, options, 'provider');
  const contextValue = BroadcastChannelActions as unknown as BroadcastActions;

  return (
    <BroadcastChannelContext.Provider value={contextValue}>
      {children}
    </BroadcastChannelContext.Provider>
  );
};

/**
 * Returns the channel actions shared by the nearest `BroadcastProvider`.
 *
 * @throws Error if called outside a `BroadcastProvider`.
 */
export const useBroadcastProvider = <
  TMap extends BroadcastMessageMap = LooseMessageMap,
>(): BroadcastActions<TMap> => {
  const context = useContext(BroadcastChannelContext);
  if (!context) {
    throw new Error('useBroadcastProvider must be used within a BroadcastProvider');
  }
  return context as BroadcastActions<TMap>;
};
