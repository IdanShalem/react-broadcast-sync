import { track } from '../analytics';
import { useState } from 'react';
import { Box, Button, Chip, Typography } from '@mui/material';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';

interface ConnectedTabsProps {
  ping: (timeoutMs?: number) => Promise<string[]>;
  isPingInProgress: boolean;
  selfName: string;
}

/**
 * Uses the 2.x `ping()` API to discover which other tabs currently have this
 * channel open.
 */
export const ConnectedTabs = ({ ping, isPingInProgress, selfName }: ConnectedTabsProps) => {
  const [sources, setSources] = useState<string[] | null>(null);

  const handlePing = async () => {
    const result = await ping();
    track('demo_action', {
      card: 'open-tabs',
      action: 'ping',
      method: 'ping',
      tabs_found: result.length,
    });
    setSources(result);
  };

  return (
    <Box>
      <Button
        variant="contained"
        startIcon={<WifiTetheringIcon />}
        onClick={handlePing}
        disabled={isPingInProgress}
        aria-label="Ping the channel to find other open tabs"
      >
        {isPingInProgress ? 'Pinging...' : 'Find open tabs'}
      </Button>
      {sources !== null && (
        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Chip size="small" color="primary" label={`${selfName} (you)`} />
          {sources
            .filter((s: string) => s !== selfName)
            .map((s: string) => (
              <Chip size="small" variant="outlined" key={s} label={s} />
            ))}
          {sources.filter((s: string) => s !== selfName).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No other tabs answered. Open the demo in a second tab and ping again.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};
