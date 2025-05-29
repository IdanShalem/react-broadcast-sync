import { Box, Typography, Paper, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useCounterBroadcast } from '../hooks/useCounterBroadcast';

export const Counter = () => {
  const { count, increment, decrement } = useCounterBroadcast();

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        height: '300px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'start',
        background: 'linear-gradient(145deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05))',
      }}
    >
      <Typography
        variant="h6"
        gutterBottom
        sx={{
          color: 'white',
          textShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        Counter
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton
          onClick={decrement}
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
          }}
        >
          <RemoveIcon />
        </IconButton>
        <Typography variant="h3" component="div" sx={{ minWidth: '80px', textAlign: 'center' }}>
          {count}
        </Typography>
        <IconButton
          onClick={increment}
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
          }}
        >
          <AddIcon />
        </IconButton>
      </Box>
    </Paper>
  );
};
