<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This is a single Next.js 16 (App Router, Turbopack) app. Package manager is **npm** (`package-lock.json`); Node 20+ works (VM has Node 22). Dependencies are refreshed automatically by the startup update script (`npm install`).

Standard commands (see `package.json` scripts):
- Dev server: `npm run dev` → http://localhost:3000 (Turbopack).
- Build: `npm run build` (succeeds). Lint: `npm run lint`.
- Note: `npm run lint` currently reports pre-existing errors/warnings in the committed code; a clean lint run is not the baseline.

Non-obvious behavior:
- The dashboard UI is fully client-side: state lives in a Zustand store persisted to `localStorage` (`src/store/useStore.ts`). No database or backend service is needed to run and browse the UI.
- Agent execution runs through `POST /api/dispatch`, which runs the agent **synchronously** and returns the result in the response. The `oracle` agent works offline using rule-based/fallback data. Other agents (`token_analyst`, `wallet_profiler`, `alpha_scanner`, and Railway-backed ones) make external network calls (Base chain data, Railway CEO service) and can hang or fail without network access / API keys.
- The GUI "Simulate Job" / "Dispatch" flows fire a request then poll `GET /api/jobs/:jobId`, but `/api/dispatch` does not persist jobs to the in-memory `jobStore` (only the cron routes call `createJob`). So the on-card job counter / modal result may not update even though the dispatch request itself succeeds. This is existing app behavior, not an environment issue.
- Optional env vars (`ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `RAILWAY_CEO_URL`, `DISPATCH_SECRET`, `CRON_SECRET`, etc.) enrich agent output; without them agents fall back to rule-based responses. None are required to run the app locally.
