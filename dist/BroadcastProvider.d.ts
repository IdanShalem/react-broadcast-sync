import React from 'react';
import { BroadcastMessage } from './types/types';
type BroadcastContextType = {
    messages: BroadcastMessage[];
    sendMessage: (messageType: string, messageContent: any) => void;
    error: string | null;
};
export declare function BroadcastProvider({ children }: {
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function useBroadcast(): BroadcastContextType;
export {};
