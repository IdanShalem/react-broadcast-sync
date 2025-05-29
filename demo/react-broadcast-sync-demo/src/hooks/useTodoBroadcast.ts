/**
 * Custom hook for managing todo list synchronization across browser tabs.
 *
 * This hook provides functionality for:
 * 1. Synchronizing todo items across multiple browser tabs
 * 2. Broadcasting hover states for visual feedback
 * 3. Synchronizing scroll position across tabs
 * 4. Managing todo item completion status
 *
 * @returns {Object} Todo list state and handlers
 * @property {Todo[]} todos - Array of todo items
 * @property {string} newTodo - Current input value for new todo
 * @property {Function} setNewTodo - Function to update new todo input
 * @property {number|null} hoveredTodoId - ID of currently hovered todo
 * @property {boolean} isScrolling - Whether the list is currently scrolling
 * @property {boolean} isSyncing - Whether scroll sync is in progress
 * @property {boolean} showCheckmark - Whether to show sync completion indicator
 * @property {React.RefObject} scrollContainerRef - Ref for the scroll container
 * @property {Function} handleScroll - Function to handle scroll events
 * @property {Function} addTodo - Function to add a new todo
 * @property {Function} toggleTodo - Function to toggle todo completion
 * @property {Function} handleTodoMouseEnter - Function to handle todo hover
 * @property {Function} handleTodoMouseLeave - Function to handle todo unhover
 */
import { useState, useEffect, useRef } from 'react';
import { useBroadcastChannel } from 'react-broadcast-sync';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

/**
 * Hook for managing todo list synchronization across browser tabs.
 * Provides real-time todo updates, completion status tracking, and scroll position sync.
 *
 * @returns {Object} Todo state and handlers
 * @property {Todo[]} todos - List of todos
 * @property {string} newTodo - New todo input value
 * @property {Function} handleNewTodoChange - Function to handle new todo input changes
 * @property {Function} handleAddTodo - Function to add a new todo
 * @property {Function} handleToggleTodo - Function to toggle todo completion
 * @property {Function} handleDeleteTodo - Function to delete a todo
 * @property {Function} handleScroll - Function to handle scroll position sync
 */
export const useTodoBroadcast = () => {
  const { messages, postMessage } = useBroadcastChannel('todos', {
    keepLatestMessage: true,
    namespace: 'demo-app',
  });

  // Add hover state broadcast channel
  const { messages: hoverMessages, postMessage: postHoverMessage } = useBroadcastChannel(
    'todos-hover',
    {
      keepLatestMessage: true,
      namespace: 'demo-app',
    }
  );

  // Add scroll position broadcast channel
  const { messages: scrollMessages, postMessage: postScrollMessage } = useBroadcastChannel(
    'todos-scroll',
    {
      keepLatestMessage: true,
      namespace: 'demo-app',
    }
  );

  const lastMessage = messages[messages.length - 1];
  const lastHoverMessage = hoverMessages[hoverMessages.length - 1];
  const lastScrollMessage = scrollMessages[scrollMessages.length - 1];

  const [todos, setTodos] = useState<Todo[]>(lastMessage ? lastMessage.message : []);
  const [newTodo, setNewTodo] = useState('');
  const [hoveredTodoId, setHoveredTodoId] = useState<string | null>(
    lastHoverMessage ? lastHoverMessage.message : null
  );
  const [isScrolling, setIsScrolling] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCheckmark, setShowCheckmark] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const checkmarkTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Update local state when new messages arrive
  useEffect(() => {
    if (lastMessage) {
      setTodos(lastMessage.message);
    }
  }, [lastMessage]);

  // Update hover state when new hover messages arrive
  useEffect(() => {
    if (lastHoverMessage) {
      setHoveredTodoId(lastHoverMessage.message);
    }
  }, [lastHoverMessage]);

  // Update scroll position when new scroll messages arrive
  useEffect(() => {
    if (lastScrollMessage && scrollContainerRef.current) {
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
      setIsScrolling(false);

      // Perform scroll
      scrollContainerRef.current.scrollTo({
        top: lastScrollMessage.message,
        behavior: 'smooth',
      });

      // Listen for scroll end
      const handleScrollEnd = () => {
        setIsSyncing(false);
        setShowCheckmark(true);

        // Hide indicator after showing checkmark
        checkmarkTimeoutRef.current = setTimeout(() => {
          setShowCheckmark(false);
        }, 1000);

        // Remove the event listener
        scrollContainerRef.current?.removeEventListener('scrollend', handleScrollEnd);
      };

      // Add scroll end listener
      scrollContainerRef.current.addEventListener('scrollend', handleScrollEnd);

      // Fallback timeout in case scrollend event doesn't fire
      syncTimeoutRef.current = setTimeout(() => {
        handleScrollEnd();
      }, 500);

      // Cleanup
      return () => {
        scrollContainerRef.current?.removeEventListener('scrollend', handleScrollEnd);
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        if (checkmarkTimeoutRef.current) {
          clearTimeout(checkmarkTimeoutRef.current);
        }
      };
    }
  }, [lastScrollMessage]);

  // Initialize todos if no messages exist
  useEffect(() => {
    if (messages.length === 0) {
      postMessage('todos', []);
    }
  }, []);

  const handleScrollSync = (e: React.UIEvent<HTMLDivElement>) => {
    const newScrollPosition = e.currentTarget.scrollTop;

    // Clear any existing timeouts
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    if (checkmarkTimeoutRef.current) {
      clearTimeout(checkmarkTimeoutRef.current);
    }

    // Reset states
    setIsScrolling(true);
    setIsSyncing(true);
    setShowCheckmark(false);

    // Debounce the scroll message to avoid too many updates
    scrollTimeoutRef.current = setTimeout(() => {
      postScrollMessage('todos-scroll', newScrollPosition);
    }, 100);
  };

  const handleNewTodoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewTodo(event.target.value);
  };

  const handleAddTodo = (event: React.FormEvent) => {
    event.preventDefault();
    if (newTodo.trim()) {
      const updated = [
        ...todos,
        { id: Date.now().toString(), text: newTodo.trim(), completed: false },
      ];
      setTodos(updated);
      postMessage('todos', updated);
      setNewTodo('');
    }
  };

  const handleToggleTodo = (id: string) => {
    const updated = todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    setTodos(updated);
    postMessage('todos', updated);
  };

  const handleDeleteTodo = (id: string) => {
    const updated = todos.filter(todo => todo.id !== id);
    setTodos(updated);
    postMessage('todos', updated);
  };

  const handleTodoMouseEnter = (id: string) => {
    setHoveredTodoId(id);
    postHoverMessage('todos-hover', id);
  };

  const handleTodoMouseLeave = () => {
    setHoveredTodoId(null);
    postHoverMessage('todos-hover', null);
  };

  return {
    todos,
    newTodo,
    handleNewTodoChange,
    handleAddTodo,
    handleToggleTodo,
    handleDeleteTodo,
    handleScrollSync,
    hoveredTodoId,
    isScrolling,
    isSyncing,
    showCheckmark,
    scrollContainerRef,
    handleTodoMouseEnter,
    handleTodoMouseLeave,
  };
};
