/** Editions are not semver ranges: v1 is a fixed, read-only 1.11.2 reconstruction. */
export const archiveRelease = '1.11.2';
export const archiveCommit = '9d1a9a92148054cd2b7073974d36069dc7f17ef5';
export const archivePages = [
  { label: 'v1 archive overview', href: '/v1/' },
  { label: 'Getting started', href: '/v1/getting-started/' },
  { label: 'Message API', href: '/v1/api/' },
  { label: 'Provider', href: '/v1/provider/' },
  { label: 'Historical telemetry', href: '/v1/telemetry/' },
];
export const isArchivePath = path => path === '/v1' || path.startsWith('/v1/');
const equivalents = [
  ['/', '/v1/'],
  ['/getting-started/', '/v1/getting-started/'],
  ['/api/use-broadcast-channel/', '/v1/api/'],
  ['/api/broadcast-actions/', '/v1/api/'],
  ['/api/types/', '/v1/api/'],
  ['/api/broadcast-provider/', '/v1/provider/'],
  ['/guides/use-the-provider/', '/v1/provider/'],
  ['/guides/telemetry/', '/v1/telemetry/'],
];
export function editionTarget(path, edition) {
  const normalized = path.endsWith('/') ? path : `${path}/`;
  const pair = equivalents.find(pair => pair[edition === 'v1' ? 0 : 1] === normalized);
  return (
    pair?.[edition === 'v1' ? 1 : 0] ??
    (edition === 'v1' ? '/v1/#no-equivalent-page' : '/getting-started/')
  );
}
