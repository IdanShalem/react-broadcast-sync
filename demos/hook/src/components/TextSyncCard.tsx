import { useEffect, useState } from 'react';
import { TextField, Typography } from '@mui/material';
import type { BroadcastActions } from 'react-broadcast-sync';
import { DemoCard, trackDebounced } from '@rbs-demos/shared';

type ChannelSlice = Pick<BroadcastActions, 'messages' | 'postMessage'>;

const CODE = `const { messages, postMessage } = useBroadcastChannel('text-sync', {
  namespace: 'hook-demo',
});

// Show what other tabs typed
useEffect(() => {
  const latest = messages[messages.length - 1];
  if (latest) {
    setValue(latest.message);
    setLastEditedBy(latest.source);
  }
}, [messages]);

// Broadcast every keystroke
postMessage('text', event.target.value);`;

export const TextSyncCard = ({ messages, postMessage }: ChannelSlice) => {
  const [value, setValue] = useState('');
  const [lastEditedBy, setLastEditedBy] = useState<string | null>(null);

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (latest && typeof latest.message === 'string') {
      setValue(latest.message);
      setLastEditedBy(latest.source);
    }
  }, [messages]);

  return (
    <DemoCard title="Text sync" code={CODE}>
      <TextField
        fullWidth
        multiline
        rows={3}
        placeholder="Type here, then watch the other tab..."
        value={value}
        onChange={e => {
          trackDebounced('text-sync', 1000, 'demo_action', {
            card: 'text-sync',
            action: 'edit_text',
            method: 'postMessage',
            message_type: 'text',
            text: e.target.value.trim().slice(0, 100),
          });
          setValue(e.target.value);
          postMessage('text', e.target.value);
        }}
        inputProps={{ 'aria-label': 'Synchronized text' }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ minHeight: 18 }}>
        {lastEditedBy ? `Last edit from ${lastEditedBy}` : ' '}
      </Typography>
    </DemoCard>
  );
};
