// Release guard: fail if the built bundles would ship an empty Mixpanel token.
// The token is injected at build time by @rollup/plugin-replace. This script
// guards against a publish-time build running without MIXPANEL_TOKEN in the
// environment, which previously shipped bundles with an empty token and
// silently disabled telemetry.
import { readFileSync } from 'node:fs';

const token = process.env.MIXPANEL_TOKEN ?? '';

if (!token) {
  console.error(
    'MIXPANEL_TOKEN is not set. Refusing to release: the published bundle would ship an empty telemetry token.'
  );
  process.exit(1);
}

const bundles = ['dist/index.esm.js', 'dist/index.cjs.js'];
let failed = false;

for (const file of bundles) {
  const content = readFileSync(file, 'utf8');
  if (!content.includes(token)) {
    console.error(
      `${file} does not contain the Mixpanel token. The publish-time build ran without MIXPANEL_TOKEN.`
    );
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log('Telemetry token verified in dist bundles.');
