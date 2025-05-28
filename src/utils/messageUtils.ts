const INTERNAL_PREFIX = '__INTERNAL__';
const SECRET = 'react-broadcast-sync';

// Generate a random 9-character alphanumeric string
export const generateRandomPart = () => Math.random().toString(36).substr(2, 9);

// Generate a unique source name for a tab
export const generateSourceName = () => `tab-${generateRandomPart()}`;

// Generate a unique message ID
export const generateMessageId = (source: string, timestamp: number) => {
  const raw = `${generateRandomPart()}-${source}-${timestamp}`;
  return btoa(raw).replace(/=+$/, '');
};

// Check if a message is valid
export const isValidMessage = (message: any): boolean => {
  return Boolean(message && typeof message === 'object' && 'id' in message);
};

// Check if a message has expired
export const isMessageExpired = (message: { expirationDate?: number }): boolean => {
  return message.expirationDate ? message.expirationDate < Date.now() : false;
};

// Create a new message object
export const createMessage = (
  type: string,
  content: any,
  source: string,
  options: { expirationDate?: number; expirationDuration?: number } = {}
): any => {
  const timestamp = Date.now();
  return {
    id: generateMessageId(source, timestamp),
    type,
    message: content,
    timestamp,
    source,
    expirationDate: options.expirationDate ?? 
      (options.expirationDuration ? timestamp + options.expirationDuration : undefined),
  };
};


export const getInternalMessageType = (
    baseType: 'CLEAR_MESSAGE' | 'CLEAR_ALL_MESSAGES',
    channelName: string,
    namespace = ''
  ): string => {
    const fullChannel = `${channelName}-${namespace}`;
    const input = `${SECRET}:${baseType}:${fullChannel}`;
    const hash = btoa(input); // optional: use sha256 if added
    return `${INTERNAL_PREFIX}:${baseType}:${hash}`;
  };

export const isInternalType = (type: string): boolean => {
    return type.startsWith(`${INTERNAL_PREFIX}:`);
};

export const isValidInternalClearMessage = (message: any): message is { id: string, type: string, source: string } => {
  return (
    message &&
    typeof message === 'object' &&
    typeof message.id === 'string' &&
    typeof message.source === 'string' &&
    typeof message.type === 'string' &&
    isInternalType(message.type)
  );
}

export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): ((...args: Parameters<T>) => void) & {
  cancel: () => void;
  flush: () => ReturnType<T> | undefined;
} => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: any = null;
  let result: ReturnType<T> | undefined;

  const debounced = function(this: any, ...args: Parameters<T>) {
    lastArgs = args;
    lastThis = this;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (lastArgs !== null) {
        result = fn.apply(lastThis, lastArgs);
        lastArgs = null;
        lastThis = null;
      }
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
      lastThis = null;
    }
  };

  debounced.flush = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      if (lastArgs !== null) {
        result = fn.apply(lastThis, lastArgs);
        lastArgs = null;
        lastThis = null;
      }
    }
    return result;
  };

  return debounced as typeof debounced & {
    cancel: () => void;
    flush: () => ReturnType<T> | undefined;
  };
};
