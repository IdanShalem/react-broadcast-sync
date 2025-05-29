import { useState, useEffect } from 'react';
import { useBroadcastChannel } from 'react-broadcast-sync';

export const useTextBroadcast = () => {
  const { messages, postMessage } = useBroadcastChannel('text', {
    keepLatestMessage: true,
    namespace: 'demo-app',
  });

  const lastMessage = messages[messages.length - 1];
  const [localText, setLocalText] = useState<string>(lastMessage ? lastMessage.message : '');

  // Update local state when new messages arrive
  useEffect(() => {
    if (lastMessage) {
      setLocalText(lastMessage.message);
    }
  }, [lastMessage]);

  // Initialize text if no messages exist
  useEffect(() => {
    if (messages.length === 0) {
      postMessage('text', '');
    }
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newText = event.target.value;
    setLocalText(newText); // Update local state immediately
    postMessage('text', newText); // Broadcast to other tabs
  };

  return {
    localText,
    handleChange,
  };
};
