import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BroadcastActions, BroadcastMessage, BroadcastOptions, SendMessageOptions } from '../types/types';
import { 
  generateSourceName, 
  isValidMessage, 
  isMessageExpired, 
  createMessage,
  getInternalMessageType,
  isInternalType,
  isValidInternalClearMessage,
  debounce,
} from '../utils/messageUtils';
import { debug } from '../utils/debug';

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
    deduplicationTTL = 5 * 60 * 1000,
    cleanupDebounceMs = 0
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

  const resolvedChannelName = useMemo(() => {
    return `${channelName}-${namespace}`;
  }, [channelName, namespace]);

  const performCleanup = useCallback(() => {
    setMessages(prev => prev.filter(msg => !isMessageExpired(msg)));
  }, []);

  const debouncedCleanup = useRef<{
    (...args: Parameters<typeof performCleanup>): void;
    cancel: () => void;
  }>(
    cleanupDebounceMs > 0
      ? debounce(performCleanup, cleanupDebounceMs)
      : Object.assign(performCleanup, { cancel: () => {} })
  ).current;

  const setErrorMessage = useCallback((error: string) => {
    setError(error);
    setTimeout(() => setError(null), 3000);
  }, []);

  const clearMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
    setSentMessages(prev => prev.filter(msg => msg.id !== id));
    channel.current?.postMessage({ 
      id, 
      type: internalTypes.CLEAR_MESSAGE, 
      source 
    });
    debug.message.cleared(id);
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
      const error = 'Channel not available';
      debug.error(error);
      setErrorMessage(error);
      return;
    }

    try {
      const message = createMessage(messageType, messageContent, source, options);
      channelCurrent.postMessage(message);
      debug.message.sent(message);
      setSentMessages(prev => [...prev, message]);
    } catch (e) {
      const error = 'Failed to send message';
      debug.error(error);
      setErrorMessage(error);
    }
  }, [source, setErrorMessage]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: BroadcastMessage = event.data;
      debug.message.received(message);

      if (!isValidMessage(message)) return;
      if (message.source === source) return;
      if (!isInternalType(message.type) && registeredTypes.length > 0 && !registeredTypes.includes(message.type)) return;
      if (isMessageExpired(message)) {
        debug.message.expired(message.id);
        return;
      }

      if (isValidInternalClearMessage(message)) {
        if (message.type === internalTypes.CLEAR_MESSAGE) {
          setMessages(prev =>
            prev.filter(msg => !(msg.id === message.id && msg.source === message.source))
          );
          return;
        }
      
        if (message.type === internalTypes.CLEAR_ALL_MESSAGES) {
          setMessages(prev => prev.filter(msg => msg.source !== message.source));
          return;
        }
      }

      const now = Date.now();
      const receivedAt = receivedMessageIds.current.get(message.id);
      if (receivedAt && now - receivedAt < deduplicationTTL) {
        debug.message.duplicate(message.id);
        return;
      }

      receivedMessageIds.current.set(message.id, now);
      setMessages(prev => keepLatestMessage ? [message] : [...prev, message]);
    } catch (e) {
      const error = 'Error processing broadcast message';
      debug.error(error);
      setErrorMessage(error);
    }
  }, [source, registeredTypes, keepLatestMessage, setErrorMessage, internalTypes, deduplicationTTL]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      const error = 'BroadcastChannel is not supported in this browser. Please check browser compatibility.';
      debug.error(error);
      setErrorMessage(error);
      return;
    }

    const bc = new BroadcastChannel(resolvedChannelName);
    channel.current = bc;
    debug.channel.created(resolvedChannelName);

    bc.addEventListener('message', handleMessage);
    return () => {
      bc.removeEventListener('message', handleMessage);
      bc.close();
      debug.channel.closed(resolvedChannelName);
    };
  }, [resolvedChannelName, handleMessage, setErrorMessage]);

  useEffect(() => {
    if (cleaningInterval <= 0) return;

    const interval = setInterval(() => {
      debug.cleanup.started();
      const before = messages.length;
      debouncedCleanup();
      debug.cleanup.completed(before - messages.length);
    }, cleaningInterval);

    return () => {
      clearInterval(interval);
      // Cancel any pending debounced cleanup on unmount
      if (cleanupDebounceMs > 0) {
        debouncedCleanup.cancel?.();
      }
    };
  }, [cleaningInterval, debouncedCleanup, cleanupDebounceMs]);

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
    channelName: resolvedChannelName,
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