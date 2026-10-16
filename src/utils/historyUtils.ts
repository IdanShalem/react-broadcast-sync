import { BroadcastMessage } from '../types/types';
import { isMessageExpired } from './messageUtils';

/**
 * Constants and pure logic for opt-in messages-history replay
 * (requestMessagesHistory). Kept out of the hook so the wire format and the
 * bounding rules are testable in isolation.
 */

/** Default maximum messages each responding tab returns for one history request */
export const DEFAULT_MESSAGES_HISTORY_LIMIT = 50;

/** Hard upper bound applied to a caller-provided history limit */
export const MAX_MESSAGES_HISTORY_LIMIT = 500;

/**
 * Maximum serialized size of one history response. When a response exceeds it,
 * the oldest selected entries are dropped first.
 */
export const MESSAGES_HISTORY_RESPONSE_MAX_BYTES = 64 * 1024;

/** A single message larger than this is never replayed */
export const MESSAGES_HISTORY_MESSAGE_MAX_BYTES = 32 * 1024;

/** How long an issued history request ID stays valid for incoming responses */
export const MESSAGES_HISTORY_REQUEST_TTL_MS = 30 * 1000;

/** Clamp a caller-provided limit to the supported range */
export const normalizeMessagesHistoryLimit = (limit: unknown): number =>
  typeof limit === 'number' && limit > 0
    ? Math.min(Math.floor(limit), MAX_MESSAGES_HISTORY_LIMIT)
    : DEFAULT_MESSAGES_HISTORY_LIMIT;

/**
 * Deterministic history ordering: by timestamp, ties broken by message ID so
 * every tab ranks the same set the same way, even for same-millisecond posts.
 */
export const compareMessagesByTimestamp = (a: BroadcastMessage, b: BroadcastMessage): number =>
  a.timestamp - b.timestamp || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const serializedSize = (msg: BroadcastMessage): number => {
  try {
    return JSON.stringify(msg).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

/**
 * Build the bounded batch a tab sends back for one history request, from its
 * own received and sent logs. Newest-first trimming: expired messages,
 * duplicates, oversized messages and everything beyond the count/byte caps is
 * dropped, always preferring the most recent messages.
 */
export const selectMessagesForHistoryResponse = (
  receivedMessages: BroadcastMessage[],
  sentMessages: BroadcastMessage[],
  options: { types?: unknown; limit?: unknown } = {}
): BroadcastMessage[] => {
  const maxMessages = normalizeMessagesHistoryLimit(options.limit);
  const typeFilter =
    Array.isArray(options.types) && options.types.length > 0
      ? new Set(options.types.filter(t => typeof t === 'string'))
      : null;

  const seen = new Set<string>();
  const pool = [...receivedMessages, ...sentMessages]
    .filter(msg => !isMessageExpired(msg))
    .filter(msg => !typeFilter || typeFilter.has(msg.type))
    .filter(msg => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    })
    .filter(msg => serializedSize(msg) <= MESSAGES_HISTORY_MESSAGE_MAX_BYTES)
    .sort(compareMessagesByTimestamp);

  let selected = pool.slice(-maxMessages);
  const totalBytes = (items: BroadcastMessage[]) =>
    items.reduce((sum, msg) => sum + serializedSize(msg), 0);
  while (selected.length > 1 && totalBytes(selected) > MESSAGES_HISTORY_RESPONSE_MAX_BYTES) {
    selected = selected.slice(1);
  }
  return selected;
};

/**
 * Decide which replayed messages the requesting tab may accept, marked as
 * history and sorted by timestamp. Pure: it reads the shared dedup map but
 * does not mutate it, so the caller can apply an aggregate budget before
 * committing entries to the map and to state.
 */
export const filterIncomingHistoryMessages = (
  candidates: unknown[],
  options: {
    /** This tab's source name; its own messages are never replayed back to it */
    source: string;
    /** Active registeredTypes filter, empty means all types */
    registeredTypes: string[];
    /**
     * Returns true for message IDs that must be skipped (already live in the
     * log or accepted by another request). IDs accepted by THIS request are
     * not duplicates: re-announced entries re-enter the candidate pool so the
     * request can re-rank its newest set.
     */
    isDuplicate: (id: string) => boolean;
    /** Session-local clear barrier; older replayed messages are dropped */
    clearBarrier: number;
  }
): BroadcastMessage[] => {
  const { source, registeredTypes, isDuplicate, clearBarrier } = options;
  const accepted: BroadcastMessage[] = [];

  for (const raw of candidates) {
    if (!raw || typeof raw !== 'object') continue;
    const msg = raw as BroadcastMessage;
    if (
      typeof msg.id !== 'string' ||
      typeof msg.type !== 'string' ||
      typeof msg.source !== 'string' ||
      typeof msg.timestamp !== 'number'
    ) {
      continue;
    }
    if (msg.source === source) continue;
    if (registeredTypes.length > 0 && !registeredTypes.includes(msg.type)) continue;
    if (isMessageExpired(msg)) continue;
    if (msg.timestamp < clearBarrier) continue;
    if (isDuplicate(msg.id)) continue;
    accepted.push({ ...msg, isHistory: true });
  }

  return accepted.sort(compareMessagesByTimestamp);
};

/**
 * Merge already-sorted history entries into the message log by timestamp, so
 * the log stays globally ordered no matter how many tabs answered or in which
 * order their answers arrived. Existing entries (live or earlier history) are
 * preserved; ties keep the earlier-arriving entry first.
 */
export const mergeMessagesByTimestamp = (
  existing: BroadcastMessage[],
  incoming: BroadcastMessage[]
): BroadcastMessage[] => {
  if (incoming.length === 0) return existing;
  if (existing.length === 0) return incoming;
  const merged: BroadcastMessage[] = [];
  let i = 0;
  let j = 0;
  while (i < existing.length && j < incoming.length) {
    if (compareMessagesByTimestamp(existing[i], incoming[j]) <= 0) {
      merged.push(existing[i]);
      i++;
    } else {
      merged.push(incoming[j]);
      j++;
    }
  }
  return merged.concat(existing.slice(i), incoming.slice(j));
};
