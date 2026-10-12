import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useBroadcastChannel } from '../../src';

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
  new URLSearchParams(window.location.search).has('multiHook') ? <MultiHookApp /> : <App />
);
