# instant-nav rig: configurable map (apps/web)

How the instant-navigation tests in `e2e/` run. Used by the
next-cache-components-optimizer and next-partial-prefetching-optimizer skills.

- BUILD: `pnpm --filter web build:e2e` (= `EXPOSE_TESTING_API=1 NEXT_DIST_DIR=.next-e2e next build`). Prerendering calls the API, so Postgres (`pnpm db:up`) and the API (`pnpm --filter api start`, port 4000) must be running first. Output goes to `.next-e2e/` so it never touches a running `next dev` (`.next/`).
- EXPOSE: `EXPOSE_TESTING_API=1` turns on `experimental.exposeTestingApiInProductionBuild` in `next.config.ts`. Set only by `build:e2e` and the Playwright `webServer`; never in real builds.
- RUN: `pnpm --filter web test:instant`. Playwright's `webServer` starts `next start --port 3100` on the `.next-e2e` build (3100, distinct from dev on 3000) and stops it afterwards; `baseURL` is `http://localhost:3100`.
- TEST USER: none (signed out; no cookie) for the `instant()` tests. `save-publish.spec.ts` signs in with fresh usernames per run (`e2e-author-<run>`, `e2e-viewer-<run>`). State: the seeded database (dataset `landscape-trees`, system default "Tree leaf area", published sample "Tree height and crown width" by `demo`, id `019ab000-0000-7000-8000-000000000002`). Run `pnpm --filter api db:seed` before building if the sample is missing.
- DRIFT: custom configurations a developer saved locally don't change `/` (it always shows the default) and don't affect the tests, which click by exact href or by unique names. The picker's Published list is in the static shell, so a configuration published after the build only appears once its tag is expired (any Publish does that). `save-publish.spec.ts` leaves its rows in the local database. If the seeded names change, update the tests.
- CONTRACTS:
  - Initial load of `/` (`e2e/home.instant.spec.ts`): instant = `dataset-name` ("Landscape Trees") and `config-name` ("Tree leaf area"); deferred = `user-chip` (cookie), absent under the lock and visible after release.
  - Picker link `/` → `/c/[id]` (`e2e/picker-shared-config.instant.spec.ts`): source = the picker item `a[href="/c/019ab000-…-000000000002"]`, which uses `prefetch={true}` and only mounts when the picker opens (intent trigger). Prefetched = shell (`dataset-name`) plus the destination's URL-specific `config-name` ("Tree height and crown width"); the page's skeleton (`status` "Loading configuration") must be absent. Navigation-only: nothing for a published configuration. Differential: with the default `<Link>` the lock stops at the skeleton (RED at `config-name`).
  - Write path (`e2e/save-publish.spec.ts`, not `instant()`): Save as → Mine updates; Publish → the badge, Published list (for another user) and the link update. Proves the `updateTag` calls keep the cached reads fresh.
- SELECTORS: Next.js keeps the previous page mounted but hidden after a navigation, so assert with `.filter({ visible: true })` or role queries.
- LOOP: local. Build → test (webServer starts and stops the server) → edit → repeat. The agent can run the whole loop; it needs Postgres and the API running.
- LIVENESS: n/a; local build and start.
- WALLS:
  - `next build` adds `.next-e2e/types` to `tsconfig.json` `include`; that entry is committed so the build doesn't keep editing the file.
  - Port 4000 must be the API; port 3100 must be free.
