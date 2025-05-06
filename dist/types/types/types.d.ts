export type BroadcastOptions = {
    sourceName?: string;
    cleaningInterval?: number;
    keepLatestMessage?: boolean;
    registeredTypes?: string[];
    namespace?: string;
};
export type BroadcastMessage = {
    id: string;
    type: string;
    message: any;
    timestamp: number;
    source: string;
    expirationDate?: number;
    expirationDuration?: number;
};
export type SendMessageOptions = {
    expirationDuration?: number;
    expirationDate?: number;
};
export type BroadcastActions = {
    messages: BroadcastMessage[];
    sentMessages: BroadcastMessage[];
    postMessage: (messageType: string, messageContent: any, options?: SendMessageOptions) => void;
    clearMessage: (id: string) => void;
    clearAllMessages: () => void;
    clearSentMessage: (id: string) => void;
    error: string | null;
};
