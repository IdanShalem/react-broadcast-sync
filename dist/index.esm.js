import { useState, useRef, useEffect, createContext, useContext } from 'react';
import { jsx } from 'react/jsx-runtime';

// Generate a random 9-character alphanumeric string
const generateRandomPart = () => Math.random().toString(36).substr(2, 9);
// Hashing function (simple base64 for uniqueness & readability)
const generateId = (source, timestamp) => {
  const raw = `${generateRandomPart()}-${source}-${timestamp}`;
  return btoa(raw).replace(/=+$/, '');
};
const generateSourceName = () => `tab-${generateRandomPart()}`;
const useBroadcastChannel = (channelName, options = {}) => {
  const {
    sourceName,
    cleaningInterval = 1000,
    keepLatestMessage = false,
    registeredTypes = [],
    namespace = ''
  } = options;
  const [messages, setMessages] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [error, setError] = useState(null);
  const channel = useRef(null);
  const receivedMessageIds = useRef(new Set());
  const source = useRef(sourceName || generateSourceName()).current;
  const setErrorMessage = error => {
    setError(error);
    setTimeout(() => setError(null), 3000);
  };
  useEffect(() => {
    const namespacedChannel = `${channelName}-${namespace}`;
    console.log('namespacedChannel:', namespacedChannel);
    const bc = new BroadcastChannel(namespacedChannel);
    console.log('setting channel:', bc);
    channel.current = bc;
    const handleMessage = event => {
      try {
        const message = event.data;
        if (!message || typeof message !== 'object' || !message.id) return;
        // Ignore messages sent by this instance
        if (message.source === source) return;
        // Check message type and ensure it matches the registered types
        if (registeredTypes.length > 0 && !registeredTypes.includes(message.type)) {
          return;
        }
        // Handle internal clear instructions
        if (message.type === '__CLEAR_MESSAGE__') {
          setMessages(prev => prev.filter(msg => {
            return !(msg.id === message.id && msg.source === message.source);
          }));
          return;
        }
        if (message.type === '__CLEAR_ALL_MESSAGES__') {
          setMessages(prev => prev.filter(msg => msg.source !== message.source));
          return;
        }
        const now = Date.now();
        // Handle message expiration (TTL logic)
        if (message.expirationDate && message.expirationDate < now) {
          return;
        }
        if (receivedMessageIds.current.has(message.id)) return;
        receivedMessageIds.current.add(message.id);
        // If TTL is not expired, add to messages
        setMessages(prevMessages => {
          return keepLatestMessage ? [message] : [...prevMessages, message];
        });
      } catch (e) {
        setErrorMessage('Error processing broadcast message');
      }
    };
    bc.addEventListener('message', handleMessage);
    return () => {
      bc.removeEventListener('message', handleMessage);
      bc.close();
    };
  }, [channelName, namespace, keepLatestMessage, JSON.stringify(registeredTypes)]);
  useEffect(() => {
    if (cleaningInterval <= 0) return;
    const interval = setInterval(() => {
      setMessages(prevMessages => prevMessages.filter(msg => !msg.expirationDate || msg.expirationDate > Date.now()));
    }, cleaningInterval);
    return () => clearInterval(interval);
  }, [cleaningInterval]);
  const postMessage = (messageType, messageContent, options = {}) => {
    var _a;
    const channelCurrent = channel.current;
    if (!channelCurrent) {
      setErrorMessage('Channel not available');
      console.error('Attempted to post message, but channel is null');
      return;
    }
    const timestamp = Date.now();
    const id = generateId(source, timestamp);
    const message = {
      id,
      type: messageType,
      message: messageContent,
      timestamp,
      source,
      expirationDate: (_a = options.expirationDate) !== null && _a !== void 0 ? _a : options.expirationDuration ? timestamp + options.expirationDuration : undefined
    };
    try {
      channelCurrent === null || channelCurrent === void 0 ? void 0 : channelCurrent.postMessage(message);
      setSentMessages(prev => [...prev, message]); // Save the message to sentMessages
    } catch (e) {
      setErrorMessage('Failed to send message');
    }
  };
  const clearMessage = id => {
    var _a;
    setMessages(prev => prev.filter(msg => msg.id !== id));
    setSentMessages(prev => prev.filter(msg => msg.id !== id)); // Remove from sentMessages as well
    (_a = channel.current) === null || _a === void 0 ? void 0 : _a.postMessage({
      id,
      type: '__CLEAR_MESSAGE__',
      source
    });
  };
  const clearAllMessages = () => {
    var _a;
    setMessages([]);
    setSentMessages([]); // Clear all sent messages
    (_a = channel.current) === null || _a === void 0 ? void 0 : _a.postMessage({
      id: '__CLEAR_ALL_MESSAGES__',
      type: '__CLEAR_ALL_MESSAGES__',
      source
    });
  };
  const clearSentMessage = id => {
    var _a;
    setSentMessages(prev => prev.filter(msg => msg.id !== id)); // Clear specific sent message
    (_a = channel.current) === null || _a === void 0 ? void 0 : _a.postMessage({
      id,
      type: '__CLEAR_MESSAGE__',
      source
    });
  };
  return {
    messages,
    sentMessages,
    postMessage,
    clearMessage,
    clearAllMessages,
    clearSentMessage,
    error
  };
};

const BroadcastContext = /*#__PURE__*/createContext(null);
function BroadcastProvider({
  children
}) {
  const {
    messages,
    postMessage,
    error
  } = useBroadcastChannel('global');
  return jsx(BroadcastContext.Provider, {
    value: {
      messages,
      postMessage,
      error
    },
    children: children
  });
}
function useBroadcast() {
  const context = useContext(BroadcastContext);
  if (!context) {
    throw new Error("useBroadcast must be used within a BroadcastProvider");
  }
  return context;
}

export { BroadcastProvider, useBroadcast, useBroadcastChannel };
//# sourceMappingURL=index.esm.js.map
