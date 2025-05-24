/**
 * Options for configuring the broadcast channel
 */
export interface BroadcastOptions {
  /** Custom source name for this instance */
  sourceName?: string;
  
  /** Interval in milliseconds for cleaning expired messages (default: 1000) */
  cleaningInterval?: number;
  
  /** If true, only the latest message is kept */
  keepLatestMessage?: boolean;
  
  /** Array of allowed message types */
  registeredTypes?: string[];
  
  /** Channel namespace for isolation */
  namespace?: string;

  /** TTL for deduplication in milliseconds (default: 5 minutes) */
  deduplicationTTL?: number;
}

/**
 * Options for sending messages
 */
export interface SendMessageOptions {
  /** Message expiration duration in milliseconds */
  expirationDuration?: number;
  
  /** Specific expiration timestamp */
  expirationDate?: number;
}

/**
 * Structure of a broadcast message
 */
export interface BroadcastMessage {
  /** Unique message identifier */
  id: string;
  
  /** Message type for categorization */
  type: string;
  
  /** Message content */
  message: any;
  
  /** Creation timestamp */
  timestamp: number;
  
  /** Source identifier */
  source: string;
  
  /** Optional expiration timestamp */
  expirationDate?: number;
}

/**
 * Actions and state provided by the broadcast channel hook
 */
export interface BroadcastActions {
  /** The resolved channel name including namespace */
  channelName: string;
  
  /** Array of received messages */
  messages: BroadcastMessage[];
  
  /** Array of sent messages */
  sentMessages: BroadcastMessage[];
  
  /** Function to send a message */
  postMessage: (
    messageType: string,
    messageContent: any,
    options?: SendMessageOptions
  ) => void;
  
  /** Function to clear a specific message */
  clearMessage: (id: string) => void;
  
  /** Function to clear all messages */
  clearAllMessages: () => void;
  
  /** Function to clear a specific sent message */
  clearSentMessage: (id: string) => void;
  
  /** Current error state */
  error: string | null;
}