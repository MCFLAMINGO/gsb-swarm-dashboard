<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single Next.js 16 app (`gsb-next`), package manager is **npm** (`package-lock.json`), requires Node >= 20.9 (VM has v22). Standard commands live in `package.json`: `npm run dev` (Turbopack, http://localhost:3000), `npm run build`, `npm run lint`.

- **Runs fully offline in mock mode.** No database, Docker, or separate backend is needed for local dev — state persists via Zustand `localStorage` and an in-memory `jobStore` (`src/lib/jobStore.ts`). All external Railway/Anthropic/Telegram/X integrations are optional; the UI falls back to mock/rule-based data when their env vars are absent, so you can develop and demo every page without secrets.
- **No automated test suite.** There is no `test` script and no Jest/Vitest/Playwright config. The `/testing` page is a product feature that proxies to an external Railway Playwright worker — it is not `npm test`. Verify changes by running the dev server and exercising the UI.
- `npm run lint` currently reports pre-existing errors/warnings in committed code; treat those as baseline, not regressions from your change.
- In-memory server state (`jobStore`, webhook log) resets on server restart; simulated jobs surface on the Swarm Overview homepage KPI tiles / Recent Jobs / Activity Feed.
