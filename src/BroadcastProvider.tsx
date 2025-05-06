import React, { createContext, useContext } from 'react';
import useBroadcastChannel from './useBroadcastChannel';
import { BroadcastActions, BroadcastOptions } from './types/types';

const BroadcastContext = createContext<BroadcastActions | null>(null);

export const BroadcastProvider: React.FC<{
  channelName: string;
  options?: BroadcastOptions;
  children: React.ReactNode;
}> = ({ channelName, options, children }) => {
  const broadcast = useBroadcastChannel(channelName, options);
  return (
    <BroadcastContext.Provider value={broadcast}>
      {children}
    </BroadcastContext.Provider>
  );
};

export const useBroadcast = (): BroadcastActions => {
  const context = useContext(BroadcastContext);
  if (!context) throw new Error('useBroadcast must be used within a BroadcastProvider');
  return context;
};
