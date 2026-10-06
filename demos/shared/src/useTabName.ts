import { useMemo } from 'react';

const ANIMALS = ['Fox', 'Panda', 'Owl', 'Octopus', 'Hedgehog', 'Whale', 'Parrot', 'Turtle'];

/**
 * A friendly, per-tab name used as the channel `sourceName`.
 * sessionStorage is scoped to the tab, so every open tab keeps its own name
 * across reloads while no two tabs share one.
 *
 * Note: keep names Latin-1 only - message IDs are btoa-encoded today and
 * non-Latin-1 characters throw (known library issue).
 */
export const useTabName = (): string => {
  return useMemo(() => {
    const stored = sessionStorage.getItem('rbs-demo-tab-name');
    if (stored) return stored;
    const name = `Tab ${ANIMALS[Math.floor(Math.random() * ANIMALS.length)]}`;
    sessionStorage.setItem('rbs-demo-tab-name', name);
    return name;
  }, []);
};
