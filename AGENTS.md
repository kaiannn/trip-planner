# AGENTS.md

## Project Overview

Map-driven trip planner. User describes a trip in natural language, AI returns candidate spots, AMap geocodes them onto a map, user drags spots into daily plans. Pure frontend — no backend, all API calls (LLM + AMap) happen in the browser.

## Commands

All commands run from repo root (they delegate to `client/` via `--prefix`):

```bash
npm run dev          # Vite dev server → http://localhost:5173
npm run build        # tsc -b && vite build → client/dist/
npm run test         # vitest run (single pass)
npm run test:watch   # vitest (watch mode)
npm run lint         # eslint
```

Type check separately: `npx tsc -b` (working dir: `client/`)

**CI order** (`.github/workflows/ci.yml`): lint → typecheck → test → build. Run all four before pushing.

## Architecture

```
client/src/
├── main.tsx           # Entry point
├── App.tsx            # Root component, mounts modals + layout
├── types.ts           # Core domain types (Spot, DailyPlan, City, etc.)
├── store/             # Zustand state (persisted to localStorage)
│   ├── index.ts       # Main store combining all slices
│   ├── slices/        # ui, tripCore, ai, amapPoi, quiz
│   ├── settingsStore.ts  # Separate store for API keys (not persisted with main)
│   └── logStore.ts    # Standalone log store
├── lib/               # Pure functions (no React, no side effects)
│   ├── aiPrompt.ts    # Builds LLM prompts from trip context
│   ├── amapRouting.ts # AMap route/distance calculations
│   ├── geo.ts         # Geocoding helpers
│   └── spotKind.ts    # Spot type utilities
├── api/               # External API clients
│   ├── ai.ts          # LLM streaming (SSE) with auto-retry
│   └── amap.ts        # AMap web service calls
├── components/        # React components
│   ├── map/           # Map hooks (useAmapScript) and overlays
│   └── modals/        # All modals (Settings, SpotPool, DayPlan, etc.)
└── map/               # AMap type declarations + MapContext
```

## Key Patterns

- **Zustand slices**: Each slice exports `initial*State` + `create*Actions`. Combined in `store/index.ts` with `persist` middleware. Migration logic handles schema changes (e.g., adding `kind` field to spots).
- **Spot types**: `Spot = SightSpot | HotelSpot | RestaurantSpot` — discriminated union via `kind` field. TypeScript narrows after checking `spot.kind`.
- **Transport modes**: Per-segment overrides stored as `Record<string, TransportMode>` keyed by `"sourceId|destId"` on each DailyPlan.
- **Image storage**: Browser-side compression → IndexedDB via `idb` library. `imageBlobId` on spots references IndexedDB entries.
- **Settings**: API keys (LLM + AMap Web Service) stored in browser localStorage via `settingsStore.ts`, NOT in the main persisted store.

## Environment

Build-time env (`.env` or CI secrets):
- `VITE_AMAP_KEY` — AMap JS API Key for the map widget
- `VITE_BASE_PATH` — Base path for routing (default `/`, GitHub Pages uses `/trip-planner/`)

Runtime config (user enters in Settings modal, stored in localStorage):
- LLM API Key (DeepSeek or OpenAI-compatible)
- AMap Web Service Key (for geocoding/routing APIs)

## Deployment

- **GitHub Pages**: Auto-deploys on push to `main` via `.github/workflows/pages.yml`
- **Docker**: `docker compose up --build` → nginx on port 8080
- **Static**: `npm run build` → upload `client/dist/`

## TypeScript Config

Strict mode enabled with `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`. Remove unused imports/variables — the build will fail otherwise.

## Testing

Tests in `client/src/__tests__/`, using Vitest. Test pure functions from `lib/` — no component tests currently. Run single test file: `npx vitest run src/__tests__/aiPrompt.test.ts` (from `client/` dir).

## Gotchas

- Root `package.json` has no dependencies — all real deps are in `client/package.json`
- AMap requires both a JS API Key (build-time) AND a Web Service Key (runtime). Missing either breaks the map or geocoding.
- Zustand persist version bump requires migration logic in `store/index.ts` — check the `migrate` function when changing persisted state shape.
- Tailwind CSS v4 uses `@tailwindcss/vite` plugin, NOT PostCSS config.
- `verbatimModuleSyntax` is on — use `import type` for type-only imports.
