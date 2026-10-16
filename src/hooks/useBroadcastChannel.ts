import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  BroadcastActions,
  BroadcastMessage,
  BroadcastOptions,
  ClearReceivedMessagesOptions,
  ClearSentMessagesOptions,
  GetLatestMessageOptions,
  InternalMessage,
  MessageCallback,
  OnMessageMap,
  RequestHistoryOptions,
  SendMessageOptions,
} from '../types/types';
import {
  generateRandomPart,
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
  REQUEST_HISTORY: 'REQUEST_HISTORY',
  HISTORY_RESPONSE: 'HISTORY_RESPONSE',
} as const;

/** Default per-responder message cap for history replay */
const DEFAULT_HISTORY_LIMIT = 50;
/** Hard upper bound for a caller-provided history limit */
const MAX_HISTORY_LIMIT = 500;
/** Maximum serialized size of one history response; older entries are dropped first */
const HISTORY_RESPONSE_MAX_BYTES = 64 * 1024;
/** Messages individually larger than this are never replayed */
const HISTORY_MESSAGE_MAX_BYTES = 32 * 1024;
/** How long a history request ID stays valid for incoming responses */
const HISTORY_REQUEST_TTL_MS = 30 * 1000;

let flushSyncFn: undefined | ((cb: () => void) => void) = undefined;
if (process.env.NODE_ENV === 'test') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    flushSyncFn = require('react-dom').flushSync;
  } catch {
    // ignore error in test env
  }
}

/**
 * Opens a BroadcastChannel and returns its state and actions. Scoped to one component: each
 * call has its own connection and state.
 *
 * Behavior to know:
 * - Self-filtering: messages sent by this tab (same `sourceName`) are ignored. They never appear
 *   in `messages` or trigger `onMessage`; they are listed in `sentMessages`. Two tabs that share a
 *   `sourceName` will not receive each other's messages.
 * - `messages` is an event log of what other tabs sent, not current state.
 * - No automatic replay: a tab opened later only receives messages sent after it opened,
 *   unless it explicitly calls `requestHistory()`.
 * - `keepLatestMessage` keeps only the most recent received message in `messages`. It does not
 *   affect `sentMessages` and does not replay anything to new tabs.
 * - Batching: with `batchingDelayMs > 0` (default 20 ms) outgoing messages are grouped and sent
 *   together. Types in `excludedBatchMessageTypes` are sent immediately. Set it to 0 to disable.
 * - Defaults: `cleaningInterval` 1000 ms, `deduplicationTTL` 5 minutes (300000 ms),
 *   `cleanupDebounceMs` 0, `batchingDelayMs` 20 ms. Duplicates are dropped by
 *   message ID.
 * - Errors are reported through the `error` string (it clears itself after 3 seconds); the hook
 *   does not throw for channel errors. `useBroadcastProvider` (not this hook) throws when used
 *   outside a `BroadcastProvider`.
 *
 * Note: When batching is enabled (batchingDelayMs > 0), messages sent over the channel may be received as either:
 *   - a single BroadcastMessage (object), or
 *   - an array of BroadcastMessage (batch)
 *
 * The event handler in this hook supports both formats. If you listen to the channel directly, always check:
 *   if (Array.isArray(event.data)) { ... } else { ... }
 */
export const useBroadcastChannel = (
  channelName: string,
  options: BroadcastOptions = {},
  /** @internal — used by BroadcastProvider to distinguish its entry point */
  _entry: 'hook' | 'provider' = 'hook'
): BroadcastActions => {
  const {
    sourceName,
    cleaningInterval = 1000,
    keepLatestMessage = false,
    registeredTypes = [],
    namespace = '',
    deduplicationTTL = 5 * 60 * 1000,
    cleanupDebounceMs = 0,
    batchingDelayMs = 20,
    excludedBatchMessageTypes = [],
    onMessage,
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
  const batchingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const batchingMessagesRef = useRef<BroadcastMessage[]>([]);
  const batchingErrorRef = useRef(false);
  const onMessageRef = useRef<MessageCallback | OnMessageMap | undefined>(onMessage);
  onMessageRef.current = onMessage;
  const messagesRef = useRef<BroadcastMessage[]>([]);
  messagesRef.current = messages;
  const sentMessagesRef = useRef<BroadcastMessage[]>([]);
  sentMessagesRef.current = sentMessages;
  // History request IDs issued by this tab that may still receive responses
  const pendingHistoryRequests = useRef(new Map<string, number>());
  // Session-local clear barrier: replayed messages older than this are dropped
  const historyClearBarrier = useRef(0);

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
      REQUEST_HISTORY: getInternalMessageType(
        INTERNAL_MESSAGE_TYPES.REQUEST_HISTORY,
        channelName,
        namespace
      ),
      HISTORY_RESPONSE: getInternalMessageType(
        INTERNAL_MESSAGE_TYPES.HISTORY_RESPONSE,
        channelName,
        namespace
      ),
    }),
    [channelName, namespace]
  );

  const resolvedChannelName = useMemo(() => {
    // Only append dash if namespace is non-empty
    return namespace ? `${channelName}-${namespace}` : channelName;
  }, [channelName, namespace]);

  const registeredTypesRef = useRef<string[]>(registeredTypes);
  registeredTypesRef.current = registeredTypes;

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
        debug.error({
          action: 'ping',
          channelName: resolvedChannelName,
          originalError: error,
        });
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

      try {
        channel.current.postMessage(createMessage(internalTypes.PING, null, source));
      } catch (e) {
        activeSourcesCollector.current = null;
        setIsPingInProgress(false);
        const error = 'Failed to send ping';
        debug.error({
          action: 'ping',
          channelName: resolvedChannelName,
          originalError: e instanceof Error ? e.message : String(e),
        });
        setErrorMessage(error);
        return Promise.resolve([]);
      }

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
    [internalTypes.PING, source, setErrorMessage, isPingInProgress, resolvedChannelName]
  );

  const postMessage = useCallback(
    (messageType: string, messageContent: any, options: SendMessageOptions = {}) => {
      const channelCurrent = channel.current;
      if (!channelCurrent) {
        const error =
          'BroadcastChannel is not supported in this browser. Please check browser compatibility.';
        debug.error({
          action: 'postMessage',
          channelName: resolvedChannelName,
          type: messageType,
          originalError: error,
        });
        setErrorMessage(error);
        return;
      }

      const message = createMessage(messageType, messageContent, source, options);
      // Only batch if batchingDelayMs > 0 and messageType is not excluded
      const shouldSendImmediately =
        !batchingDelayMs || batchingDelayMs < 0 || excludedBatchMessageTypes.includes(messageType);
      if (shouldSendImmediately) {
        try {
          channelCurrent.postMessage(message);
        } catch (e) {
          const error = 'Failed to send message';
          debug.error({
            action: 'postMessage',
            channelName: resolvedChannelName,
            type: messageType,
            originalError: error,
          });
          setErrorMessage(error);
          batchingErrorRef.current = true;
        }
      } else {
        batchingMessagesRef.current.push(message);
        if (!batchingTimeoutRef.current) {
          batchingTimeoutRef.current = setTimeout(() => {
            if (batchingErrorRef.current) {
              batchingMessagesRef.current = [];
              batchingTimeoutRef.current = null;
              return;
            }
            try {
              channelCurrent.postMessage(batchingMessagesRef.current);
            } catch (e) {
              const error = 'Failed to send message';
              debug.error({
                action: 'postMessage',
                channelName: resolvedChannelName,
                type: messageType,
                originalError: error,
              });
              setErrorMessage(error);
              batchingErrorRef.current = true;
            }
            batchingMessagesRef.current = [];
            batchingTimeoutRef.current = null;
          }, batchingDelayMs);
        }
      }
      debug.message.sent(message);
      setSentMessages(prev => [...prev, message]);
    },
    [source, setErrorMessage, batchingDelayMs, excludedBatchMessageTypes]
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
    if (!hasFilters) {
      debug.message.allReceivedCleared();
    }
    // Session-local barrier: history replayed after this point must be newer,
    // so messages this tab cleared are not resurrected by another tab's copy.
    historyClearBarrier.current = Date.now();
  }, []);

  const clearSentMessages = useCallback(
    (options: ClearSentMessagesOptions = {}) => {
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
      if (ids.length === 0 && types.length === 0) {
        debug.message.allSentCleared();
      }
      if (sync) {
        channel.current?.postMessage(
          createMessage(
            internalTypes.CLEAR_SENT_MESSAGES,
            { ids: options.ids ?? [], types: options.types ?? [] },
            source
          )
        );
      }
    },
    [source, internalTypes.CLEAR_SENT_MESSAGES]
  );

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

  const requestHistory = useCallback(
    (options: RequestHistoryOptions = {}) => {
      const channelCurrent = channel.current;
      if (!channelCurrent) {
        const error =
          'BroadcastChannel is not supported in this browser. Please check browser compatibility.';
        debug.error({
          action: 'requestHistory',
          channelName: resolvedChannelName,
          originalError: error,
        });
        setErrorMessage(error);
        return;
      }

      const now = Date.now();
      for (const [id, requestedAt] of pendingHistoryRequests.current.entries()) {
        if (now - requestedAt >= HISTORY_REQUEST_TTL_MS) {
          pendingHistoryRequests.current.delete(id);
        }
      }

      const requestId = `${source}-${now}-${generateRandomPart()}`;
      pendingHistoryRequests.current.set(requestId, now);

      const limit =
        typeof options.limit === 'number' && options.limit > 0
          ? Math.min(Math.floor(options.limit), MAX_HISTORY_LIMIT)
          : DEFAULT_HISTORY_LIMIT;

      try {
        channelCurrent.postMessage(
          createMessage(
            internalTypes.REQUEST_HISTORY,
            { requestId, types: options.types ?? [], limit },
            source
          )
        );
      } catch (e) {
        pendingHistoryRequests.current.delete(requestId);
        const error = 'Failed to request history';
        debug.error({
          action: 'requestHistory',
          channelName: resolvedChannelName,
          originalError: e instanceof Error ? e.message : String(e),
        });
        setErrorMessage(error);
      }
    },
    [source, internalTypes.REQUEST_HISTORY, resolvedChannelName, setErrorMessage]
  );

  const respondToHistoryRequest = useCallback(
    (requestId: string, types: unknown, limit: unknown) => {
      const channelCurrent = channel.current;
      if (!channelCurrent) return;

      const maxMessages =
        typeof limit === 'number' && limit > 0
          ? Math.min(Math.floor(limit), MAX_HISTORY_LIMIT)
          : DEFAULT_HISTORY_LIMIT;
      const typeFilter =
        Array.isArray(types) && types.length > 0
          ? new Set(types.filter(t => typeof t === 'string'))
          : null;

      const seen = new Set<string>();
      const pool = [...messagesRef.current, ...sentMessagesRef.current]
        .filter(msg => !isMessageExpired(msg))
        .filter(msg => !typeFilter || typeFilter.has(msg.type))
        .filter(msg => {
          if (seen.has(msg.id)) return false;
          seen.add(msg.id);
          return true;
        })
        .filter(msg => {
          try {
            return JSON.stringify(msg).length <= HISTORY_MESSAGE_MAX_BYTES;
          } catch {
            return false;
          }
        })
        .sort((a, b) => a.timestamp - b.timestamp);

      let selected = pool.slice(-maxMessages);
      const totalBytes = (items: BroadcastMessage[]) =>
        items.reduce((sum, msg) => sum + JSON.stringify(msg).length, 0);
      while (selected.length > 1 && totalBytes(selected) > HISTORY_RESPONSE_MAX_BYTES) {
        selected = selected.slice(1);
      }
      if (selected.length === 0) return;

      try {
        channelCurrent.postMessage(
          createMessage(internalTypes.HISTORY_RESPONSE, { requestId, messages: selected }, source)
        );
      } catch (e) {
        debug.error({
          action: 'respondToHistoryRequest',
          channelName: resolvedChannelName,
          originalError: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [source, internalTypes.HISTORY_RESPONSE, resolvedChannelName]
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

          if (message.type === internalTypes.REQUEST_HISTORY) {
            const payload = (message as any).message || {};
            if (typeof payload.requestId !== 'string' || !payload.requestId) return;
            respondToHistoryRequest(payload.requestId, payload.types, payload.limit);
            return;
          }

          if (message.type === internalTypes.HISTORY_RESPONSE) {
            const payload = (message as any).message || {};
            const requestId = payload.requestId;
            const historyMessages = payload.messages;
            if (typeof requestId !== 'string' || !pendingHistoryRequests.current.has(requestId)) {
              return;
            }
            if (!Array.isArray(historyMessages)) return;

            const now = Date.now();
            const barrier = historyClearBarrier.current;
            const accepted: BroadcastMessage[] = [];
            for (const raw of historyMessages) {
              if (!isValidMessage(raw)) continue;
              // Never replay this tab's own messages back into its received log
              if (raw.source === source) continue;
              if (
                registeredTypesRef.current.length > 0 &&
                !registeredTypesRef.current.includes(raw.type)
              ) {
                continue;
              }
              if (isMessageExpired(raw)) continue;
              // Session-local clear barrier: do not resurrect cleared messages
              if (raw.timestamp < barrier) continue;
              // Deduplicate against live arrivals and other responders
              if (receivedMessageIds.current.has(raw.id)) continue;
              receivedMessageIds.current.set(raw.id, now);
              accepted.push({ ...raw, isHistory: true });
            }

            if (accepted.length > 0) {
              accepted.sort((a, b) => a.timestamp - b.timestamp);
              setMessages(prev =>
                keepLatestMessage ? [accepted[accepted.length - 1]] : [...prev, ...accepted]
              );
            }
            // Display-only: onMessage is intentionally never fired for replay
            return;
          }
        }
        if (
          registeredTypesRef.current.length > 0 &&
          !registeredTypesRef.current.includes(message.type)
        ) {
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

        try {
          const cb = onMessageRef.current;
          if (typeof cb === 'function') {
            cb(message);
          } else if (cb) {
            cb[message.type]?.(message);
          }
        } catch (e) {
          debug.error({
            action: 'onMessage',
            channelName: resolvedChannelName,
            originalError: e instanceof Error ? e.message : String(e),
          });
        }
      } catch (e) {
        const error = 'Error processing broadcast message';
        debug.error({
          action: 'handleMessage',
          channelName: resolvedChannelName,
          originalError: error,
        });
        setErrorMessage(error);
      }
    },
    [
      source,
      keepLatestMessage,
      setErrorMessage,
      internalTypes,
      deduplicationTTL,
      respondToHistoryRequest,
    ]
  );

  const flushPendingBatch = useCallback((bc: BroadcastChannel) => {
    if (batchingTimeoutRef.current) {
      clearTimeout(batchingTimeoutRef.current);
      batchingTimeoutRef.current = null;
    }
    const pending = batchingMessagesRef.current;
    batchingMessagesRef.current = [];
    if (pending.length > 0 && !batchingErrorRef.current) {
      try {
        bc.postMessage(pending);
      } catch (e) {
        debug.error({
          action: 'flushPendingBatch',
          channelName: bc.name,
          originalError: e instanceof Error ? e.message : String(e),
        });
      }
    }
    batchingErrorRef.current = false;
  }, []);

  const closeChannel = useCallback(() => {
    const bc = channel.current;
    if (bc && typeof bc.close === 'function') {
      flushPendingBatch(bc);
      bc.close();
      debug.channel.closed(resolvedChannelName);
      channel.current = null;
    }
  }, [flushPendingBatch, resolvedChannelName]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      const error =
        'BroadcastChannel is not supported in this browser. Please check browser compatibility.';
      debug.error({
        action: 'useBroadcastChannel',
        channelName: resolvedChannelName,
        originalError: error,
      });
      setErrorMessage(error);
      return;
    }

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(resolvedChannelName);
    } catch (e) {
      const error = 'Failed to create BroadcastChannel';
      debug.error({
        action: 'useBroadcastChannel',
        channelName: resolvedChannelName,
        originalError: e instanceof Error ? e : String(e),
      });
      setErrorMessage(error);
      return;
    }
    channel.current = bc;
    debug.channel.created(resolvedChannelName);

    const listener = (event: MessageEvent) => {
      // event.data may be a single message or an array of messages (batch)
      if (Array.isArray(event.data)) {
        event.data.forEach((message: BroadcastMessage) => {
          handleMessage({ data: message } as MessageEvent<BroadcastMessage>);
        });
      } else {
        handleMessage(event);
      }
    };
    bc.addEventListener('message', listener);
    return () => {
      bc.removeEventListener('message', listener);
      // Flush while this effect's channel is still open. A later effect may
      // create a different channel, so never carry this queue into it.
      if (channel.current === bc) {
        flushPendingBatch(bc);
        bc.close();
        debug.channel.closed(resolvedChannelName);
        channel.current = null;
      }
    };
  }, [resolvedChannelName, handleMessage, setErrorMessage, flushPendingBatch]);

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
      for (const [key, timestamp] of receivedMessageIds.current.entries()) {
        if (now - timestamp >= deduplicationTTL) {
          receivedMessageIds.current.delete(key);
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
    requestHistory,
    error,
    closeChannel,
  };
};

export default useBroadcastChannel;
