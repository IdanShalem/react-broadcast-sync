import { useState } from 'react';
import { track } from '../analytics';
import { Box, Collapse, IconButton, Tooltip, Typography } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface CodePanelProps {
  code: string;
}

/**
 * "Show code" toggle revealing the snippet behind a demo card.
 */
export const CodePanel = ({ code }: CodePanelProps) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    track('demo_action', { action: 'copy_code' });
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Box sx={{ mt: 'auto', pt: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
        {open && (
          <Tooltip title={copied ? 'Copied' : 'Copy code'}>
            <IconButton size="small" onClick={copy} aria-label="Copy code snippet">
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={open ? 'Hide code' : 'Show code'}>
          <IconButton
            size="small"
            onClick={() => {
              track('demo_action', { action: open ? 'hide_code' : 'show_code' });
              setOpen(o => !o);
            }}
            aria-label={open ? 'Hide code snippet' : 'Show code snippet'}
            aria-expanded={open}
          >
            <CodeIcon fontSize="small" color={open ? 'primary' : undefined} />
          </IconButton>
        </Tooltip>
      </Box>
      <Collapse in={open}>
        <Box
          component="pre"
          sx={{
            mt: 1,
            p: 1.5,
            bgcolor: '#0D1117',
            borderRadius: 1,
            overflowX: 'auto',
            fontSize: '0.72rem',
            lineHeight: 1.5,
          }}
        >
          <Typography component="code" sx={{ fontFamily: 'monospace', fontSize: 'inherit' }}>
            {code}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
};
