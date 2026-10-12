import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useBroadcastChannel } from '../../src';
import { useSyncedState } from '../../src/hooks/useSyncedState';

interface AppParams {
  channel: string;
  namespace?: string;
  source?: string;
  types?: string[];
  cleaningInterval?: number;
  batchingDelayMs?: number;
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
  };
}

function App() {
  const params = readParams();
  const {
    messages,
    sentMessages,
    postMessage,
    clearReceivedMessages,
    clearSentMessages,
    ping,
    error,
    closeChannel,
  } = useBroadcastChannel(params.channel, {
    sourceName: params.source,
    namespace: params.namespace,
    registeredTypes: params.types,
    cleaningInterval: params.cleaningInterval,
    batchingDelayMs: params.batchingDelayMs,
  });

  const [messageType, setMessageType] = useState('chat');
  const [messageContent, setMessageContent] = useState('');
  const [pingSources, setPingSources] = useState<string[]>([]);

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
const draft = new URLSearchParams(window.location.search).has('draftState');
createRoot(document.getElementById('root')!).render(
  draft ? (
    <React.StrictMode>
      <DraftStateApp />
    </React.StrictMode>
  ) : (
    <App />
  )
);
