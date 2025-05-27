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
    created: (channelName: string) => log('info', 'Channel created:', channelName),
    closed: (channelName: string) => log('info', 'Channel closed:', channelName),
  },
  message: {
    sent: (message: any) => log('info', 'Message sent:', message),
    received: (message: any) => log('info', 'Message received:', message),
    cleared: (messageId: string) => log('info', 'Message cleared:', messageId),
    expired: (messageId: string) => log('info', 'Message expired:', messageId),
    duplicate: (messageId: string) => log('warn', 'Duplicate message ignored:', messageId),
  },
  cleanup: {
    started: () => log('info', 'Cleanup started'),
    completed: (removedCount: number) => log('info', 'Cleanup completed:', { removedCount }),
  },
  error: (error: string) => log('error', 'Error:', error),
}; 