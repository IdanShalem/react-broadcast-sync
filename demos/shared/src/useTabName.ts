import { useMemo } from 'react';

const ANIMALS = ['Fox', 'Panda', 'Owl', 'Octopus', 'Hedgehog', 'Whale', 'Parrot', 'Turtle'];

/**
 * A friendly, per-tab display name. sessionStorage is scoped to the tab, so
 * the name survives reloads in the same tab.
 *
 * This name is NOT unique: two tabs can draw the same animal, and duplicating
 * a tab clones its sessionStorage, copying the name. Never use it alone as a
 * channel `sourceName` - the hook ignores messages from its own source, so
 * tabs sharing a sourceName cannot see each other. Use `useTabSourceName`
 * for channel identity.
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

/**
 * A short id generated once per page instance, in memory only. It is never
 * persisted, so a fresh tab, a reload, or a duplicated tab (whose
 * sessionStorage is cloned) each get their own. Random ids make collisions
 * negligible at demo scale; the point is that nothing stored can copy one
 * into a second live tab.
 */
const newInstanceId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

/**
 * Channel identity (`sourceName`) for the demos: the friendly display name
 * plus a per-page-instance suffix. Keeps pings and logs readable ("who sent
 * what"). Not persisting the suffix prevents copied-storage identity reuse;
 * uniqueness otherwise rests on the random suffix, whose collision odds are
 * negligible at demo scale but not zero.
 */
export const useTabSourceName = (tabName: string): string => {
  return useMemo(() => `${tabName} #${newInstanceId()}`, [tabName]);
};
