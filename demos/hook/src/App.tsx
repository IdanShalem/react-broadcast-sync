import { Box, Container, Grid } from '@mui/material';
import { useBroadcastChannel } from 'react-broadcast-sync';
import { ConnectedTabs, DemoCard, Footer, Header, MessageLog, useTabName } from '@rbs-demos/shared';
import { CounterCard } from './components/CounterCard';
import { TextSyncCard } from './components/TextSyncCard';
import { TodoCard } from './components/TodoCard';

const OPTIONS = { namespace: 'hook-demo' } as const;

const App = () => {
  // One hook call per channel. Each tab identifies itself with a friendly
  // per-tab sourceName (2.x) so the log and ping results show WHO sent what.
  const tabName = useTabName();
  const counter = useBroadcastChannel('counter', {
    ...OPTIONS,
    keepLatestMessage: true,
    sourceName: tabName,
  });
  const text = useBroadcastChannel('text-sync', { ...OPTIONS, sourceName: tabName });
  const todo = useBroadcastChannel('todo', { ...OPTIONS, sourceName: tabName });

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '40vh',
          background: 'linear-gradient(180deg, rgba(94,193,61,0.08) 0%, #0D1117 100%)',
          zIndex: 0,
        },
      }}
    >
      <Container maxWidth="lg" sx={{ py: 3, position: 'relative', zIndex: 1 }}>
        <Header
          title="useBroadcastChannel demo"
          subtitle="Three independent channels (counter, text, todo) created with the hook. Open this page in a second tab and watch them sync."
          tabName={tabName}
        />
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={4}>
            <CounterCard messages={counter.messages} postMessage={counter.postMessage} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextSyncCard messages={text.messages} postMessage={text.postMessage} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TodoCard messages={todo.messages} postMessage={todo.postMessage} />
          </Grid>
          <Grid item xs={12} md={6}>
            <DemoCard title="Open tabs" code={PING_CODE} minHeight={180}>
              <ConnectedTabs
                ping={counter.ping}
                isPingInProgress={counter.isPingInProgress}
                selfName={tabName}
              />
            </DemoCard>
          </Grid>
          <Grid item xs={12} md={6}>
            <DemoCard title="Message log" minHeight={180}>
              <MessageLog
                received={[...counter.messages, ...text.messages, ...todo.messages]}
                sent={[...counter.sentMessages, ...text.sentMessages, ...todo.sentMessages]}
              />
            </DemoCard>
          </Grid>
        </Grid>
        <Footer />
      </Container>
    </Box>
  );
};

const PING_CODE = `const { ping, isPingInProgress } = useBroadcastChannel('counter', {
  namespace: 'hook-demo',
  sourceName: tabName, // shown to other tabs
});

// Ask every tab with this channel open to identify itself
const sources = await ping(); // e.g. ['Tab 🦊 Fox', 'Tab 🦉 Owl']`;

export default App;
