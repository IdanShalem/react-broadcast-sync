import { Box, Container, Grid } from '@mui/material';
import { BroadcastProvider, useBroadcastProvider } from 'react-broadcast-sync';
import {
  ConnectedTabs,
  DemoCard,
  Footer,
  Header,
  MessageLog,
  TopNav,
  useTabName,
  useTabSourceName,
} from '@rbs-demos/shared';
import { NotificationCard } from './components/NotificationCard';
import { ReactionCard } from './components/ReactionCard';

// One channel for the whole app: opened ONCE here and shared through context.
// Descendants consume it with useBroadcastProvider() - no prop drilling.
const ChannelInfo = () => {
  const { channelName } = useBroadcastProvider();
  return <small>channel: {channelName}</small>;
};

const DemoBody = ({ tabName }: { tabName: string }) => {
  const { messages, sentMessages, ping, isPingInProgress } = useBroadcastProvider();

  return (
    <Container maxWidth="lg" sx={{ py: 3, position: 'relative', zIndex: 1 }}>
      <Header
        title="BroadcastProvider demo"
        subtitle="One channel opened once at the top of the tree and shared with every component through context. Open this page in a second tab and watch them sync."
        tabName={tabName}
      />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <NotificationCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <ReactionCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <DemoCard title="Open tabs" code={PING_CODE} minHeight={180}>
            <ConnectedTabs ping={ping} isPingInProgress={isPingInProgress} selfName={tabName} />
          </DemoCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <DemoCard title="Message log" minHeight={180}>
            <MessageLog received={messages} sent={sentMessages} />
          </DemoCard>
        </Grid>
      </Grid>
      <Footer />
    </Container>
  );
};

const App = () => {
  const tabName = useTabName();
  // Channel identity must be unique per tab instance; the friendly tabName
  // is not (two tabs can share it), so it is only used for display.
  const tabSourceName = useTabSourceName(tabName);

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
      <TopNav />
      <BroadcastProvider
        channelName="live-feed"
        options={{
          namespace: 'provider-demo',
          sourceName: tabSourceName,
          registeredTypes: ['notification', 'reaction'],
        }}
      >
        <DemoBody tabName={tabName} />
        <Box sx={{ textAlign: 'center', pb: 2 }}>
          <ChannelInfo />
        </Box>
      </BroadcastProvider>
    </Box>
  );
};

const PING_CODE = `const { ping, isPingInProgress } = useBroadcastProvider();

// Ask every tab with this provider's channel open to identify itself
const sources = await ping(); // e.g. ['Tab Fox #1a2b3c4d', 'Tab Owl #5e6f7890']`;

export default App;
