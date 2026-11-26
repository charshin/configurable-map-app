# instant-nav rig: configurable map (apps/web)

How the instant-navigation tests in `e2e/` run. Used by the
next-cache-components-optimizer and next-partial-prefetching-optimizer skills.

- BUILD: `pnpm --filter web build:e2e` (= `EXPOSE_TESTING_API=1 NEXT_DIST_DIR=.next-e2e next build`). Prerendering calls the API, so Postgres (`pnpm db:up`) and the API (`pnpm --filter api start`, port 4000) must be running first. Output goes to `.next-e2e/` so it never touches a running `next dev` (`.next/`).
- EXPOSE: `EXPOSE_TESTING_API=1` turns on `experimental.exposeTestingApiInProductionBuild` in `next.config.ts`. Set only by `build:e2e` and the Playwright `webServer`; never in real builds.
- RUN: `pnpm --filter web test:instant`. Playwright's `webServer` starts `next start --port 3100` on the `.next-e2e` build (3100, distinct from dev on 3000) and stops it afterwards; `baseURL` is `http://localhost:3100`.
- TEST USER: none (signed out; no cookie). State: the seeded database (dataset `landscape-trees`, system default "Tree leaf area").
- DRIFT: custom configurations a developer saved locally don't change `/` (it always shows the default). If the default is renamed in the seed, update the expected name in the test.
- CONTRACTS:
  - Initial load of `/` (`e2e/home.instant.spec.ts`): instant = `dataset-name` ("Landscape Trees") and `config-name` ("Tree leaf area"); deferred = `user-chip` (cookie), absent under the lock and visible after release.
- LOOP: local. Build → test (webServer starts and stops the server) → edit → repeat. The agent can run the whole loop; it needs Postgres and the API running.
- LIVENESS: n/a; local build and start.
- WALLS:
  - `next build` adds `.next-e2e/types` to `tsconfig.json` `include`; that entry is committed so the build doesn't keep editing the file.
  - Port 4000 must be the API; port 3100 must be free.
