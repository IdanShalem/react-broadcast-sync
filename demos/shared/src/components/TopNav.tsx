import { Box, Container, Link, Typography } from '@mui/material';
import { track } from '../analytics';

const LOGO = `${import.meta.env.BASE_URL}assets/react-broadcast-sync-logo.png`;

const navLinkSx = {
  color: '#8B949E',
  fontSize: 14,
  fontWeight: 500,
  textDecoration: 'none',
  '&:hover': { color: '#5EC13D' },
} as const;

// Site bar shared by both demos: keeps them visually inside the docs site and
// gives every visitor an obvious way back (logo -> docs home, plus Docs link).
export const TopNav = () => (
  <Box
    component="nav"
    sx={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      bgcolor: 'rgba(13, 17, 23, 0.85)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid #21262d',
    }}
  >
    <Container
      maxWidth="lg"
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}
    >
      <Link
        href="/"
        aria-label="Back to the react-broadcast-sync docs site"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          textDecoration: 'none',
          color: '#E6EDF3',
        }}
      >
        <img src={LOGO} alt="react-broadcast-sync logo" width={28} height={28} />
        <Typography component="span" fontWeight={700} fontSize={15}>
          react-broadcast-sync
        </Typography>
      </Link>
      <Box sx={{ display: 'flex', gap: 3 }}>
        <Link
          href="/getting-started/"
          sx={navLinkSx}
          onClick={() => track('demo_action', { card: 'top-nav', action: 'click_docs_link' })}
        >
          Docs
        </Link>
        <Link
          href="https://github.com/IdanShalem/react-broadcast-sync"
          target="_blank"
          rel="noopener"
          sx={navLinkSx}
        >
          GitHub
        </Link>
        <Link
          href="https://www.npmjs.com/package/react-broadcast-sync"
          target="_blank"
          rel="noopener"
          sx={navLinkSx}
        >
          npm
        </Link>
      </Box>
    </Container>
  </Box>
);
