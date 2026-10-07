import { useEffect, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import type { BroadcastActions } from 'react-broadcast-sync';
import { DemoCard, track } from '@rbs-demos/shared';

type ChannelSlice = Pick<BroadcastActions, 'messages' | 'postMessage'>;

const CODE = `const { messages, postMessage } = useBroadcastChannel('counter', {
  namespace: 'hook-demo',
  keepLatestMessage: true, // keep only the newest value
});

// Apply values arriving from other tabs
useEffect(() => {
  const latest = messages[messages.length - 1];
  if (latest) setCount(latest.message);
}, [messages]);

// Send the new value to every other tab
postMessage('set', count + 1);`;

export const CounterCard = ({ messages, postMessage }: ChannelSlice) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (latest && typeof latest.message === 'number') {
      setCount(latest.message);
    }
  }, [messages]);

  const update = (next: number) => {
    track('demo_action', {
      card: 'counter',
      action: next > count ? 'increment' : 'decrement',
      method: 'postMessage',
      message_type: 'set',
      value: next,
    });
    setCount(next);
    postMessage('set', next);
  };

  return (
    <DemoCard title="Counter" code={CODE}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, py: 2 }}>
        <IconButton
          onClick={() => update(count - 1)}
          aria-label="Decrement counter"
          sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
        >
          <RemoveIcon />
        </IconButton>
        <Typography variant="h3" component="div" sx={{ minWidth: 80, textAlign: 'center' }}>
          {count}
        </Typography>
        <IconButton
          onClick={() => update(count + 1)}
          aria-label="Increment counter"
          sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
        >
          <AddIcon />
        </IconButton>
      </Box>
    </DemoCard>
  );
};
