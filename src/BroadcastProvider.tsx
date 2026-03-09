import React, { createContext, useContext } from 'react';
import { useBroadcastChannel } from './hooks/useBroadcastChannel';
import { BroadcastActions, BroadcastOptions } from './types/types';

const BroadcastChannelContext = createContext<BroadcastActions | undefined>(undefined);

interface BroadcastProviderProps {
  channelName: string;
  options?: BroadcastOptions;
  children: React.ReactNode;
}

export const BroadcastProvider: React.FC<BroadcastProviderProps> = ({
  children,
  channelName,
  options,
}) => {
  const BroadcastChannelActions = useBroadcastChannel(channelName, options);

  return (
    <BroadcastChannelContext.Provider value={BroadcastChannelActions}>
      {children}
    </BroadcastChannelContext.Provider>
  );
};

export const useBroadcastProvider = (): BroadcastActions => {
  const context = useContext(BroadcastChannelContext);
  if (!context) {
    throw new Error('useBroadcastProvider must be used within a BroadcastProvider');
  }
  return context;
};
