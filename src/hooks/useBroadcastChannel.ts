import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  BroadcastActions,
  BroadcastMessage,
  BroadcastOptions,
  ClearReceivedMessagesOptions,
  ClearSentMessagesOptions,
  GetLatestMessageOptions,
  InternalMessage,
  SendMessageOptions,
} from '../types/types';
import {
  generateSourceName,
  isValidMessage,
  isMessageExpired,
  createMessage,
  getInternalMessageType,
  isValidInternalClearMessage,
  debounce,
} from '../utils/messageUtils';
import { debug } from '../utils/debug';

const INTERNAL_MESSAGE_TYPES: Record<string, InternalMessage> = {
  CLEAR_SENT_MESSAGES: 'CLEAR_SENT_MESSAGES',
  PING: 'PING',
  PONG: 'PONG',
} as const;

let flushSyncFn: undefined | ((cb: () => void) => void) = undefined;
if (process.env.NODE_ENV === 'test') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    flushSyncFn = require('react-dom').flushSync;
  } catch {
    // ignore error in test env
  }
}

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
  const [isPingInProgress, setIsPingInProgress] = useState(false);

  // Refs
  const channel = useRef<BroadcastChannel | null>(null);
  const receivedMessageIds = useRef(new Map<string, number>());
  const activeSourcesCollector = useRef<Set<string> | null>(null);

  // Memoized values
  const source = useMemo(() => sourceName || generateSourceName(), [sourceName]);
  const internalTypes = useMemo(
    () => ({
      CLEAR_SENT_MESSAGES: getInternalMessageType(
        INTERNAL_MESSAGE_TYPES.CLEAR_SENT_MESSAGES,
        channelName,
        namespace
      ),
      PING: getInternalMessageType(INTERNAL_MESSAGE_TYPES.PING, channelName, namespace),
      PONG: getInternalMessageType(INTERNAL_MESSAGE_TYPES.PONG, channelName, namespace),
    }),
    [channelName, namespace]
  );

  const resolvedChannelName = useMemo(() => {
    return `${channelName}-${namespace}`;
  }, [channelName, namespace]);

  const stableRegisteredTypes = useMemo(() => registeredTypes, [JSON.stringify(registeredTypes)]);

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

  const ping = useCallback(
    (timeoutMs: number = 300): Promise<string[]> => {
      if (isPingInProgress) {
        debug.ping.inProgress();
        return Promise.resolve([]);
      }

      if (!channel.current) {
        const error =
          'BroadcastChannel is not supported in this browser. Please check browser compatibility.';
        debug.error(error);
        setErrorMessage(error);
        return Promise.resolve([]);
      }

      // Set synchronously before returning the promise
      if (flushSyncFn) {
        flushSyncFn(() => setIsPingInProgress(true));
      } else {
        setIsPingInProgress(true);
      }
      const collector = new Set<string>();
      activeSourcesCollector.current = collector;

      channel.current.postMessage(createMessage(internalTypes.PING, null, source));

      return new Promise(resolve => {
        setTimeout(() => {
          setIsPingInProgress(false);
          if (activeSourcesCollector.current === collector) {
            activeSourcesCollector.current = null;
          }
          resolve(Array.from(collector));
        }, timeoutMs);
      });
    },
    [internalTypes.PING, source, setErrorMessage, isPingInProgress, flushSyncFn]
  );

  const postMessage = useCallback(
    (messageType: string, messageContent: any, options: SendMessageOptions = {}) => {
      const channelCurrent = channel.current;
      if (!channelCurrent) {
        const error =
          'BroadcastChannel is not supported in this browser. Please check browser compatibility.';
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

  const getLatestMessage = useCallback(
    (options: GetLatestMessageOptions = {}) => {
      const { source, type } = options;

      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const sourceMatches = !source || msg.source === source;
        const typeMatches = !type || msg.type === type;
        if (sourceMatches && typeMatches) {
          return msg;
        }
      }

      return null;
    },
    [messages]
  );

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: BroadcastMessage = event.data;
        debug.message.received(message);

        if (!isValidMessage(message)) return;
        if (message.source === source) return;
        if (isValidInternalClearMessage(message)) {
          if (message.type === internalTypes.CLEAR_SENT_MESSAGES) {
            const { ids = [], types = [] } = (message as any).message || {};

            setMessages(prev => [
              ...prev.filter(msg => {
                // Only consider messages from the same sender
                if (msg.source !== message.source) return true;

                // Decide whether this message should be cleared:
                // - If the ids array is empty, treat as wildcard (match all ids)
                // - If the types array is empty, treat as wildcard (match all types)
                const idMatches = ids.length === 0 || ids.includes(msg.id);
                const typeMatches = types.length === 0 || types.includes(msg.type);

                return !(idMatches && typeMatches);
              }),
            ]);

            return;
          }
          if (message.type === internalTypes.PING) {
            channel.current?.postMessage(createMessage(internalTypes.PONG, null, source));
            return;
          }

          if (message.type === internalTypes.PONG) {
            const pongSource = message.source;
            const collector = activeSourcesCollector.current;

            if (collector && collector.has(pongSource) === false) {
              collector.add(pongSource);
            }

            return;
          }
        }
        if (stableRegisteredTypes.length > 0 && !stableRegisteredTypes.includes(message.type)) {
          debug.message.ignored(message.type);
          return;
        }
        if (isMessageExpired(message)) {
          debug.message.expired(message.id);
          return;
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
    [
      source,
      stableRegisteredTypes,
      keepLatestMessage,
      setErrorMessage,
      internalTypes,
      deduplicationTTL,
    ]
  );

  const closeChannel = useCallback(() => {
    const bc = channel.current;
    if (bc && typeof bc.close === 'function') {
      bc.removeEventListener('message', handleMessage);
      bc.close();
      debug.channel.closed(resolvedChannelName);
      channel.current = null;
    }
  }, [handleMessage, resolvedChannelName]);

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
      closeChannel();
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
    isPingInProgress,
    ping,
    postMessage,
    clearReceivedMessages,
    clearSentMessages,
    getLatestMessage,
    error,
    closeChannel,
  };
};

export default useBroadcastChannel;
