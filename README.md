# Configurable Map

A full-stack extension of the starter ArcGIS map: display configurations (point
symbology and attribute table columns) live in a backend, and users can open
the default, save their own, and publish them for others.

- **Web:** Next.js 16 (App Router, Cache Components, Partial Prefetching), React 19, Tailwind CSS, shadcn/ui on Base UI, ArcGIS Maps SDK 5
- **API:** NestJS 12, Prisma 7, PostgreSQL 17, OpenAPI
- **Shared:** one zod schema package used by both
- **Tooling:** pnpm workspaces and Turborepo

## Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Setup](#3-setup)
4. [API documentation](#4-api-documentation)
5. [Assumptions and trade-offs](#5-assumptions-and-trade-offs)
6. [Known limitations](#6-known-limitations)
7. [Further improvements](#7-further-improvements)
8. [AI disclosure](#8-ai-disclosure)

---

## 1. Overview

### What it does

| Requirement | How it's met |
|---|---|
| Symbology: point size and/or colour | **Map style** tab: colour and size can each be switched on, driven by a numeric field with 2–8 value stops (hex colours, sizes 1–64 px). At least one must be on, and they must use different fields. |
| Attribute table: column order and/or visibility | **Columns** tab: tick to show, arrows to reorder, filter, Show all / Hide all. Reordering or hiding columns in the ArcGIS table itself syncs back. |
| A default configuration, loaded at startup | `/` shows the system default. It's prerendered, so it's in the first HTML response. |
| Custom named configurations: save and reopen | **Save as…** creates a new private configuration and opens it at its own link, `/c/<id>`. It's listed under **Mine** in the picker. Saved configurations are immutable (no update or delete). |
| Sharing | **Publish** makes a configuration public: it appears under **Published by others** for everyone. **Copy link** copies `/c/<id>`; a private link only opens for its owner (others see the default, with a notice). |

Edits apply to the map and table live, as an unsaved draft. The panel shows
**Unsaved**, **Reset** discards the draft, and switching configurations with
unsaved edits asks first. Everything is validated in the editor with the same
rules the API enforces.

**Identity** is a lightweight username (no password), chosen from the header
chip or when saving for the first time. It's a stand-in for real sign-in (see
[Assumptions](#5-assumptions-and-trade-offs)).

### Changes from the starter app

The starter (a Vite + React app with a hard-coded configuration) was ported,
with these fixes:

- **Renderer:** the starter used a `UniqueValueRenderer` with no unique values. It's now a `SimpleRenderer`, which does the same thing explicitly: every point gets the default symbol, and the visual variables do the work.
- **When the configuration applies:** `configure()` ran from an inline `ref` callback on every render. It now runs from an effect, only when the draft changes.
- **No flash of the default style:** the layer stays hidden until the first configuration is applied.
- **Popups belong to the dataset:** the popup template moved out of the component into the dataset record, because it isn't part of a configuration.

### Repository layout

```
apps/
  web/          Next.js app: the UI and the backend-for-frontend (BFF)
  api/          NestJS REST API: the only component that talks to the database
packages/
  shared/       zod schemas and types: configuration shape, API DTOs, error shape
docs/
  overview-plan.md   design notes and decisions, phase by phase
docker-compose.yml   PostgreSQL for local development
turbo.json           task graph (build order, Prisma generation, caching)
```

---

## 2. Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI["Next.js client UI<br/>(sidebar, editors, dialogs)"]
    MAP["ArcGIS map + feature table<br/>(client-only)"]
  end

  subgraph Web["apps/web: Next.js (BFF)"]
    RSC["Server Components<br/>cached reads: 'use cache' + cacheTag"]
    SA["Server Actions<br/>writes, then updateTag"]
    CLIENT["lib/api client<br/>(server-only, zod-validated)"]
  end

  subgraph Api["apps/api: NestJS"]
    CTRL["Controllers<br/>(thin; Standard Schema validation)"]
    SVC["Services<br/>(visibility, ownership, field rules)"]
    REPO["Repository + Prisma"]
  end

  DB[("PostgreSQL")]
  ARC["ArcGIS Online<br/>feature layer + basemap"]
  SHARED{{"packages/shared<br/>zod schemas"}}

  UI -- "HTML, RSC payloads,<br/>Server Action calls" --> Web
  RSC --> CLIENT
  SA --> CLIENT
  CLIENT -- "HTTP JSON + X-User-Id" --> CTRL
  CTRL --> SVC --> REPO --> DB
  SVC -- "layer field list<br/>(cached in memory)" --> ARC
  MAP -- "features, tiles" --> ARC
  SHARED -. used by .-> Web
  SHARED -. used by .-> Api
```

### Main decisions

- **A dedicated API.** The brief asks for configurations to be "managed externally and retrieved through a backend API". NestJS owns every rule (who can see what, who can publish, which fields exist), has a documented contract (OpenAPI), and could serve other clients. It's the only thing with database credentials.
- **Next.js as a backend-for-frontend.** The browser only ever talks to Next.js. Server Components read from the API through cached functions, and Server Actions write to it. So the API can sit on a private network, needs no CORS, and the browser never sees the `X-User-Id` header. There's no client-side data fetching, so Next.js needs no Route Handlers (see [Further improvements](#7-further-improvements) for when you'd add them).
- **One schema, two enforcers.** `packages/shared` defines the configuration shape and its rules with zod. The web editor validates drafts with it, the API validates requests with it (NestJS 12's built-in `StandardSchemaValidationPipe`, no adapter), and the web API client validates responses with it. The OpenAPI document is generated from the same schemas. The two sides can't drift apart silently.
- **Layered API.** Thin controllers, then services holding the rules (unit-tested without HTTP or a database), then a repository over Prisma.

### Saving a configuration

```mermaid
sequenceDiagram
  actor U as User
  participant B as Browser
  participant N as Next.js (Server Action)
  participant A as NestJS API
  participant D as PostgreSQL

  U->>B: Save as… "Tall trees"
  B->>N: saveConfiguration(form data)
  N->>N: read username cookie, validate form with shared schema
  N->>A: POST /api/datasets/landscape-trees/configurations<br/>X-User-Id: alice
  A->>A: validate body (shared schema), check fields exist and are numeric
  A->>D: INSERT configuration (PRIVATE, owner alice)
  A-->>N: 201 Configuration
  N->>N: updateTag("configurations:owner:alice")
  N-->>B: redirect to /c/<id>, with the fresh "Mine" list
```

### Data model

```mermaid
erDiagram
  datasets ||--o{ configurations : has
  datasets {
    varchar id PK "slug, e.g. landscape-trees"
    varchar name
    text layer_url "feature service URL + layer index"
    json popup_template
    timestamp created_at
  }
  configurations {
    uuid id PK "UUIDv7"
    varchar dataset_id FK
    varchar name "1-80 chars"
    varchar owner_id "username; null for SYSTEM"
    enum kind "SYSTEM | CUSTOM"
    enum visibility "PRIVATE | PUBLISHED"
    boolean is_default
    int schema_version
    json config "symbolConfig + tableConfig"
    timestamp created_at
    timestamp published_at
  }
```

- **One default per dataset:** enforced by a partial unique index on `dataset_id WHERE is_default`.
- **The database enforces consistency** with `CHECK` constraints: `owner_id` is null exactly for `SYSTEM` configurations; system configurations are always published; only a system configuration can be the default; and `published_at` is set exactly when a configuration is published.
- **Configurations are immutable.** The only change allowed is `PRIVATE → PUBLISHED`. That keeps share links stable and makes saved configurations safe to cache for a long time.
- **`config` is versioned JSON.** It holds the settings in the starter's shape: `{ symbolConfig: { color?, size? }, tableConfig: { columns } }`. `schema_version` lets the shape evolve: a v2 would add a migration from v1 when reading, instead of breaking saved rows. The extension point is marked in the service code.
- **Indexes** serve the two lists: published configurations, and a user's own, both newest first.

### Supporting more datasets

The app shows one dataset (Landscape Trees), but datasets are modelled: every
configuration belongs to a dataset, and every endpoint is scoped by dataset id.
Adding a dataset is a new `datasets` row and its default configuration. The
API derives each dataset's fields from its layer, so validation works without
changes. The web app reads its dataset id from one constant
(`apps/web/src/lib/dataset.ts`). A dataset switcher would turn that into a
route segment, such as `/d/[datasetId]`.

### Rendering and caching (web)

| What | How it renders | Cached as |
|---|---|---|
| Header, picker (Default and Published lists), map shell, dataset fields | Static: in the prerendered HTML | `getDataset`, `getDatasetFields`: `max`. Published list: `hours`, tagged. |
| `/` (default configuration) | Static, prerendered with its editors filled in | `getDefaultConfiguration`: `hours`, tagged |
| `/c/[id]` | The workspace is static; the configuration streams in behind a skeleton | `getConfiguration(id)`: `max` (configurations are immutable), tagged per id |
| User chip, picker's "Mine" group, a private configuration | Read the username cookie, so they're request-time, each behind its own `<Suspense>` | The cookie is read outside the cache, and the username passed as an argument, so cache entries are per user. A private configuration never lands in a shared entry. |

- **Server Actions write, then expire tags:** Save as expires the owner's list (and the published list if "Publish now" is ticked). Publish expires that configuration, the owner's list and the published list. `updateTag` makes the re-render in the action's response already show the change.
- **Picker items prefetch on intent.** They're `<Link prefetch={true}>`, mounted only while the picker is open, so a configuration opens instantly once you've opened the picker, without prefetching every link for every visitor.
- **Instant-navigation tests guard this.** `@next/playwright` `instant()` tests on a production build check that `/` paints the header and default configuration from the static shell, and that a picker click shows the configuration before the navigation's network round trip.
- **The map stays mounted.** The ArcGIS map and table are client-only (`next/dynamic` with `ssr: false`) and live in the workspace layout. Switching configurations restyles the existing layer instead of rebuilding the map.

---

## 3. Setup

### Prerequisites

- **Node.js** 22.12 or later
- **pnpm** 10 (`corepack enable` picks up the pinned version)
- **Docker**, for PostgreSQL

### Run it locally

```bash
pnpm install

# Environment: the defaults work as they are.
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

pnpm db:up      # PostgreSQL 17 in Docker, on host port 5433
pnpm db:setup   # generate the Prisma client, apply migrations, seed
pnpm dev        # API on :4000 and web on :3000, in watch mode
```

Then open:

- **The app:** http://localhost:3000
- **API docs (Swagger UI):** http://localhost:4000/api/docs, or the JSON at http://localhost:4000/api/docs-json
- **API health:** http://localhost:4000/api/health

The seed adds the dataset, the default configuration ("Tree leaf area"), and
one published sample ("Tree height and crown width" by `demo`), so every
picker group has something in it. Seeding is idempotent.

### Environment variables

| File | Variable | Default | Purpose |
|---|---|---|---|
| `apps/api/.env` | `PORT` | `4000` | API port |
| `apps/api/.env` | `DATABASE_URL` | `postgresql://confmap:confmap@localhost:5433/confmap?schema=public` | Database, matching `docker-compose.yml`. Set `POSTGRES_PORT` for Compose if 5433 is taken. |
| `apps/web/.env.local` | `API_URL` | `http://localhost:4000/api` | Where Next.js calls the API (server to server only) |

### Production build

Next.js prerenders pages with live data at build time, so **the API must be
running before you build the web app**:

```bash
pnpm --filter api build
pnpm --filter api start:prod          # keep it running

pnpm --filter web build               # in another terminal
pnpm --filter web start               # http://localhost:3000
```

`pnpm build` builds everything, but needs the API already running for the web
step. Turborepo can't express "this task needs a server running", so web
builds aren't cached.

### Tests

| Command | What it runs |
|---|---|
| `pnpm test` | Unit tests: shared schema rules, API services (visibility, ownership, publishing, field validation), ArcGIS field client |
| `pnpm test:e2e` | API end-to-end tests over HTTP against a separate `confmap_test` database, created and migrated automatically. ArcGIS is replaced with fixed fields, so it runs offline. |
| `pnpm --filter web build:e2e && pnpm --filter web test:instant` | Browser tests on a production build (port 3100): instant initial load of `/`, instant picker navigation, and the Save as → Publish → another user sees it flow. Needs Postgres and the API running. On first use, run `pnpm --filter web exec playwright install chromium`. |
| `pnpm typecheck`, `pnpm lint` | TypeScript and lint (ESLint for web, oxlint for API), across the repo |

`apps/web/instant-nav.rig.md` documents how the browser tests are set up.

### Troubleshooting

- **Port 5432 vs 5433:** Compose maps Postgres to 5433 so it doesn't clash with a locally installed Postgres. To use another port, set `POSTGRES_PORT` and update `DATABASE_URL`.
- **Web build fails while fetching data:** the API isn't running, or `API_URL` points somewhere else.
- **`pnpm db:setup` can't connect:** run `pnpm db:up` first, and wait for it to report healthy.

---

## 4. API documentation

The full, generated reference is the OpenAPI document at
**`/api/docs`** (Swagger UI) and **`/api/docs-json`**, generated from the shared
zod schemas. This section summarises it.

- **Base URL:** `http://localhost:4000/api`
- **Format:** JSON request and response bodies
- **Identity:** the `X-User-Id` header carries the caller's username. Endpoints that need a user respond 401 without it. Only the web app's server calls the API. With real authentication, it would forward a verified token instead (see [Assumptions](#5-assumptions-and-trade-offs)).

### Endpoints

| Method | Path | Needs `X-User-Id` | Description |
|---|---|---|---|
| GET | `/health` | | Liveness: `{ status, schemaVersion }` |
| GET | `/datasets/:datasetId` | | Dataset: name, layer URL, popup template |
| GET | `/datasets/:datasetId/fields` | | The layer's fields (`name`, `alias`, `type`, `numeric`), read from ArcGIS and cached in memory |
| GET | `/datasets/:datasetId/configurations?scope=default\|published\|mine` | for `mine` | Summaries (no `config` body), newest first (`published` lists the system default first). `mine` lists the caller's own, private and published. |
| GET | `/datasets/:datasetId/configurations/default` | | The full default configuration |
| POST | `/datasets/:datasetId/configurations` | yes | Save a new configuration. Body: `{ name, config, publish? }`. Responds 201 with the configuration. |
| GET | `/configurations/:id` | optional | One configuration, if it's published or the caller owns it |
| POST | `/configurations/:id/publish` | yes | Publish the caller's private configuration. Publishing it again is a no-op. |

A full configuration (`Configuration` in OpenAPI) has `id`, `datasetId`,
`name`, `kind`, `visibility`, `isDefault`, `ownerId`, `createdAt`,
`publishedAt`, `schemaVersion`, `config`, and `canPublish`. `canPublish` is
true when the caller owns it and it's still private.

### Validation rules

| Rule | Detail |
|---|---|
| Name | Trimmed, 1–80 characters |
| Username (`X-User-Id`) | 1–40 characters: letters, numbers, `.`, `_`, `-` |
| Colour and size | At least one is on; when both are, they use different fields; each field must be numeric |
| Stops | 2–8 per variable, values strictly increasing; colours are 6-digit hex; sizes 1–64 px |
| Columns | At least one, no duplicates, in display order |
| Fields | Every field named must exist in the dataset's layer |

### Errors

Every error has the same shape:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "…", "details": [ { "path": ["config", "tableConfig", "columns"], "message": "Show at least one column" } ] } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | The body or parameters break a rule. `details` lists each problem with its path, or names the unknown/non-numeric fields. |
| 401 | `UNAUTHENTICATED` | `X-User-Id` is missing where it's required |
| 403 | `FORBIDDEN` | Publishing a configuration you can see but don't own (published or system) |
| 404 | `NOT_FOUND` | Missing dataset or configuration, **or a private configuration that isn't yours**. Missing and private look the same, so ids can't be probed. |
| 502 | `UPSTREAM_UNAVAILABLE` | ArcGIS couldn't be reached to read the layer's fields |
| 500 | `INTERNAL` | Anything unexpected |

### Examples

```bash
# The default configuration
curl http://localhost:4000/api/datasets/landscape-trees/configurations/default

# Save a private configuration as alice
curl -X POST http://localhost:4000/api/datasets/landscape-trees/configurations \
  -H 'Content-Type: application/json' -H 'X-User-Id: alice' \
  -d '{
    "name": "Height by colour",
    "config": {
      "symbolConfig": {
        "color": { "field": "Height", "stops": [ { "value": 5, "color": "#fff3b0" }, { "value": 90, "color": "#9e2a2b" } ] }
      },
      "tableConfig": { "columns": ["Cmn_Name", "Height", "Condition"] }
    }
  }'

# Publish it (use the id from the response)
curl -X POST http://localhost:4000/api/configurations/<id>/publish -H 'X-User-Id: alice'

# Everyone's published configurations
curl 'http://localhost:4000/api/datasets/landscape-trees/configurations?scope=published'
```

---

## 5. Assumptions and trade-offs

### Assumptions

- **Identity is a username, not authentication.** The brief asks for saving and publishing per user, not for a login system. Users pick a username (stored in an HTTP-only cookie). Next.js forwards it to the API as `X-User-Id`, and the API trusts it. This is only acceptable because the API is reachable only by the web server. With SSO, Next.js would forward a token and a NestJS guard would verify it; the extension point is marked in `apps/api/src/common/user-id.decorator.ts` and `apps/web/src/lib/session.ts`.
- **Save always creates a new configuration.** Update and delete aren't required, so saved configurations are immutable and "Save as…" is the only save. That keeps share links stable: a link always shows what was shared.
- **Publishing is one-way.** There's no unpublish, so people who use a shared configuration don't lose it. The confirmation dialog says so.
- **Anyone can open a published configuration by link,** signed in or not. A private link opens only for its owner. Others get the default, with a notice. The page doesn't distinguish "private" from "doesn't exist", like the API.
- **The default configuration is managed by the system,** seeded, and read-only. Users start from it and save a copy.
- **One dataset in the UI.** The data model and API support many (see [Supporting more datasets](#supporting-more-datasets)).

### Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Separate NestJS API behind a Next.js BFF | A clear, documented boundary that owns all rules; the API can stay private; other clients could use it | Two services to run and deploy, and an extra network hop on uncached reads (mostly hidden by caching) |
| Next.js reads through `'use cache'` with tags, writes through Server Actions | Static, instant pages; read-your-own-writes after saving or publishing; no client-side fetching library | Cache invalidation is explicit, so every new write has to expire the right tags. Others with the page already open see a newly published configuration after up to 5 minutes, or on reload. |
| Prerendering with live data | `/` and the workspace arrive as static HTML, already filled in | `next build` needs the API (and database) running, so web builds can't be cached by Turborepo |
| One zod schema for editor, API and OpenAPI | The rules can't drift; one place to change them | Both apps depend on the shared package's build, which Turborepo orders |
| Configuration body stored as JSON with a version | Matches the starter's shape; flexible; one read per configuration | The database can't validate the JSON itself; validation happens on write in the API |
| Field names validated against the live ArcGIS layer | Rejects configurations that couldn't render | The API depends on ArcGIS being reachable to save (502 otherwise). Fields are cached in memory after the first read. |
| Explicit modern browser targets (`browserslist`) | ArcGIS's CSS (`light-dark()` colours) is used as shipped | No support for browsers older than Chrome/Edge 123, Firefox 120, Safari 17.5. ArcGIS SDK 5 needs current browsers anyway. |

---

## 6. Known limitations

- **No real authentication:** anyone can claim any username (see [Assumptions](#5-assumptions-and-trade-offs)).
- **No update, delete or unpublish.** Out of scope, by design.
- **Lists aren't paginated.** The published and "Mine" lists return everything, which is fine at this scale but not for thousands of configurations.
- **No live updates.** A configuration someone else publishes shows up on your next navigation or reload. If you already have the page open, it can take up to 5 minutes (the client router's stale time).
- **The layer's field list is cached in the API process for its lifetime.** A layer whose schema changes needs an API restart. A TTL would fix this.
- **One dataset in the UI** (the model and API support more).
- **Columns reorder with buttons, not drag and drop.** This works from the keyboard. (Reordering by dragging the ArcGIS table's own headers works, and syncs back.)
- **The attribute table has a fixed height** (35% of the viewport). It isn't a resizable drawer.
- **Browser support:** current Chrome, Edge, Firefox and Safari only (see the browser targets trade-off above).
- **Test runs leave data behind.** The browser test for saving and publishing creates configurations in the development database with fresh usernames (`e2e-author-…`, `e2e-viewer-…`). The API's end-to-end tests use their own database and clean up.

---

## 7. Further improvements

### Product

- **Real sign-in.** SSO or OAuth in Next.js; forward a signed token; verify it with a NestJS guard. Replace the username cookie and header.
- **Manage configurations:** rename, delete, unpublish, and version history (configurations would then need revisions, so share links keep pointing at what was shared).
- **A dataset switcher,** using the existing multi-dataset model (`/d/[datasetId]`).
- **Editor helpers:** show a field's value range (from `layer.queryFeatures` statistics) when picking stops; categorical colour by a text field; drag-and-drop column reordering (for example, dnd-kit).
- **A resizable attribute table drawer,** collapsed by default on phones.
- **Search and pagination** for the published list, and sorting by popularity.

### Optimization

- **Virtualize the Columns editor** if a dataset has many fields. It renders every field at once, which is fine for this layer (56 fields) but would get slow with hundreds. A virtualized list (for example, `@tanstack/react-virtual`) would render only the visible rows.
- **Cursor pagination** for the configuration lists, using the existing `(dataset_id, …, created_at DESC)` indexes.
- **A TTL or refresh for the cached layer fields** in the API.

### Architecture

- **Next.js Route Handlers as a BFF proxy, if client-side fetching is ever needed.** Live updates, infinite scrolling or search-as-you-type would need the browser to fetch data. Add Route Handlers in Next.js that forward to NestJS with the session, rather than exposing NestJS to the browser, which would need CORS, real authentication on every endpoint, and a public API surface. Today, nothing in the browser fetches from our stack, so there are no Route Handlers.
- **Live updates** through server-sent events or polling, if published lists need to update while the page is open.
- **Operations:** structured logging and request ids across Next.js and NestJS, metrics, rate limiting on writes, and a CI pipeline running typecheck, lint, unit, API end-to-end and browser tests.
- **Deployment:** containers for both apps, with the API on a private network that only the web app can reach, and managed PostgreSQL.

---

## 8. AI disclosure

This project was built with **Claude Code** (Anthropic's agentic coding tool),
using the **Claude Opus 5.5** model, throughout planning, implementation,
testing and documentation.

- **What the developer decided:** the requirements interpretation and every architectural choice, often by changing or rejecting the AI's proposals:
  - Next.js as the frontend and BFF, with a dedicated NestJS + Prisma + PostgreSQL backend rather than querying the database from Next.js
  - Turborepo for the monorepo; Tailwind CSS with shadcn/ui on Base UI
  - Lightweight usernames for identity; publish plus share links for sharing; modelling datasets while shipping one
  - The rendering strategy (`/c/[id]` routes, Server Components plus Server Actions, no client-side fetching)
  - The visual design direction
- **What the developer found in review:** testing the running app turned up several issues, which the AI then diagnosed and fixed:
  - a font flash (ArcGIS's stylesheet overriding the app font)
  - transparent ArcGIS panels
  - dialogs rendering under the legend
  - table column changes not syncing back to the editor
  - two missing validation rules (at least one of colour or size; different fields for each)
- **What the AI did:** proposed the plan and alternatives; wrote most of the code, the tests and this README; ran the tests, type checks and lint; and checked behaviour in a running browser and against production builds. It used project skills for Next.js (development loop, Cache Components and prefetching optimizers) and shadcn/ui.
- **How the output was checked:** unit, API end-to-end and browser tests (including instant-navigation tests whose failure modes were demonstrated by temporarily removing the optimizations they guard), review of each phase before committing, and manual testing of the running app.

The phase-by-phase plan and the decisions behind it are in
[`docs/overview-plan.md`](docs/overview-plan.md).
