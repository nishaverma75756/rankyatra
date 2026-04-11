# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (port from $PORT)
│   ├── rankyatra/          # React+Vite web app (preview path: /)
│   └── rankyatra-mobile/   # Expo mobile app (preview path: /mobile/)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks + setBaseUrl/setAuthTokenGetter/customFetch
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### Object Storage (Replit App Storage)

Profile photo upload uses Replit's GCS-backed object storage:
- `PRIVATE_OBJECT_DIR` format: `/bucket-name/.private` (NOT `gs://` prefix)
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` = the GCS bucket name
- Avatar files stored at: `<basePath>/avatars/<uuid>.<ext>`
- Served via: `GET /api/storage/avatars/:filename`
- Avatar URL stored in DB: `/api/storage/avatars/<filename>` (relative, prepend base URL for mobile)
- Upload route: `POST /api/me/avatar` (multipart/form-data, field name `avatar`, max 5MB)
- Uses `multer` (memory storage) + `@google-cloud/storage` for direct server-side GCS upload
- Key packages in api-server: `multer`, `@types/multer`, `@google-cloud/storage`, `google-auth-library`

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

---

## Important Project Info (RankYatra)

### EC2 / Production Details

| Item | Value |
|---|---|
| EC2 API Port | `8080` |
| Production URL | `https://rankyatra.in` |
| OAuth Callback | `https://rankyatra.niskutech.com` |
| DB Name (EC2) | `rankyatradb` |
| DB User (EC2) | `rankyatra` |
| DB Pass (EC2) | `StrongPass123` |
| Expo Project ID | `a04e437e-68e7-40e6-871c-15c6a209f2f3` |
| Expo Owner | `kundan7781` |
| Android Package | `com.kundan7781.rankyatra` |
| PM2 App Name | `rankyatra-api` |

### EC2 Deploy Commands

```bash
# Deploy karna
cd ~/rankyatra && git pull origin main && setsid bash deploy.sh > deploy.log 2>&1 &

# Deploy log check
tail -f ~/rankyatra/deploy.log

# Deploy status
pm2 status
pm2 logs rankyatra-api --lines 50
```

### Android APK Build (Expo)

- expo.dev pe login karo — Account: `kundan7781`
- Project `rankyatra` open karo → Builds → New Build → Android → profile: `preview`
- Ya command se: `npx eas-cli build --platform android --profile preview --non-interactive`

### Mobile App Important Rules

- **NEVER** use `Alert.alert()` — hamesha `showAlert/showConfirm/showError` use karo (`@/utils/alert` se)
- Brand color: `#f97316` (orange)
- `users` table mein `rank_points` column NAHI hai
- Middleware path: `../middlewares/auth` (with 's')
- Backend body limit: 50MB
- Video storage: base64 data URL directly `video_url` column mein

### Workflows (Replit)

| Workflow Name | Command | Port |
|---|---|---|
| `artifacts/rankyatra: web` | `PORT=25864 pnpm --filter @workspace/rankyatra run dev` | 25864 |
| `artifacts/rankyatra-mobile: expo` | `PORT=25638 pnpm --filter @workspace/rankyatra-mobile run dev` | 25638 |
| `artifacts/api-server: API Server` | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 |

### Database Restore (naye Replit pe)

```bash
psql $DATABASE_URL < backups/rankyatra_full_backup_20260409.sql
```
