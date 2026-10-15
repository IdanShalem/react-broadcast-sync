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
