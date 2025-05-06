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
