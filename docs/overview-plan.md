# Saved map configurations: overview plan

## Context
A take-home assignment, due 27 Nov 2026 at 6pm SGT. The task is to extend the starter ArcGIS app (`src/App.tsx`, `src/configuration.ts`) so that display configurations are stored in a backend and served through an API. Each configuration covers point symbology (size and/or colour) and table columns (order and/or visibility). Required features:
- One default configuration, loaded at startup
- Users create named custom configurations, save them, and reopen them later. Edit and delete are not required.
- Users publish their configurations so others can use them

Deliverables: an architecture diagram, the code, and a README with the listed sections, including the AI disclosure. Grading covers architecture, API and data modelling, maintainability, documentation, and trade-off analysis. UI polish is not graded.

## Decisions (confirmed with the user)
- **Stack:**
  - **Frontend and BFF:** Next.js 16 (App Router, Cache Components, Partial Prefetching), Tailwind CSS, shadcn/ui on Base UI. No Route Handlers.
  - **Backend:** a dedicated **NestJS** REST API, with Prisma (`@prisma/adapter-pg`) and PostgreSQL. It's the only component that touches the database, and it owns the visibility, ownership and validation rules.
  - **Tooling:** a pnpm workspaces monorepo managed by **Turborepo**: task graph, caching, and running `dev` for all apps at once.
- **Sharing:** the owner publishes a configuration, which then appears in everyone's "Published" list. Every saved configuration also has a link that opens it directly.
- **Identity:** the user enters a username, stored in a cookie set by a Next.js Server Action. Next.js reads the cookie and forwards it to NestJS as an `X-User-Id` header on server-to-server calls. No passwords. Documented as a stand-in for SSO/JWT: Next.js would forward a token, and a NestJS guard would verify it. The extension point is marked in code.
- **Data path:** the browser only talks to Next.js. Server Components read from the NestJS API through cached functions, and Server Actions write to it, then call `updateTag`. There's no client-side data fetching, so Next.js needs no Route Handlers.

## Architecture
```
Browser ── ArcGIS map + table (client-only) ──> services.arcgis.com (data + basemap)
   │ HTML / RSC payload / Server Action calls   (the only traffic to our stack)
   ▼
Next.js (apps/web) BFF
 ├─ Server Components: reads via lib/api client, 'use cache' + cacheTag
 └─ Server Actions:    writes via lib/api client, then updateTag
   │ server-to-server HTTP: JSON + X-User-Id (from cookie)
   ▼
NestJS (apps/api)  /api/*  + OpenAPI docs at /api/docs
 ├─ DatasetsController / ConfigurationsController   (thin)
 ├─ ConfigurationsService                           (visibility, ownership, field validation)
 └─ PrismaService ──> PostgreSQL
```
- **Why a separate backend:** the brief asks for configurations to be "managed externally and retrieved through a backend API". A standalone NestJS service makes that boundary explicit, gives a real API to document (OpenAPI), and can serve other clients later.
- **Next.js as a BFF:** Next.js is a backend-for-frontend. It shapes data for the UI, caches it (`use cache`), prerenders and prefetches it, and turns UI events into API calls. Because the browser never calls NestJS directly, NestJS can sit on a private network.
- **Layering in NestJS:** thin controllers, then a service holding the rules (unit-tested without HTTP or a database), then Prisma.
- **One zod schema** in `packages/shared` defines the `Configuration` type and its validation. It's used by the web app's editor and by NestJS 12's built-in `StandardSchemaValidationPipe` (zod is a Standard Schema library, so no adapter package is needed), so both sides reject the same things. The same package exports the API DTO types used by the web app's API client.
- **Trade-offs for the README:**
  - two deployable services, so more moving parts than an all-in-Next.js app
  - an extra network hop per uncached read, mostly hidden by `use cache`
  - the BFF trusts a forwarded header (only acceptable because there's no real auth)
  - `next build` needs the API and database running, because prerendering calls the API

## Repo layout (target)
```
pnpm-workspace.yaml, turbo.json, docker-compose.yml (Postgres on host port 5433, to avoid a local Postgres on 5432), package.json (scripts call turbo)
packages/shared/                      # zod Configuration schema, DTO types, error shape
apps/api/                             # NestJS
  prisma/schema.prisma, prisma/seed.ts   # seeds the dataset + system default config
  src/prisma/prisma.service.ts
  src/common/user-id.decorator.ts        # reads X-User-Id (auth extension point)
  src/common/http-exception.filter.ts    # { error: { code, message, details? } }
  src/datasets/{module,controller,service}.ts
  src/configurations/{module,controller,service}.ts (+ *.spec.ts)
apps/web/                             # Next.js (the existing scaffold moves here)
  src/app/layout.tsx, src/app/not-found.tsx
  src/app/(workspace)/layout.tsx         # header, sidebar, map; persists across config switches
  src/app/(workspace)/page.tsx           # "/": default config (static)
  src/app/(workspace)/c/[id]/page.tsx    # one saved config (URL data, in Suspense)
  src/lib/api/*.ts                       # typed API client + cached reads ('use cache', cacheTag)
  src/lib/session.ts                     # reads the username cookie
  src/app/actions.ts                     # Server Actions: saveAs, publish, setUsername
  src/lib/configuration/apply.ts         # configure() ported from the starter
  src/components/map/*                   # ArcGIS map/table (next/dynamic ssr:false in a client file)
  src/components/workspace/*             # store, picker, editors, dialogs
```
The existing `nextjs-conf-map` scaffold moves into `apps/web`.

## Data model (Prisma, in apps/api)
`Dataset`: one row is seeded, with no switcher in the UI.
- id: a slug such as `landscape-trees`
- name
- layerUrl: the service URL plus the layer index, which uniquely identifies the layer
- popupTemplate (Json): moved out of `App.tsx`, because popups are tied to the dataset, not to a configuration

Multi-dataset support is described in the README, and the code paths are written so it's mostly additive.

`Configuration`:
- id (uuid), datasetId (FK), name
- ownerId (null for system), kind (`SYSTEM` | `CUSTOM`)
- visibility (`PRIVATE` | `PUBLISHED`), isDefault
- config (Json), schemaVersion, createdAt, publishedAt

A partial unique index enforces one default per dataset.

## API (NestJS, global prefix `/api`, OpenAPI at `/api/docs`)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/datasets/:datasetId` | name, layerUrl, popupTemplate |
| GET | `/api/datasets/:datasetId/fields` | the layer's fields, fetched from `<layerUrl>?f=json` and cached in memory; used for editor options and field validation |
| GET | `/api/datasets/:datasetId/configurations?scope=default\|published\|mine` | `mine` requires `X-User-Id` |
| GET | `/api/datasets/:datasetId/configurations/default` | the full default configuration, used on startup (lists return summaries without the `config` body) |
| GET | `/api/configurations/:id` | 404 unless the config is system, published, or owned by the `X-User-Id` caller |
| POST | `/api/datasets/:datasetId/configurations` | body `{ name, config, publish? }`; zod-validated, including that field names exist; requires `X-User-Id`; 201 |
| POST | `/api/configurations/:id/publish` | owner only, idempotent |

Errors use one JSON shape: `{ error: { code, message, details? } }`. NestJS returns 400 for validation errors, 401 when `X-User-Id` is missing where it's required, 403 when someone publishes a published or system config they don't own, 404 when a config is missing or private (including a non-owner trying to publish it), and 502 (`UPSTREAM_UNAVAILABLE`) when ArcGIS can't be reached for the field list. Colour and size fields must also be numeric.

## Frontend behaviour and starter fixes
- Load the default configuration on first start, or the one at `/c/<id>`
- Picker grouped into Default / Mine / Published
- Editor:
  - symbology: numeric-field dropdown from the server-cached field list, plus colour and size stops
  - columns: checklist with up/down reordering
- Actions: Save as… (name dialog), Publish, Copy link
- Apply configurations from an effect instead of the inline `ref` callback
- Replace the empty `UniqueValueRenderer` with a `SimpleRenderer`
- Validate field names against the dataset's field list, fetched and cached on the server. The client and server use the same check, and the client shows inline warnings.

## UI/UX (single workspace page plus dialogs)
Visual design: https://claude.ai/artifact/3bZyDH2rkk2z7wD1MbRcF8 (desktop workspace, phone, dialogs, edge states). Look: Inter, neutral ground, accent `#2F7D4F`.
- **Routes:** `/` (default) and `/c/<id>` (share link); Next.js `not-found`. A separate gallery page is out of scope and listed under Further improvements.
- **Layout:**
  - header: app name, dataset label, user chip
  - left sidebar (360px): config picker and card, tabs (Map style | Columns), footer with the unsaved-changes indicator, Reset, and Save as…
  - map: fills the remaining space, legend bottom-left
  - attribute table: resizable drawer at the bottom
- **Draft vs saved:** edits apply live as a draft. Saving always creates a new config ("Save as…"), because updating saved configs isn't required. Switching configs with unsaved edits asks to discard them first.
- **Picker:** searchable combobox grouped Default / Mine / Published by others. Badges: Default, Private 🔒, Published 🌐.
- **Map style tab:** colour and size switches; for each, a numeric-field select and a stops list (value plus hex swatch, or value plus px); gradient and size preview; validated with the shared zod schema.
- **Columns tab:** filter box; checklist (ticked = visible) sorted visible-first; reorder by drag (dnd-kit) and up/down buttons; Show all / Hide all.
- **Dialogs:**
  - Username: first visit or header chip. Browsing works without a name; saving requires one.
  - Save as…: name of 1–80 characters, optional "Publish now"
  - Publish confirmation: warns that publishing can't be undone
- **Shared link:** a banner "Viewing X shared by Y". A private or missing config falls back to the default with a warning banner. The page responds 200, because the static shell is already sent; the REST API returns 404 in both cases.
- **States:** default config loaded server-side; map skeleton while the layer loads; error toast with Retry; inline warning for unknown fields; saving disables the button.
- **Responsive and accessibility:**
  - under 768px, the sidebar becomes a slide-in panel and the table drawer starts collapsed
  - reordering works from the keyboard; colours can be typed as hex; badges use an icon plus text

## Frontend rendering plan (Cache Components + Partial Prefetching)
Based on the Next 16.4 docs in `node_modules/next/dist/docs`. `cacheComponents: true` and `partialPrefetching: true` are already set in `next.config.ts`.

**Confirmed changes:**
- The shared-link route is `/c/[id]`, not `/?config=<id>`, so `/` reads no URL data and can be fully prerendered.
- UI reads go through Server Components that call the NestJS API from cached functions. UI writes go through Server Actions that call NestJS and then `updateTag`, which gives read-your-own-writes and clears the client cache. Next.js has no Route Handlers.

**Route tree:**
```
app/layout.tsx                    static: html/body, fonts, Toaster
app/(workspace)/layout.tsx        persists across config switches, so the ArcGIS map is never recreated
  <WorkspaceProvider>             client store (below); wraps server children without making them dynamic
  Header: logo, dataset name      cached getDataset()
    <Suspense> UserChip           server: reads cookie → <UserChipClient username> shows the chip AND
                                  writes the username into the store (no invisible bridge component)
  Sidebar
    ConfigCard + Picker           client; Default and Published lists are cached props (static)
      <Suspense> MineGroup        server: cookie → cached getMyConfigs(username)
    MapStyleEditor, ColumnsEditor client; dataset fields are cached props (static), values come from the store
    Footer (unsaved, Reset, Save as…)
  MapPanel (client, next/dynamic ssr:false inside a client file) + table drawer, reading the store's draft
app/(workspace)/page.tsx          "/": <ConfigPanel configuration={cached getDefaultConfiguration()} />, fully static
app/(workspace)/c/[id]/page.tsx   <Suspense fallback={<ConfigPanelSkeleton />}><SelectedConfig params/></Suspense>
app/not-found.tsx                 static
```
**Pages render the config-specific sidebar section** (`ConfigPanel`: card, editors, footer) into the layout's `<aside>`. They pass the configuration as props, so the prerendered HTML shows real values rather than a skeleton waiting for client state. (An earlier draft used an invisible `ApplyConfig` that only wrote to the store. That would have left the editors empty in the static HTML, because the sidebar renders before the page in the tree.) On mount, `ConfigPanel` selects its configuration in the store, which the map in the layout reads. The picker stays in the layout, above `{children}`.

**Client store** (`WorkspaceProvider`, React context plus `useSyncExternalStore`; no extra library):

| Field | Meaning |
|---|---|
| `username` | `undefined` while streaming, `null` when signed out, otherwise the name; written by `UserChipClient` |
| `selected` | the selected saved configuration (`ConfigurationDto`) |
| `draft` | the `Configuration` being edited |
| `dirty` (derived) | `draft` differs from `selected.config` |

What reads `username`:
- the Save as dialog shows its name field when the user is signed out
- the picker hides your own configs from "Published by others"; until the username arrives, the group shows all of them

## Sidebar editors: data per configuration type

**Inputs shared by every configuration** are prerendered:
- the dataset's field list (name, type, alias), from cached `getDatasetFields(ds)`, which calls `GET /api/datasets/:id/fields`, with `use cache` and `max`
- numeric fields for the symbology selects

Because NestJS knows the fields, it rejects unknown field names on save. This removes the earlier "client-only field validation" trade-off.

**Values for each configuration type:**

| Selected config | Where its values come from | Static HTML? | App Shell? | `prefetch={true}`? | Card shows |
|---|---|---|---|---|---|
| Default (`/`) | `getDefaultConfig`, page segment | ✅ editor prefilled at build | ✅ | ✅ | "Default" badge · Copy link |
| Published or system (`/c/[id]`) | `getConfigById(id)`, an anonymous call that NestJS answers for public configs; no cookie read | first visit: skeleton, then streamed; static after the ISR background render | ❌ (URL data) | ✅ resolved | "by bob · Published 🌐" · Copy link |
| Private, viewer is owner | the anonymous call returns 404, then `cookies()`, then `getConfigById(id, user)`; NestJS checks ownership and returns `canPublish: true` | never (request-time hole) | ❌ | ✅ for the owner's session only | "by you · Private 🔒" · Publish · Copy link (hint: "Only you can open this link until it's published") |
| Private, viewer isn't owner, or missing | the default config is applied instead, with a warning banner | never | ❌ | ✅ (the fallback) | default card plus banner |

Rules that keep private data safe:
- Private config data only renders after the owner check, inside the cookie-gated branch. It never enters the static shell, the shared ISR page, or another session's prefetch.
- NestJS enforces access, so Next.js only ever receives a private config on a call made with the owner's `X-User-Id`. That response is cached under a key that includes the username, so it's never stored in a shared cache entry.

Editor behaviour:
- Every config type is editable as a draft; Save as always creates a new private copy owned by the editor.
- Selecting a different configuration resets the draft; re-selecting the same one keeps it.
- Map edits apply to the map live, debounced by about 150ms while typing stop values. Columns edits apply to the table live.
- On an unprefetched first visit to `/c/[id]`, the page's Suspense fallback (`ConfigPanelSkeleton`) shows until the configuration streams in.

**Columns editor:** renders all 56 fields; visible fields are ordered first.

## Client-side data fetching: not needed
- **Reads:** all backend reads happen on the Next.js server (BFF to NestJS) and arrive in the RSC payload: dataset, fields, default/published/mine lists, selected config. Prefetching and `updateTag` keep them fresh, so there's no SWR or React Query, and the browser never calls NestJS.
- **Writes:** Server Actions (Save as, Publish, set username). Each calls NestJS on the server; they're form-style calls, not data fetching.
- **Picker search:** filters the lists already on the page, on the client.
- **Data that only the browser fetches** goes to ArcGIS, not to our backend: map features and basemap tiles through the ArcGIS SDK. The optional "field range" hint uses `layer.queryFeatures` with statistics on the already-loaded layer, run when the user picks a field.
- **Not covered:** live updates when someone else publishes. New published configs show up on the next navigation or after the 5-minute stale time. This goes in Known limitations; polling or server-sent events are future work.

**Cached reads** (`apps/web/src/lib/api`; each wraps a `fetch` to NestJS; all extract-and-pass, so no `use cache: private` is needed; the username is passed as an argument and sent as `X-User-Id`):

| Function | `cacheLife` | Tags |
|---|---|---|
| `getDataset(id)` | `max` | `dataset:<id>` |
| `getDatasetFields(ds)` | `max` | `dataset:<ds>` |
| `getDefaultConfig(ds)` | `hours` | `configs:default:<ds>` |
| `getPublishedConfigs(ds)` | `hours` | `configs:published:<ds>` |
| `getMyConfigs(ds, user)` | `hours` | `configs:owner:<user>` |
| `getConfigById(id, user?)` | `max` | `config:<id>` |

- All have `stale` of at least 5 minutes, so they qualify for the App Shell.
- Saved configs are immutable, which is why `getConfigById` can use `max`.
- Cached functions return plain DTOs, not Prisma objects.

**Mutations** (Server Actions):
- Save as: `updateTag(configs:owner:<user>)`, plus the published tag if "publish now" is ticked, then `redirect('/c/<id>')`
- Publish: `updateTag(config:<id>, configs:published:<ds>)`
- Change user: set the cookie in a Server Action; the route re-renders in the same round trip

**Links:** picker items use `<Link prefetch={true}>`. They only mount while the picker is open, so this is effectively intent-based. Logo and banner links use the default `<Link>`.

## Phases
1. **Monorepo:** move the scaffold into `apps/web`; add `packages/shared` (zod schema, DTOs); docker-compose Postgres; Turborepo `turbo.json`:
   - `build`: `dependsOn: ["^build"]`; outputs `dist/**`, `.next/**` (excluding `.next/cache/**`)
   - `dev`: `persistent: true`, `cache: false`
   - `test`, `lint`, `typecheck`: `dependsOn: ["^build"]`
   - `db:generate`: runs before the api's `build` and `dev`
   - `globalEnv` / `env` set for `DATABASE_URL` and `API_URL`, so cache keys change when they do
   - The web `build` needs the API running for prerendering. Turbo can't express a runtime dependency, so the README documents `docker compose up -d && pnpm --filter api start` before `turbo build --filter=web`, and the cache for web builds stays off (`cache: false`) because their output depends on live data
2. **NestJS API:** Prisma schema, migration and seed; datasets and configurations modules; `StandardSchemaValidationPipe` with the shared zod schemas; error filter; `X-User-Id` decorator; OpenAPI; unit tests for the service rules and an e2e test with supertest
3. **Web foundation:** Tailwind and shadcn; API client and cached reads; workspace layout; map ported as client-only; `/` with the default config
4. **Web features:** picker with `/c/[id]`, editors, Save as / Publish / username Server Actions with `updateTag`, share link, banners and edge states
5. **README:** all 8 sections, Mermaid architecture diagram, link to the OpenAPI docs, AI disclosure. Add:
   - an **Optimization** section noting the Columns editor list can be virtualized (for example with `@tanstack/react-virtual`) if a dataset has many fields; 56 fields doesn't need it
   - a **Next.js as BFF** note: the browser only talks to Next.js. If client-side data fetching is ever needed (live updates, infinite lists), add Next.js Route Handlers as a BFF proxy that forwards to NestJS with the session. Don't expose NestJS to the browser directly; that would need CORS and real auth.

## Verification
- `pnpm --filter api test`: service rules (visibility, ownership, publish idempotency, field validation)
- `pnpm --filter api test:e2e`: endpoints against a separate `<db>_test` database, prepared without destructive steps (`migrate deploy`, the idempotent seed, per-test cleanup); ArcGIS is replaced with fixed fields so it runs offline
- `/api/docs` renders the OpenAPI spec
- Manual end-to-end with `docker compose up -d && pnpm --filter api prisma migrate dev && pnpm dev` (runs `turbo dev`):
  1. A fresh start loads the default
  2. As alice, save a config, reload, and reopen it at `/c/<id>`
  3. Publish it
  4. As bob, see it under Published and apply it
  5. As bob, open alice's private link: the default appears with the warning banner
- `pnpm build`, with the API running: `/` and `/c/[id]` are marked partially prerendered
- `pnpm --filter web build:e2e && pnpm --filter web test:instant`: `@next/playwright` `instant()` tests on a production build (setup in `apps/web/instant-nav.rig.md`). The direct visit to `/` must paint the header and default configuration instantly, and the cookie-dependent user chip must stream in.
