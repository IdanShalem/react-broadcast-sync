# AGENTS.md

React hook library (`react-broadcast-sync`) for cross-tab messaging via BroadcastChannel.

## Commands
- Install: `npm ci`
- Unit tests (Jest + jsdom): `npm test`
- Lint: `npm run lint`
- Build: `npm run build`
- Cross-tab integration tests (Playwright): see "Running This Repository's Test Suites" in README.md

## Conventions
- Conventional Commits (`fix:`, `feat:`, `docs:`). Releases are automated by semantic-release in CI; never bump versions or publish manually.
- Source is in `src/`; hook logic is in `src/hooks/useBroadcastChannel.ts`.
- When changing option names or defaults, update `src/types/types.ts`, the README options table and `context7.json` rules together.
- Do not enable telemetry in tests; do not commit tokens.
