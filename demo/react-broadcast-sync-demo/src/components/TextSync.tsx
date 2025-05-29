import { Box, Typography, TextField, Paper } from '@mui/material';
import { useTextBroadcast } from '../hooks/useTextBroadcast';

export const TextSync = () => {
  const { localText, handleChange } = useTextBroadcast();

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        height: '300px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
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
        Text Synchronization
      </Typography>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          pt: 1,
          paddingTop: 0,
        }}
      >
        <TextField
          fullWidth
          value={localText}
          onChange={handleChange}
          placeholder="Type something..."
          variant="outlined"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              height: '80px',
              '& textarea': {
                height: '100% !important',
                padding: '8px 12px',
              },
            },
          }}
          multiline
          rows={3}
        />
      </Box>
    </Paper>
  );
};
