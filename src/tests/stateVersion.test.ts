import {
  compareStateVersions,
  isStateVersion,
  nextStateClock,
  StateVersion,
} from '../utils/stateVersion';

const versions: StateVersion[] = [
  { clock: 0, source: 'tab-a' },
  { clock: 1, source: 'tab-a' },
  { clock: 1, source: 'tab-b' },
  { clock: 2, source: 'tab-a' },
  { clock: 2, source: 'טאב' },
];

it('uses clock first and source as deterministic concurrent-write tie breaker', () => {
  expect(compareStateVersions(versions[1], versions[2])).toBe(-1);
  expect(compareStateVersions(versions[2], versions[1])).toBe(1);
  expect(compareStateVersions(versions[3], versions[2])).toBe(1);
  expect(compareStateVersions(versions[2], versions[2])).toBe(0);
});

it('selects the same greatest version in every arrival order', () => {
  const permutations = (items: StateVersion[]): StateVersion[][] =>
    items.length === 0
      ? [[]]
      : items.flatMap((item, i) =>
          permutations(items.filter((_, j) => i !== j)).map(rest => [item, ...rest])
        );
  for (const order of permutations(versions)) {
    const winner = order.reduce((a, b) => (compareStateVersions(a, b) > 0 ? a : b));
    expect(winner).toEqual(versions[4]);
  }
});

it('orders transitively and antisymmetrically', () => {
  for (const a of versions)
    for (const b of versions)
      for (const c of versions) {
        expect(compareStateVersions(a, b) + compareStateVersions(b, a)).toBe(0);
        if (compareStateVersions(a, b) <= 0 && compareStateVersions(b, c) <= 0)
          expect(compareStateVersions(a, c)).toBeLessThanOrEqual(0);
      }
});

it.each([
  null,
  {},
  { clock: -1, source: 'a' },
  { clock: 0.5, source: 'a' },
  { clock: Infinity, source: 'a' },
  { clock: Number.MAX_SAFE_INTEGER + 1, source: 'a' },
  { clock: 1, source: '' },
])('rejects malformed version %p', value => {
  expect(isStateVersion(value)).toBe(false);
});

it('advances beyond local and observed clocks without overflow', () => {
  expect(isStateVersion(versions[4])).toBe(true);
  expect(nextStateClock(2, 100)).toBe(101);
  expect(nextStateClock(100, 2)).toBe(101);
  expect(nextStateClock(Number.MAX_SAFE_INTEGER, 0)).toBeNull();
  expect(nextStateClock(-1, 0)).toBeNull();
});
