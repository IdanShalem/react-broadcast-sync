import React, { createContext, useContext } from 'react';
import { useBroadcastChannel } from './hooks/useBroadcastChannel';
import { BroadcastActions } from './types/types';

const BroadcastChannelContext = createContext<BroadcastActions | undefined>(undefined);

interface BroadcastProviderProps {
  channelName: string;
  children: React.ReactNode;
}

export const BroadcastProvider: React.FC<BroadcastProviderProps> = ({ children, channelName }) => {
  const BroadcastChannelActions = useBroadcastChannel(channelName);

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
