# AGENTS.md

Map-driven trip planner + cycling route book. Pure frontend: LLM and AMap calls run in the browser. User-facing docs live in `README.md`.

## Commands

From repo root (all delegate to `client/`):

```bash
npm run dev       # Vite → http://localhost:5173
npm run build     # tsc -b && vite build → client/dist/
npm run test      # vitest run
npm run lint      # eslint
npm run preview   # vite preview
```

Watch mode / single file (workdir `client/`):

```bash
npm run test:watch
npx vitest run src/__tests__/aiPrompt.test.ts
npx tsc -b
```

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build. Match that before push.

## Layout

```
client/src/
├── App.tsx                 # Map layout + modals; seeds webservice key from env
├── types.ts                # Spot / DailyPlan / City …
├── store/                  # Zustand persist (localStorage)
│   ├── index.ts            # slices + migrate
│   ├── slices/             # tripCore, ai, amapPoi, ui, quiz
│   ├── settingsStore.ts    # LLM + AMap webservice keys (not in trip persist)
│   ├── logStore.ts
│   └── utils.ts            # POI convert, photo enrich/backfill
├── lib/
│   ├── amapKey.ts          # ONLY place that reads AMap keys — use this
│   ├── aiPrompt.ts / amapRouting.ts / geo.ts / spotKind.ts / …
├── api/                    # ai.ts (SSE), amap.ts (restapi)
├── cycling/                # standalone route-book module + own store
├── components/             # layout/, map/, modals/, pool/, timeline/
├── hooks/                  # useTripData, useMapRoutes, usePanelSize
└── map/                    # AMap types + MapContext
```

## Key patterns

**AMap keys** (`lib/amapKey.ts`):

- JS / Web端 → `VITE_AMAP_KEY` (+ optional `VITE_AMAP_SECURITY_CODE`) → `webapi.amap.com` map SDK only
- Web服务 → settings `amapWebServiceKey` **or** `VITE_AMAP_WEBSERVICE_KEY` → `restapi.amap.com` (POI / routing / photos / cycling)
- **Never** fall back webservice → JS key (`USERKEY_PLAT_NOMATCH`)
- `seedWebServiceKeyFromEnv()` on app boot if settings empty
- Pages build injects all three via GitHub Secrets; do not commit key plaintext

**Spots**: `Spot = Sight | Hotel | Restaurant` via `kind`. `imageUrl` / `amapId` from AMap; `imageBlobId` → IndexedDB (`idb`). Photo URLs forced to `https` in `api/amap.ts`.

**Transport**: per-segment mode on each `DailyPlan` as `Record<"sourceId|destId", TransportMode>`.

**Demo trips**: `dataSource: 'empty' | 'demo' | 'user'` in `tripCore`. Triple-click header title loads demo; edits promote to `user`.

**Cycling route book**: `cycling/store.ts` (separate persist key). `avgSpeedKmh` input uses draft string; clamp on blur only — do not clamp every keystroke.

**Zustand**: slices export `initial*State` + `create*Actions`; persist `migrate` in `store/index.ts` when shape changes.

## Env

`client/.env` (gitignored; copy from `client/.env.example`):

| Var | Role |
|-----|------|
| `VITE_AMAP_KEY` | Map JS SDK |
| `VITE_AMAP_SECURITY_CODE` | JS key security code (required for keys created after 2021-12 if console enabled it) |
| `VITE_AMAP_WEBSERVICE_KEY` | Optional build-time webservice key |
| `VITE_BASE_PATH` | Asset base; Pages uses `/trip-planner/` |

Runtime in Settings modal → localStorage: LLM key/baseUrl/model, AMap webservice key.

## TypeScript / lint

- Strict + `noUnusedLocals` + `noUnusedParameters` + `erasableSyntaxOnly` + `verbatimModuleSyntax`
- Type-only imports: `import type { … }`
- Unused imports fail `tsc -b` / build
- Tailwind v4: `@tailwindcss/vite` plugin — no PostCSS config for Tailwind
- Preserve Chinese comments

## Tests

`client/src/__tests__/` — Vitest, pure logic (lib + store utils + cycling + amapKey/photo). No React component tests. ~77 tests currently.

## Deploy (for agents)

- Pages: push `main` → `pages.yml`; secrets `VITE_AMAP_KEY`, `VITE_AMAP_SECURITY_CODE`, `VITE_AMAP_WEBSERVICE_KEY`
- Docker: `docker compose up --build` (needs `VITE_AMAP_KEY` build arg) → :8080
- Root `package.json` has scripts only; deps live in `client/package.json`
