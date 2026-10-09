import { useMemo, useState } from 'react';
import { Alert, Box, Button, MenuItem, Stack, TextField } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useBroadcastProvider } from 'react-broadcast-sync';
import { DemoCard, track } from '@rbs-demos/shared';

type Severity = 'success' | 'info' | 'warning' | 'error';

interface NotificationPayload {
  text: string;
  severity: Severity;
}

const CODE = `// Any descendant can post on the shared channel
const { postMessage, messages } = useBroadcastProvider();

postMessage('notification', { text, severity: 'success' });

// Notifications arriving from other tabs land in the same messages log
const received = messages.filter(m => m.type === 'notification');`;

export const NotificationCard = () => {
  const { postMessage, messages, sentMessages } = useBroadcastProvider();
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState<Severity>('success');

  const latest = useMemo(
    () =>
      [...messages, ...sentMessages]
        .filter(m => m.type === 'notification')
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 3),
    [messages, sentMessages]
  );

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    track('demo_action', {
      card: 'notifications',
      action: 'send_notification',
      method: 'postMessage',
      message_type: 'notification',
      severity,
      text: trimmed.slice(0, 100),
    });
    postMessage('notification', { text: trimmed, severity } satisfies NotificationPayload);
    setText('');
  };

  return (
    <DemoCard title="Notifications" code={CODE}>
      <Stack spacing={1.5} sx={{ py: 1 }}>
        <TextField
          size="small"
          label="Message"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          fullWidth
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            select
            size="small"
            label="Severity"
            value={severity}
            onChange={e => {
              track('demo_action', {
                card: 'notifications',
                action: 'change_severity',
                severity: e.target.value,
              });
              setSeverity(e.target.value as Severity);
            }}
            sx={{ minWidth: 120 }}
          >
            {(['success', 'info', 'warning', 'error'] as const).map(s => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" endIcon={<SendIcon />} onClick={send} disabled={!text.trim()}>
            Broadcast
          </Button>
        </Box>
        {latest.map(m => {
          const payload = m.message as NotificationPayload;
          return (
            <Alert key={m.id} severity={payload.severity} sx={{ py: 0 }}>
              {payload.text} <small>(from {m.source})</small>
            </Alert>
          );
        })}
      </Stack>
    </DemoCard>
  );
};
