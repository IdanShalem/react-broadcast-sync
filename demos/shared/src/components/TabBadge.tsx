import { Chip } from '@mui/material';

export const TabBadge = ({ name }: { name: string }) => (
  <Chip
    label={`You are: ${name}`}
    color="primary"
    variant="outlined"
    aria-label={`This tab is identified as ${name}`}
    sx={{ fontWeight: 600 }}
  />
);
