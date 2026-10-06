import { Box, Typography } from '@mui/material';
import type { BroadcastMessage } from 'react-broadcast-sync';

interface MessageLogProps {
  received: BroadcastMessage[];
  sent: BroadcastMessage[];
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString(undefined, { hour12: false }) +
  '.' +
  String(ts % 1000).padStart(3, '0');

/**
 * Live log of everything the channels received and sent, newest first.
 */
export const MessageLog = ({ received, sent }: MessageLogProps) => {
  const entries = [
    ...received.map(m => ({ ...m, direction: 'in' as const })),
    ...sent.map(m => ({ ...m, direction: 'out' as const })),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);

  return (
    <Box
      aria-label="Message log"
      sx={{
        fontFamily: 'monospace',
        fontSize: '0.8rem',
        maxHeight: 220,
        overflowY: 'auto',
        bgcolor: '#0D1117',
        borderRadius: 1,
        p: 1.5,
      }}
    >
      {entries.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Nothing yet. Interact with the demo - or open it in a second tab - and messages will show
          up here.
        </Typography>
      )}
      {entries.map(m => (
        <Box key={`${m.direction}-${m.id}`} sx={{ display: 'flex', gap: 1, py: 0.25 }}>
          <Box component="span" sx={{ color: m.direction === 'in' ? '#5EC13D' : '#79a7ff' }}>
            {m.direction === 'in' ? '◀ in ' : '▶ out'}
          </Box>
          <Box component="span" sx={{ color: 'text.secondary' }}>
            {formatTime(m.timestamp)}
          </Box>
          <Box component="span" sx={{ color: 'primary.main', minWidth: 90 }}>
            {m.type}
          </Box>
          <Box component="span" sx={{ color: 'text.secondary' }}>
            from {m.source}
          </Box>
          <Box
            component="span"
            sx={{
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {JSON.stringify(m.message)}
          </Box>
        </Box>
      ))}
    </Box>
  );
};
