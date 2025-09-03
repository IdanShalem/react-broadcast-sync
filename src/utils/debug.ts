declare const process: { env: { [key: string]: string | undefined } };

const isDebugMode = () => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.REACT_APP_DEBUG_BROADCAST === 'true';
  }
  return false;
};

type LogLevel = 'info' | 'warn' | 'error';

const log = (level: LogLevel, message: string, data?: any) => {
  if (!isDebugMode()) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [react-broadcast-sync]`;
  switch (level) {
    case 'info':
      console.log(prefix, message, data || '');
      break;
    case 'warn':
      console.warn(prefix, message, data || '');
      break;
    case 'error':
      console.error(prefix, message, data || '');
      break;
  }
};

export const debug = {
  channel: {
    created: (name: string) => log('info', 'Channel created:', name),
    closed: (name: string) => log('info', 'Channel closed:', name),
  },
  message: {
    sent: (message: any) => log('info', 'Message sent:', message),
    received: (message: any) => log('info', 'Message received:', message),
    cleared: (messageId: string) => log('info', 'Message cleared:', messageId),
    expired: (messageId: string) => log('info', 'Message expired:', messageId),
    duplicate: (messageId: string) => log('warn', 'Duplicate message ignored:', messageId),
    allSentCleared: () => log('info', 'All sent messages cleared'),
    allReceivedCleared: () => log('info', 'All received messages cleared'),
    ignored: (messageType: string) =>
      log('info', 'Message ignored due to type filter:', messageType),
  },
  ping: {
    inProgress: () => log('warn', 'Ping already in progress. Skipping call.'),
  },
  cleanup: {
    started: () => log('info', 'Cleanup started'),
    completed: (removedCount: number) => log('info', 'Cleanup completed:', removedCount),
  },
  error: (context: {
    action: string;
    channelName?: string;
    type?: string;
    source?: string;
    originalError?: unknown;
  }) => {
    const { action, channelName, type, source, originalError } = context;

    let message = `${action}`;
    if (channelName) message += ` | channel: ${channelName}`;
    if (type) message += ` | type: ${type}`;
    if (source) message += ` | source: ${source}`;
    if (originalError instanceof Error) {
      message += ` | cause: ${originalError.message}`;
    } else if (typeof originalError === 'string') {
      message += ` | cause: ${originalError}`;
    } else if (originalError != null) {
      try {
        message += ` | cause: ${JSON.stringify(originalError)}`;
      } catch {
        message += ' | cause: [unserializable]';
      }
    }

    log('error', 'Error:', message);
  },
};
