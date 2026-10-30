export { useBroadcastChannel } from './hooks/useBroadcastChannel';
export { BroadcastProvider, useBroadcastProvider } from './BroadcastProvider';

export type {
  BroadcastMessageMap,
  TypedBroadcastMessage,
  TypedPostMessage,
  TypedOnMessageMap,
  TypedMessageCallback,
  TypedGetLatestMessage,
  BroadcastOptions,
  SendMessageOptions,
  BroadcastMessage,
  BroadcastActions,
  ClearOptions,
  ClearReceivedMessagesOptions,
  ClearSentMessagesOptions,
  GetLatestMessageOptions,
  MessageCallback,
  OnMessageMap,
} from './types/types';
export type { BroadcastProviderProps } from './BroadcastProvider';

export { useSyncedState } from './hooks/useSyncedState';
export type {
  SyncedStateOptions,
  SyncedStateStatus,
  SyncedStateSyncResult,
  SyncedStateSetter,
} from './hooks/useSyncedState';
