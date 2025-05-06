import React, { createContext, useContext } from 'react';
import { useBroadcastChannel } from './useBroadcastChannel';
import { BroadcastMessage } from './types/types';

type BroadcastContextType = {
  messages: BroadcastMessage[];
  postMessage: (messageType: string, messageContent: any) => void;
  error: string | null;
};

const BroadcastContext = createContext<BroadcastContextType | null>(null);

export function BroadcastProvider({ children }: { children: React.ReactNode }) {
  const { messages, postMessage, error } = useBroadcastChannel('global');

  return (
    <BroadcastContext.Provider value={{ messages, postMessage, error }}>
      {children}    
    </BroadcastContext.Provider>
  );
}

export function useBroadcast() {
  const context = useContext(BroadcastContext);
  if (!context) {
    throw new Error("useBroadcast must be used within a BroadcastProvider");
  }
  return context;
}
