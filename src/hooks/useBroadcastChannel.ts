import { useState, useEffect, useRef, useCallback } from 'react';
import { BroadcastActions, BroadcastMessage, BroadcastOptions, SendMessageOptions } from '../types/types';
import { 
  generateSourceName, 
  isValidMessage, 
  isMessageExpired, 
  createMessage,
  getInternalMessageType,
  isInternalType,
} from '../utils/messageUtils';

const INTERNAL_MESSAGE_TYPES = {
    CLEAR_MESSAGE: 'CLEAR_MESSAGE',
    CLEAR_ALL_MESSAGES: 'CLEAR_ALL_MESSAGES',
  } as const;

export const useBroadcastChannel = (
  channelName: string,
  options: BroadcastOptions = {}
): BroadcastActions => {
  const {
    sourceName,
    cleaningInterval = 1000,
    keepLatestMessage = false,
    registeredTypes = [], 
    namespace = '',
    deduplicationTTL = 5 * 60 * 1000
  } = options;

  // State
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [sentMessages, setSentMessages] = useState<BroadcastMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const channel = useRef<BroadcastChannel | null>(null);
  const receivedMessageIds = useRef(new Map<string, number>());
  const source = useRef(sourceName || generateSourceName()).current;
  const internalTypes = useRef({
    CLEAR_MESSAGE: getInternalMessageType(INTERNAL_MESSAGE_TYPES.CLEAR_MESSAGE, channelName, namespace),
    CLEAR_ALL_MESSAGES: getInternalMessageType(INTERNAL_MESSAGE_TYPES.CLEAR_ALL_MESSAGES, channelName, namespace),
  }).current;

  // Error handling
  const setErrorMessage = useCallback((error: string) => {
    setError(error);
    setTimeout(() => setError(null), 3000);
  }, []);

  // Message actions
  const clearMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
    setSentMessages(prev => prev.filter(msg => msg.id !== id));
    channel.current?.postMessage({ 
      id, 
      type: internalTypes.CLEAR_MESSAGE, 
      source 
    });
  }, [source, internalTypes.CLEAR_MESSAGE]);

  const clearAllMessages = useCallback(() => {
    setMessages([]);
    setSentMessages([]);
    channel.current?.postMessage({ 
      id: internalTypes.CLEAR_ALL_MESSAGES, 
      type: internalTypes.CLEAR_ALL_MESSAGES, 
      source 
    });
  }, [source, internalTypes.CLEAR_ALL_MESSAGES]);

  const clearSentMessage = useCallback((id: string) => {
    setSentMessages(prev => prev.filter(msg => msg.id !== id));
    channel.current?.postMessage({ 
      id, 
      type: internalTypes.CLEAR_MESSAGE, 
      source 
    });
  }, [source, internalTypes.CLEAR_MESSAGE]);

  const postMessage = useCallback((
    messageType: string,
    messageContent: any,
    options: SendMessageOptions = {}
  ) => {
    const channelCurrent = channel.current;
    if (!channelCurrent) {
      setErrorMessage('Channel not available');
      return;
    }

    try {
      const message = createMessage(messageType, messageContent, source, options);
      channelCurrent.postMessage(message);
      setSentMessages(prev => [...prev, message]);
    } catch (e) {
      setErrorMessage('Failed to send message');
    }
  }, [source, setErrorMessage]);

  // Message handling
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: BroadcastMessage = event.data;

      if (!isValidMessage(message)) return;
      if (message.source === source) return;
      if (!isInternalType(message.type) && registeredTypes.length > 0 && !registeredTypes.includes(message.type)) return;
      if (isMessageExpired(message)) return;
      
      if (message.type === internalTypes.CLEAR_MESSAGE) {
        setMessages(prev => prev.filter(msg => 
          !(msg.id === message.id && msg.source === message.source)
        ));
        return;
      }

      const now = Date.now();
      const receivedAt = receivedMessageIds.current.get(message.id);
      if (receivedAt && now - receivedAt < deduplicationTTL) return;

      if (message.type === internalTypes.CLEAR_ALL_MESSAGES) {
        setMessages(prev => prev.filter(msg => msg.source !== message.source));
        return;
      }

      receivedMessageIds.current.set(message.id, now);
      setMessages(prev => keepLatestMessage ? [message] : [...prev, message]);
    } catch (e) {
      setErrorMessage('Error processing broadcast message');
    }
  }, [source, registeredTypes, keepLatestMessage, setErrorMessage, internalTypes]);

  // Channel setup
  useEffect(() => {
    const namespacedChannel = `${channelName}-${namespace}`;
    const bc = new BroadcastChannel(namespacedChannel);
    channel.current = bc;

    bc.addEventListener('message', handleMessage);
    return () => {
      bc.removeEventListener('message', handleMessage);
      bc.close();
    };
  }, [channelName, namespace, handleMessage]);

  // Message cleanup for sent messages
  useEffect(() => {
    if (cleaningInterval <= 0) return;

    const interval = setInterval(() => {
      setSentMessages(prev => {
        const expiredMessages = prev.filter(msg => isMessageExpired(msg));
        expiredMessages.forEach(msg => {
          clearSentMessage(msg.id);
        });
        return prev.filter(msg => !isMessageExpired(msg));
      });
    }, cleaningInterval);

    return () => clearInterval(interval);
  }, [cleaningInterval, clearMessage]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [id, timestamp] of receivedMessageIds.current.entries()) {
        if (now - timestamp >= deduplicationTTL) {
          receivedMessageIds.current.delete(id);
        }
      }
    }, 60 * 1000);
  
    return () => clearInterval(interval);
  }, [deduplicationTTL]);

  return {
    messages,
    sentMessages,
    postMessage,
    clearMessage,
    clearAllMessages,
    clearSentMessage,
    error,
  };
};

export default useBroadcastChannel; 