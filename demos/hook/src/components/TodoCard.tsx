import { useEffect, useState } from 'react';
import { Box, Checkbox, IconButton, List, ListItem, ListItemText, TextField } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { BroadcastActions } from 'react-broadcast-sync';
import { DemoCard, track } from '@rbs-demos/shared';

type ChannelSlice = Pick<BroadcastActions, 'messages' | 'postMessage'>;

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

const CODE = `const { messages, postMessage } = useBroadcastChannel('todo', {
  namespace: 'hook-demo',
});

// Adopt the list another tab published
useEffect(() => {
  const latest = messages[messages.length - 1];
  if (latest) setTodos(latest.message);
}, [messages]);

// Publish the whole list on every change
const next = [...todos, { id: crypto.randomUUID(), text, done: false }];
setTodos(next);
postMessage('todos', next);`;

export const TodoCard = ({ messages, postMessage }: ChannelSlice) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (latest && Array.isArray(latest.message)) {
      setTodos(latest.message);
    }
  }, [messages]);

  const publish = (next: Todo[]) => {
    setTodos(next);
    postMessage('todos', next);
  };

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    track('demo_action', {
      card: 'todo',
      action: 'add_todo',
      method: 'postMessage',
      message_type: 'todos',
      length: text.length,
    });
    publish([...todos, { id: crypto.randomUUID(), text, done: false }]);
    setDraft('');
  };

  return (
    <DemoCard title="Todo list" code={CODE}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Add a todo and press Enter"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          inputProps={{ 'aria-label': 'New todo' }}
        />
      </Box>
      <List dense sx={{ maxHeight: 132, overflowY: 'auto' }}>
        {todos.map(todo => (
          <ListItem
            key={todo.id}
            disablePadding
            secondaryAction={
              <IconButton
                edge="end"
                size="small"
                aria-label={`Delete ${todo.text}`}
                onClick={() => {
                  track('demo_action', {
                    card: 'todo',
                    action: 'delete_todo',
                    method: 'postMessage',
                    message_type: 'todos',
                  });
                  publish(todos.filter(t => t.id !== todo.id));
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            }
          >
            <Checkbox
              size="small"
              checked={todo.done}
              onChange={() => {
                track('demo_action', {
                  card: 'todo',
                  action: todo.done ? 'mark_undone' : 'mark_done',
                  method: 'postMessage',
                  message_type: 'todos',
                });
                publish(todos.map(t => (t.id === todo.id ? { ...t, done: !t.done } : t)));
              }}
              inputProps={{ 'aria-label': `Mark ${todo.text} as done` }}
            />
            <ListItemText
              primary={todo.text}
              sx={todo.done ? { textDecoration: 'line-through', color: 'text.secondary' } : {}}
            />
          </ListItem>
        ))}
      </List>
    </DemoCard>
  );
};
