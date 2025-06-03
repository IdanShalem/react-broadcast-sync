/**
 * Custom hook for managing counter state synchronization across browser tabs.
 *
 * This hook provides functionality for:
 * 1. Synchronizing a counter value across multiple browser tabs
 * 2. Broadcasting hover state for visual feedback
 * 3. Maintaining consistent state across all instances
 *
 * @returns {Object} Counter state and handlers
 * @property {number} count - Current counter value
 * @property {boolean} isHovered - Whether the counter is currently hovered
 * @property {Function} increment - Function to increment the counter
 * @property {Function} decrement - Function to decrement the counter
 * @property {Function} handleMouseEnter - Function to handle mouse enter event
 * @property {Function} handleMouseLeave - Function to handle mouse leave event
 */
import { useState, useEffect, useRef } from 'react';
import { useBroadcastChannel } from 'react-broadcast-sync';

export const useCounterBroadcast = () => {
  const { messages, postMessage } = useBroadcastChannel('counter', {
    keepLatestMessage: true,
    namespace: 'demo-app',
  });

  const [count, setCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCheckmark, setShowCheckmark] = useState(false);
  const lastTimestampRef = useRef<number>(0);

  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const checkmarkTimeoutRef = useRef<NodeJS.Timeout>();

  // Update count when new messages arrive
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.message !== undefined && lastMessage.timestamp > lastTimestampRef.current) {
      // Clear any existing timeouts
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (checkmarkTimeoutRef.current) {
        clearTimeout(checkmarkTimeoutRef.current);
      }

      // Reset states
      setIsSyncing(true);
      setShowCheckmark(false);

      // Update count and timestamp
      setCount(lastMessage.message);
      lastTimestampRef.current = lastMessage.timestamp;

      // Show checkmark after a short delay
      syncTimeoutRef.current = setTimeout(() => {
        setIsSyncing(false);
        setShowCheckmark(true);

        // Hide checkmark after showing it
        checkmarkTimeoutRef.current = setTimeout(() => {
          setShowCheckmark(false);
        }, 1000);
      }, 500);
    }

    // Cleanup
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (checkmarkTimeoutRef.current) {
        clearTimeout(checkmarkTimeoutRef.current);
      }
    };
  }, [messages]);

  const increment = () => {
    const newCount = count + 1;
    setCount(newCount);
    postMessage('counter', newCount);
  };

  const decrement = () => {
    const newCount = count - 1;
    setCount(newCount);
    postMessage('counter', newCount);
  };

  return {
    count,
    increment,
    decrement,
    isSyncing,
    showCheckmark,
  };
};
