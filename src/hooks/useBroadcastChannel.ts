import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  BroadcastActions,
  BroadcastMessage,
  BroadcastOptions,
  ClearMessage,
  ClearReceivedMessagesOptions,
  ClearSentMessagesOptions,
  SendMessageOptions,
} from '../types/types';
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

const INTERNAL_MESSAGE_TYPES: Record<string, ClearMessage> = {
  CLEAR_SENT_MESSAGES: 'CLEAR_SENT_MESSAGES',
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
    cleanupDebounceMs = 0,
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
    CLEAR_SENT_MESSAGES: getInternalMessageType(
      INTERNAL_MESSAGE_TYPES.CLEAR_SENT_MESSAGES,
      channelName,
      namespace
    ),
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

  const postMessage = useCallback(
    (messageType: string, messageContent: any, options: SendMessageOptions = {}) => {
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
    },
    [source, setErrorMessage]
  );

  const clearReceivedMessages = useCallback((options: ClearReceivedMessagesOptions = {}) => {
    const hasFilters = Boolean(
      (options.ids && options.ids.length) ||
        (options.types && options.types.length) ||
        (options.sources && options.sources.length)
    );

    setMessages(prev =>
      hasFilters
        ? prev.filter(
            msg =>
              !(options.ids && options.ids.includes(msg.id)) &&
              !(options.types && options.types.includes(msg.type)) &&
              !(options.sources && options.sources.includes(msg.source))
          )
        : []
    );
  }, []);

  const clearSentMessages = useCallback((options: ClearSentMessagesOptions = {}) => {
    const { ids = [], types = [], sync = false } = options ?? {};
    setSentMessages(prev =>
      ids.length > 0 || types.length > 0
        ? prev.filter(msg => {
            // Only consider messages from the same sender
            if (msg.source !== source) return true;

            // Decide whether this message should be cleared:
            // - If the ids array is empty, treat as wildcard (match all ids)
            // - If the types array is empty, treat as wildcard (match all types)
            const idMatches = ids.length === 0 || ids.includes(msg.id);
            const typeMatches = types.length === 0 || types.includes(msg.type);

            // Remove when BOTH criteria match (wildcards included)
            return !(idMatches && typeMatches);
          })
        : []
    );
    if (sync) {
      channel.current?.postMessage(
        createMessage(
          internalTypes.CLEAR_SENT_MESSAGES,
          { ids: options.ids ?? [], types: options.types ?? [] },
          source
        )
      );
    }
  }, []);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: BroadcastMessage = event.data;
        debug.message.received(message);

        if (!isValidMessage(message)) return;
        if (message.source === source) return;
        if (
          !isInternalType(message.type) &&
          registeredTypes.length > 0 &&
          !registeredTypes.includes(message.type)
        )
          return;
        if (isMessageExpired(message)) {
          debug.message.expired(message.id);
          return;
        }

        if (isValidInternalClearMessage(message)) {
          if (message.type === internalTypes.CLEAR_SENT_MESSAGES) {
            const { ids = [], types = [] } = (message as any).message || {};

            setMessages(prev =>
              prev.filter(msg => {
                // Only consider messages from the same sender
                if (msg.source !== message.source) return true;

                // Decide whether this message should be cleared:
                // - If the ids array is empty, treat as wildcard (match all ids)
                // - If the types array is empty, treat as wildcard (match all types)
                const idMatches = ids.length === 0 || ids.includes(msg.id);
                const typeMatches = types.length === 0 || types.includes(msg.type);

                // Remove when BOTH criteria match (wildcards included)
                return !(idMatches && typeMatches);
              })
            );

            // After handling we don't want to process this internal control packet further
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
        setMessages(prev => (keepLatestMessage ? [message] : [...prev, message]));
      } catch (e) {
        const error = 'Error processing broadcast message';
        debug.error(error);
        setErrorMessage(error);
      }
    },
    [source, registeredTypes, keepLatestMessage, setErrorMessage, internalTypes, deduplicationTTL]
  );

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      const error =
        'BroadcastChannel is not supported in this browser. Please check browser compatibility.';
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
    clearReceivedMessages,
    clearSentMessages,
    error,
  };
};

export default useBroadcastChannel;
