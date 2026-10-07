import { Box, Link } from '@mui/material';

export const Footer = () => (
  <Box
    component="footer"
    sx={{
      mt: 4,
      py: 2,
      display: 'flex',
      gap: 3,
      justifyContent: 'center',
      borderTop: '1px solid #21262d',
    }}
  >
    <Link href="/getting-started/" underline="hover" color="text.secondary">
      Docs
    </Link>
    <Link
      href="https://github.com/IdanShalem/react-broadcast-sync"
      underline="hover"
      color="text.secondary"
    >
      GitHub
    </Link>
    <Link
      href="https://www.npmjs.com/package/react-broadcast-sync"
      underline="hover"
      color="text.secondary"
    >
      npm
    </Link>
  </Box>
);
