import React, { useState } from 'react';
import { useBroadcastChannel } from '../src';

type Completion = { taskId: string };

export function OptimisticTask({ saveTask }: { saveTask: (taskId: string) => Promise<void> }) {
  const taskId = 'write-docs';
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('Not saved in this tab');
  const [pending, setPending] = useState(false);
  const { postMessage, error } = useBroadcastChannel('task-intents', {
    registeredTypes: ['task-completed'],
    onMessage: {
      'task-completed': msg => {
        const payload = msg.message as Partial<Completion> | null;
        if (payload?.taskId !== taskId) return;
        setDone(true);
        // Receiving an intent does not prove that a server saved it.
        setStatus('Completion received from another connection');
      },
    },
  });

  const complete = async () => {
    setDone(true); // Optimistic local UI: the sender does not receive its own event.
    setPending(true);
    setStatus('Saving in this tab');
    postMessage('task-completed', { taskId });
    try {
      await saveTask(taskId);
      setStatus('Saved by this tab');
    } catch {
      // Keep the intent visible, but do not claim that the server accepted it.
      setStatus('Save failed: reload authoritative data before retrying');
    } finally {
      setPending(false);
    }
  };

  return (
    <section>
      <h1>Optimistic task completion</h1>
      <p>Write the docs: {done ? 'Complete' : 'Incomplete'}</p>
      <button disabled={done || pending} onClick={() => void complete()}>
        Complete task
      </button>
      <p role="status">{status}</p>
      {error && <p role="alert">Cross-tab delivery error: {error}</p>}
    </section>
  );
}
