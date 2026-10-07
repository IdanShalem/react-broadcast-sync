import { useMemo } from 'react';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import { useBroadcastProvider } from 'react-broadcast-sync';
import { DemoCard, track } from '@rbs-demos/shared';

const REACTIONS = ['👍', '🎉', '❤️', '🚀'] as const;

const CODE = `// Same channel, different message type. No extra hook calls,
// no prop drilling - every card reads the context.
const { postMessage, messages } = useBroadcastProvider();

postMessage('reaction', '🎉');

const cheers = messages.filter(m => m.type === 'reaction').length;`;

export const ReactionCard = () => {
  const { postMessage, messages, sentMessages } = useBroadcastProvider();

  const counts = useMemo(() => {
    const tally = new Map<string, number>();
    for (const m of [...messages, ...sentMessages]) {
      if (m.type === 'reaction') {
        tally.set(m.message, (tally.get(m.message) ?? 0) + 1);
      }
    }
    return tally;
  }, [messages, sentMessages]);

  return (
    <DemoCard title="Reactions" code={CODE}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          py: 2,
          flexWrap: 'wrap',
        }}
      >
        {REACTIONS.map(emoji => (
          <Box key={emoji} sx={{ textAlign: 'center' }}>
            <Tooltip title={`Send ${emoji} to every tab`}>
              <IconButton
                onClick={() => {
                  track('demo_action', {
                    card: 'reactions',
                    action: 'send_reaction',
                    method: 'postMessage',
                    message_type: 'reaction',
                    emoji,
                  });
                  postMessage('reaction', emoji);
                }}
                aria-label={`Send reaction ${emoji}`}
                sx={{
                  fontSize: '1.8rem',
                  bgcolor: 'primary.main',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                {emoji}
              </IconButton>
            </Tooltip>
            <Typography variant="caption" display="block" color="text.secondary">
              {counts.get(emoji) ?? 0}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ textAlign: 'center', pb: 1 }}>
        <Chip size="small" label="Counts include every tab, yours and remote" variant="outlined" />
      </Box>
    </DemoCard>
  );
};
