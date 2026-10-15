# Major-version documentation feasibility

Checked October 15, 2026. This PR adds a v2 label/scope only, not an archive or selector.

## Current stack and real constraints

- Astro7.2.10 / Starlight0.42.5, custom Header.astro, root-absolute nav/demo links.
- starlight-versions latest registry metadata:0.10.1, Starlight peer>=0.39.0, Node>=22.12.0. Existing CI runs20.11.1. Peer range alone is not a compatibility test. Do not install it silently or claim it works here unchanged.
- Plugin authors call it early development. It archives current pages when creating a version. That cannot reconstruct a historical v1 site which never existed.
- v1.11.2 tag has README/source but no website tree. Start any v1 archive from tagged materials, remove later APIs, and test examples against that version.

## Options

1. Community plugin: lower archive-management code cost; requires verified toolchain upgrade or compatible pinned version, plus custom header integration, build/routing/search checks. No dependency change made in this spike.
2. Separate static major editions with a small custom selector: no plugin requirement, but owns routing/build/search/link maintenance. Reuse shared shell without reusing inaccurate API content.

Prefer a short isolated prototype before choosing either. Do not add an empty dropdown with just v2 or fake v3.

## Acceptance checklist for a later selector PR

- v2 default, read-only v1 warning and migration link; minimum minor-version notes retained.
- Switching versions stays on the equivalent page when it exists, otherwise lands on the target edition index with a clear explanation.
- Header, sidebar, previous/next, search, canonical/schema breadcrumbs and demos do not cross editions silently.
- Search content is edition-aware. Old examples run against the matching library version.
- No unreleased API presented as latest stable. Release-labelled configuration updates only after publication verification.
- Mobile320/390, desktop, keyboard focus and no-dead-link tests pass.

Sources:
https://starlight-versions.vercel.app/getting-started/
https://starlight-versions.vercel.app/configuration/
https://registry.npmjs.org/starlight-versions/latest
https://github.com/HiDeoo/starlight-versions

## Follow-up prototype: authentic v1 without plugin/Node upgrade

The follow-up PR uses current Starlight route middleware plus two small component overrides. It adds a fixed read-only **1.11.2** edition, not a fabricated copy of the v2 site and not coverage of every v1 minor. npm `gitHead` matches tag commit `9d1a9a92148054cd2b7073974d36069dc7f17ef5`. Original README/types/runtime/export/telemetry documents are frozen under `website/archive/v1.11.2/` with hashes. Tagged-runtime evidence corrects old README claims about clear-filter matching, deduplication and self reception.

- `/v1/` has overview, pinned-install/example, message API, provider and historical telemetry pages. Every page warns that it is a read-only snapshot. No v2 state hook or current demos masquerade as v1.
- Native details/links chooser maps real equivalents. Missing equivalents land at `/v1/#no-equivalent-page`, not a made-up page.
- Route middleware isolates v1 sidebar, previous/next, title home link and breadcrumb/schema. Astro emits edition-specific canonicals.
- Pagefind tags every indexed page with its edition. The small search dialog applies the edition filter on **every query**, not an optional checkbox; it keeps the existing query/click instrumentation selectors, Ctrl/Cmd+K and Escape. Results are page-level links/snippets. This replaces the unfiltered default search UI rather than patching its internals.
- No new package dependency, plugin, Node change or package runtime change. The search module uses native inline module loading because bundling dynamic Pagefind imports in this stack produced an unresolved Vite preload helper; the built production output is exercised, not just dev.

Reproduce from repo with existing dependencies and Chromium installed:

```bash
npm --prefix website run build
npm --prefix website run test:editions
npm --prefix website run test:v1-example
```

Build checks validate source hashes, archive warnings and version mapping. Browser checks cover 320/390/1280, keyboard switch/search/Escape, equivalent/fallback, filtered search, sidebar/pagination/canonicals/schema. The v1 example check downloads the exact npm1.11.2 tarball, verifies the pinned SHA512 integrity, runs the actual archived snippets in native tabs and tests delivery both directions, self exclusion, late-tab non-replay, provider reception and explicit telemetry opt-out. Downloaded historical code is a test fixture, never bundled into the docs site. An isolated npm fixture avoids adding a second library version to runtime/dev dependencies.

Remaining limits: no archived runnable demo, no automatic archive creation for future majors, no claim of support for all old minors, no legal revalidation of the historical telemetry notice. Fixed archive source links and current-edition migration links are intentionally different audiences, labelled in the page.
