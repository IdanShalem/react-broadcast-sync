/** Internal draft protocol foundation. Not a public state-sync API. */
export interface StateVersion {
  clock: number;
  source: string;
}

export const isStateVersion = (value: unknown): value is StateVersion => {
  if (!value || typeof value !== 'object') return false;
  const version = value as Partial<StateVersion>;
  return (
    Number.isSafeInteger(version.clock) &&
    (version.clock as number) >= 0 &&
    typeof version.source === 'string' &&
    version.source.length > 0
  );
};

/** Deterministic ordering independent of locale and message arrival order. */
export const compareStateVersions = (a: StateVersion, b: StateVersion): number => {
  if (a.clock !== b.clock) return a.clock < b.clock ? -1 : 1;
  return a.source === b.source ? 0 : a.source < b.source ? -1 : 1;
};

/** Return null on overflow; never silently create an invalid protocol version. */
export const nextStateClock = (local: number, observed: number): number | null => {
  if (
    !Number.isSafeInteger(local) ||
    local < 0 ||
    !Number.isSafeInteger(observed) ||
    observed < 0
  ) {
    return null;
  }
  const clock = Math.max(local, observed);
  return clock < Number.MAX_SAFE_INTEGER ? clock + 1 : null;
};
