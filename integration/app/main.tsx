import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useBroadcastChannel } from '../../src';
import { OptimisticTask } from '../../examples/optimistic-task';
import { useSyncedState } from '../../src/hooks/useSyncedState';

// Recovery lab (opt-in via ?recoveryLab=1): capture the hook's channel objects
// so tests can close the held channel out of band, and let tests arm
// "born-dead" recreations. Plain specs never install this.
const heldChannels: BroadcastChannel[] = [];
let bornDead = false;
if (new URLSearchParams(window.location.search).has('recoveryLab')) {
  const RealBroadcastChannel = window.BroadcastChannel;
  class CapturingBroadcastChannel extends RealBroadcastChannel {
    constructor(name: string) {
      super(name);
      heldChannels.push(this);
      if (bornDead) this.close();
    }
  }
  window.BroadcastChannel = CapturingBroadcastChannel as typeof BroadcastChannel;
  (window as unknown as { __recoveryLab: unknown }).__recoveryLab = {
    killHeld: () => heldChannels[heldChannels.length - 1]?.close(),
    setBornDead: (value: boolean) => {
      bornDead = value;
    },
  };
}

interface AppParams {
  channel: string;
  namespace?: string;
  source?: string;
  types?: string[];
  cleaningInterval?: number;
  batchingDelayMs?: number;
  recovery?: 'manual' | 'auto';
  maxRecoveryAttempts?: number;
  recoveryLab: boolean;
}

function readParams(): AppParams {
  const params = new URLSearchParams(window.location.search);
  const types = params.get('types');
  const cleaningInterval = params.get('cleaningInterval');
  return {
    batchingDelayMs: params.has('batchingDelayMs')
      ? Number(params.get('batchingDelayMs'))
      : undefined,
    channel: params.get('channel') || 'integration-channel',
    namespace: params.get('namespace') || undefined,
    source: params.get('source') || undefined,
    types: types ? types.split(',') : undefined,
    cleaningInterval: cleaningInterval ? Number(cleaningInterval) : undefined,
    recovery: (params.get('recovery') as 'manual' | 'auto' | null) ?? undefined,
    maxRecoveryAttempts: params.has('maxRecoveryAttempts')
      ? Number(params.get('maxRecoveryAttempts'))
      : undefined,
    recoveryLab: params.has('recoveryLab'),
  };
}

function App({ source }: { source?: string } = {}) {
  const params = readParams();
  if (source !== undefined) params.source = source;
  const {
    messages,
    sentMessages,
    postMessage,
    clearReceivedMessages,
    clearSentMessages,
    ping,
    error,
    closeChannel,
    reconnect,
  } = useBroadcastChannel(params.channel, {
    sourceName: params.source,
    namespace: params.namespace,
    registeredTypes: params.types,
    cleaningInterval: params.cleaningInterval,
    batchingDelayMs: params.batchingDelayMs,
    recovery: params.recovery,
    maxRecoveryAttempts: params.maxRecoveryAttempts,
    onChannelRecovered: () => setRecoveredCount(count => count + 1),
  });

  const [messageType, setMessageType] = useState('chat');
  const [messageContent, setMessageContent] = useState('');
  const [pingSources, setPingSources] = useState<string[]>([]);
  const [recoveredCount, setRecoveredCount] = useState(0);
  const recoveryLab = (
    window as unknown as {
      __recoveryLab?: {
        killHeld: () => void;
        setBornDead: (value: boolean) => void;
      };
    }
  ).__recoveryLab;

  return (
    <div>
      <h1 data-testid="source-name">{params.source ?? 'anonymous'}</h1>
      {error ? <div data-testid="error">{error}</div> : null}
      <input
        data-testid="type-input"
        value={messageType}
        onChange={event => setMessageType(event.target.value)}
      />
      <input
        data-testid="content-input"
        value={messageContent}
        onChange={event => setMessageContent(event.target.value)}
      />
      <button data-testid="send" onClick={() => postMessage(messageType, messageContent)}>
        Send
      </button>
      {params.recoveryLab && recoveryLab ? (
        <>
          <button data-testid="kill-held-channel" onClick={() => recoveryLab.killHeld()}>
            Kill held channel
          </button>
          <button data-testid="arm-born-dead" onClick={() => recoveryLab.setBornDead(true)}>
            Arm born-dead
          </button>
          <button data-testid="heal-born-dead" onClick={() => recoveryLab.setBornDead(false)}>
            Heal born-dead
          </button>
          <button data-testid="reconnect" onClick={() => reconnect()}>
            Reconnect
          </button>
          <div data-testid="recovered-count">{recoveredCount}</div>
        </>
      ) : null}
      <button data-testid="close" onClick={closeChannel}>
        Close
      </button>
      <button
        data-testid="send-and-close"
        onClick={() => {
          postMessage(messageType, messageContent);
          closeChannel();
        }}
      >
        Send and close
      </button>
      <button
        data-testid="send-expiring"
        onClick={() => postMessage(messageType, messageContent, { expirationDuration: 300 })}
      >
        Send expiring
      </button>
      <button data-testid="clear-received" onClick={() => clearReceivedMessages()}>
        Clear received
      </button>
      <button data-testid="clear-sent-sync" onClick={() => clearSentMessages({ sync: true })}>
        Clear sent (sync)
      </button>
      <button
        data-testid="ping"
        onClick={() => {
          void ping(500).then(setPingSources);
        }}
      >
        Ping
      </button>
      <div data-testid="ping-result">{pingSources.join(',')}</div>
      <ul data-testid="received">
        {messages.map(msg => (
          <li key={msg.id}>{`${msg.source}|${msg.type}|${String(msg.message)}`}</li>
        ))}
      </ul>
      <ul data-testid="sent">
        {sentMessages.map(msg => (
          <li key={msg.id}>{`${msg.source}|${msg.type}|${String(msg.message)}`}</li>
        ))}
      </ul>
    </div>
  );
}

function DraftStateApp() {
  const params = new URLSearchParams(window.location.search);
  const [key, setKey] = useState(params.get('key') || 'filters');
  const [value, setValue, status] = useSyncedState(
    params.get('channel') || 'draft-hook',
    key,
    'fallback',
    { namespace: params.get('namespace') || '' }
  );
  const [result, setResult] = useState('');
  return (
    <div>
      <div data-testid="state-value">{value}</div>
      <input
        data-testid="state-input"
        value={value}
        onChange={event => setValue(event.target.value)}
      />
      <button data-testid="state-sync" onClick={() => void status.sync().then(setResult)}>
        Sync
      </button>
      <button data-testid="state-change-key" onClick={() => setKey('other')}>
        Change key
      </button>
      <div data-testid="state-result">{result}</div>
      <div data-testid="state-error">{status.error || ''}</div>
    </div>
  );
}
function MultiHookApp() {
  const [firstMounted, setFirstMounted] = useState(true);
  const sameSource = new URLSearchParams(window.location.search).has('sameSource');
  return (
    <div>
      <button data-testid="unmount-first" onClick={() => setFirstMounted(false)}>
        Unmount first hook
      </button>
      <section data-testid="hook-a">{firstMounted ? <App source="hook-a" /> : null}</section>
      <section data-testid="hook-b">
        <App source={sameSource ? 'hook-a' : 'hook-b'} />
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  new URLSearchParams(window.location.search).has('optimisticTask') ? (
    <OptimisticTask
      saveTask={async taskId => {
        const response = await fetch(`/api/tasks/${taskId}/complete`, { method: 'POST' });
        if (!response.ok) throw new Error('Save failed');
      }}
    />
  ) : new URLSearchParams(window.location.search).has('draftState') ? (
    <React.StrictMode>
      <DraftStateApp />
    </React.StrictMode>
  ) : new URLSearchParams(window.location.search).has('multiHook') ? (
    <MultiHookApp />
  ) : (
    <App />
  )
);
