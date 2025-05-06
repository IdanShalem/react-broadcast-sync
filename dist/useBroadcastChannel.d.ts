import { BroadcastMessage, BroadcastOptions, SendMessageOptions } from './types/types';
export declare const useBroadcastChannel: (
  channelName: string,
  options?: BroadcastOptions
) => {
  messages: BroadcastMessage[];
  sentMessages: BroadcastMessage[];
  postMessage: (messageType: string, messageContent: any, options?: SendMessageOptions) => void;
  clearMessage: (id: string) => void;
  clearAllMessages: () => void;
  clearSentMessage: (id: string) => void;
  error: string;
};
export default useBroadcastChannel;
