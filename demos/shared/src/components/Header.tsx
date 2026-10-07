import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { track } from '../analytics';
import { TabBadge } from './TabBadge';

interface HeaderProps {
  title: string;
  subtitle: string;
  tabName: string;
}

export const Header = ({ title, subtitle, tabName }: HeaderProps) => (
  <Box
    component="header"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 1.5,
      textAlign: 'center',
      mb: 3,
    }}
  >
    <img
      src={`${import.meta.env.BASE_URL}assets/react-broadcast-sync-logo.png`}
      alt="react-broadcast-sync logo"
      width={96}
      height="auto"
    />
    <Typography variant="h4" component="h1" fontWeight={700}>
      {title}
    </Typography>
    <Typography variant="body1" color="text.secondary" maxWidth={560}>
      {subtitle}
    </Typography>
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      <TabBadge name={tabName} />
      <Button
        variant="contained"
        size="small"
        endIcon={<OpenInNewIcon />}
        onClick={() => {
          track('demo_action', { card: 'header', action: 'open_new_tab' });
          window.open(window.location.href, '_blank', 'noopener');
        }}
        aria-label="Open this demo in a new tab to see cross-tab sync"
      >
        Open in a new tab
      </Button>
      <Tooltip title="Source on GitHub">
        <IconButton
          component="a"
          href="https://github.com/IdanShalem/react-broadcast-sync"
          target="_blank"
          rel="noopener"
          aria-label="View source on GitHub"
        >
          <GitHubIcon />
        </IconButton>
      </Tooltip>
    </Box>
  </Box>
);
