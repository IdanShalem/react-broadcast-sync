import { ThemeProvider } from '@mui/material/styles';
import {
  CssBaseline,
  Container,
  Box,
  Typography,
  Grid,
  Link,
  IconButton,
  useMediaQuery,
} from '@mui/material';
import { motion } from 'framer-motion';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import CodeIcon from '@mui/icons-material/Code';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { theme } from './theme';
import { Counter } from './components/Counter';
import { TextSync } from './components/TextSync';
import { TodoList } from './components/TodoList';

const App = () => {
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '40vh',
            background: `linear-gradient(180deg, ${theme.palette.primary.main}15 0%, ${theme.palette.background.default} 100%)`,
            zIndex: 0,
          },
        }}
      >
        <Container maxWidth="lg" sx={{ flex: 1, py: 2, position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mb: { xs: 2, md: 3 },
              }}
            >
              <motion.img
                src="/assets/react-broadcast-sync-logo.png"
                alt="React Broadcast Sync Logo"
                style={{
                  width: isMobile ? '60px' : '130px',
                  height: 'auto',
                  marginBottom: '12px',
                }}
                initial={{ scale: 0, opacity: 0, y: -100 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  type: 'spring',
                  stiffness: 200,
                  damping: 15,
                }}
                whileHover={{
                  scale: 1.1,
                  filter: 'brightness(1.2)',
                  transition: {
                    type: 'spring',
                    stiffness: 400,
                    damping: 10,
                  },
                }}
              />
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <Typography
                  variant="h3"
                  component="h1"
                  align="center"
                  gutterBottom
                  sx={{
                    mb: 0.25,
                    color: 'white',
                    textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                >
                  React Broadcast Sync Demo
                </Typography>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                <Typography
                  variant="h6"
                  align="center"
                  color="text.secondary"
                  paragraph
                  sx={{ mb: 1 }}
                >
                  Real-time state synchronization across browser tabs
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ display: 'flex', alignItems: 'center' }}
                  >
                    Open a new tab to see the synchronization in action
                  </Typography>
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                    <IconButton
                      onClick={() => window.open(window.location.href, '_blank')}
                      color="primary"
                      size="small"
                    >
                      <OpenInNewIcon />
                    </IconButton>
                  </motion.div>
                </Box>
              </motion.div>
            </Box>
            <Grid container spacing={{ xs: 2, md: 3 }}>
              <Grid item xs={12} md={4}>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 20,
                    delay: 0.8,
                  }}
                  style={{ height: '100%' }}
                >
                  <Counter />
                </motion.div>
              </Grid>
              <Grid item xs={12} md={4}>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 20,
                    delay: 0.9,
                  }}
                  style={{ height: '100%' }}
                >
                  <TextSync />
                </motion.div>
              </Grid>
              <Grid item xs={12} md={4}>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 20,
                    delay: 1.0,
                  }}
                  style={{ height: '100%' }}
                >
                  <TodoList />
                </motion.div>
              </Grid>
            </Grid>
          </motion.div>
        </Container>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.2 }}
        >
          <Box
            component="footer"
            sx={{
              py: { xs: 1, md: 1.5 },
              px: { xs: 1, md: 1.5 },
              backgroundColor: 'background.paper',
              borderTop: 1,
              borderColor: 'divider',
              mt: 'auto',
            }}
          >
            <Container maxWidth="lg">
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: { xs: 1, md: 1.5 },
                }}
              >
                <Typography variant="subtitle1" color="text.secondary" gutterBottom sx={{ mb: 0 }}>
                  Connect with us
                </Typography>
                <Box sx={{ display: 'flex', gap: { xs: 1, md: 1.5 } }}>
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                    <IconButton
                      component={Link}
                      href="https://github.com/IdanShalem/react-broadcast-sync"
                      target="_blank"
                      rel="noopener noreferrer"
                      color="primary"
                      size="large"
                    >
                      <GitHubIcon fontSize="large" />
                    </IconButton>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                    <IconButton
                      component={Link}
                      href="https://www.npmjs.com/package/react-broadcast-sync"
                      target="_blank"
                      rel="noopener noreferrer"
                      color="secondary"
                      size="large"
                    >
                      <CodeIcon fontSize="large" />
                    </IconButton>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                    <IconButton
                      component={Link}
                      href="https://www.linkedin.com/in/idan-shalem-3a1781169/"
                      target="_blank"
                      rel="noopener noreferrer"
                      color="primary"
                      size="large"
                    >
                      <LinkedInIcon fontSize="large" />
                    </IconButton>
                  </motion.div>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  © {new Date().getFullYear()} Idan Shalem. All rights reserved.
                </Typography>
              </Box>
            </Container>
          </Box>
        </motion.div>
      </Box>
    </ThemeProvider>
  );
};

export default App;
