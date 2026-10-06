import { Paper, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { CodePanel } from './CodePanel';

interface DemoCardProps {
  title: string;
  children: ReactNode;
  code?: string;
  minHeight?: number;
}

export const DemoCard = ({ title, children, code, minHeight = 260 }: DemoCardProps) => (
  <Paper
    elevation={3}
    sx={{
      p: 2.5,
      minHeight,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 1.5,
      background: 'linear-gradient(145deg, rgba(94, 193, 61, 0.08), rgba(94, 193, 61, 0.03))',
    }}
  >
    <Typography variant="h6" component="h2">
      {title}
    </Typography>
    {children}
    {code && <CodePanel code={code} />}
  </Paper>
);
