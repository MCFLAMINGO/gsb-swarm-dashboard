# GSB Broker Swarm Management Platform

> **The control dashboard for the Agent Gas Bible ($GSB) tokenized compute bank on [Virtuals Protocol](https://app.virtuals.io/acp).**

Built with Next.js 15 · Tailwind CSS · shadcn/ui · Zustand · Recharts · TypeScript

---

## What Is This?

The GSB Swarm Dashboard lets you manage, monitor, and earn from your 4 broker agents on the Virtuals ACP network:

| Agent | Role | Price / Job |
|---|---|---|
| ⚡ GSB Compute Oracle | Quote engine — on-demand compute pricing | $0.002 |
| 📢 GSB Marketing Preacher | Growth & virality — social post automation | $0.05 |
| 🚀 GSB Onboarding Broker | New user acquisition funnel | $0.10 |
| 🔔 GSB Alert Manager | Retention & real-time alerts | $0.01 |

All agents cost **$2.99 / month** subscription via the x402 payment protocol.

---

## Features

- **Swarm Overview** — KPI tiles (total earned, active agents, pending jobs, monthly revenue) + live jobs table
- **Agents** — Per-agent config, status, simulate job button, ACP registration info
- **Earnings** — Payout history, charts (Recharts), one-click Withdraw to Base wallet
- **API Connections** — Store ACP agent IDs, Telegram token, x402 endpoint, wallet address
- **Settings** — Notifications, refresh interval, agent bulk toggle, data reset
- **Cyberpunk / Rothko dark theme** — deep black, blood red, molten orange, gold

---

## Quick Start (Local Dev)

```bash
# 1. Clone
git clone https://github.com/your-username/gsb-swarm-next.git
cd gsb-swarm-next

# 2. Install
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local with your keys (optional for local mock mode)

# 4. Run dev server
npm run dev

# Open http://localhost:3000
```

> **No server required for local dev.** All data is stored in `localStorage` using Zustand persist. You can explore the full dashboard without any API keys.

---

## Deploy to Vercel (Recommended — 3 steps)

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "initial: GSB Swarm dashboard"
git remote add origin https://github.com/YOUR_USERNAME/gsb-swarm-next.git
git push -u origin main
```

### Step 2 — Import on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository** → select your `gsb-swarm-next` repo
3. Framework: **Next.js** (auto-detected)
4. Click **Deploy** — Vercel handles the build automatically

### Step 3 — Add Environment Variables

In your Vercel project → **Settings → Environment Variables**, add:

| Variable | Value | Required? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude brain — get from [console.anthropic.com](https://console.anthropic.com) | Yes (for real agent execution) |
| `DISPATCH_SECRET` | Any random string — share with Railway CEO | Recommended |
| `RAILWAY_CEO_URL` | `https://gsb-swarm-production.up.railway.app` | Optional (for callbacks) |
| `CRON_SECRET` | Any random string — Vercel uses this to auth cron calls | Recommended |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` | Optional |
| `TELEGRAM_BOT_TOKEN` | From @BotFather — for Alert Manager to send real Telegrams | Optional |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID | Optional |

Without `ANTHROPIC_API_KEY`, agents return rule-based fallback responses (still functional for testing).

---

## API Endpoints

### POST /api/dispatch — Send a mission to an agent
```bash
curl -X POST https://your-project.vercel.app/api/dispatch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_DISPATCH_SECRET" \
  -d '{
    "agentId": "preacher",
    "mission": "Write a viral X thread about $GSB",
    "callbackUrl": "https://your-callback.com/api/brief"
  }'
# → {"jobId":"job_...","status":"accepted"}
```

### GET /api/jobs/:jobId — Poll for job result
```bash
curl https://your-project.vercel.app/api/jobs/job_123456_abc123
```

### GET /api/webhook/jobs — Last 50 completed jobs
```bash
curl https://your-project.vercel.app/api/webhook/jobs
```

### GET /api/cron/heartbeat — Hourly self-start jobs (Vercel Cron)
Runs automatically every hour. Generates: Preacher post, Alert check, Oracle cache refresh.

---

## ACP Webhook

Once deployed, configure your ACP webhook URL on Virtuals Protocol:

```
https://your-project.vercel.app/api/webhook
```

**Health check:**
```bash
curl https://your-project.vercel.app/api/webhook
# → {"status":"ok","service":"GSB Swarm ACP Webhook",...}
```

**Test POST:**
```bash
curl -X POST https://your-project.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "job.created",
    "jobId": "test_123",
    "agentId": "oracle",
    "usdcAmount": 0.002,
    "jobRef": "acp_test_ref"
  }'
```

---

## Virtuals ACP Registration

Register each agent at [app.virtuals.io/acp](https://app.virtuals.io/acp):

### ⚡ GSB Compute Oracle
- **Name:** GSB Compute Oracle
- **Description:** Real-time compute pricing oracle for the GSB tokenized compute bank. Accepts x402 micro-payments for quote requests.
- **Capabilities:** `compute-pricing`, `quote-generation`, `x402-payments`
- **Job URL:** `https://gsb.bank/x402/oracle`
- **Price:** $0.002 USDC per job

### 📢 GSB Marketing Preacher
- **Name:** GSB Marketing Preacher
- **Description:** AI-powered marketing automation for $GSB growth — posts, threads, and virality campaigns.
- **Capabilities:** `social-posting`, `thread-generation`, `growth-campaigns`
- **Job URL:** `https://gsb.bank/x402/preacher`
- **Price:** $0.05 USDC per job

### 🚀 GSB Onboarding Broker
- **Name:** GSB Onboarding Broker
- **Description:** Guided onboarding for new $GSB holders and Virtuals Protocol participants.
- **Capabilities:** `user-onboarding`, `wallet-setup-guidance`, `acp-registration`
- **Job URL:** `https://gsb.bank/x402/onboarding`
- **Price:** $0.10 USDC per job

### 🔔 GSB Alert Manager
- **Name:** GSB Alert Manager
- **Description:** Real-time alerts and retention notifications for $GSB compute bank events.
- **Capabilities:** `price-alerts`, `telegram-notifications`, `retention-triggers`
- **Job URL:** `https://gsb.bank/x402/alert`
- **Price:** $0.01 USDC per job

---

## Project Structure

```
gsb-next/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (sidebar + toaster)
│   │   ├── page.tsx                # Swarm Overview (/)
│   │   ├── agents/page.tsx         # Agents (/agents)
│   │   ├── earnings/page.tsx       # Earnings (/earnings)
│   │   ├── connections/page.tsx    # API Connections (/connections)
│   │   ├── settings/page.tsx       # Settings (/settings)
│   │   ├── globals.css             # Cyberpunk design system + CSS variables
│   │   └── api/webhook/route.ts    # ACP webhook receiver (POST /api/webhook)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx         # Collapsible sidebar nav + GSB logo
│   │   │   └── Header.tsx          # Page header with breadcrumbs
│   │   ├── dashboard/
│   │   │   ├── KpiTile.tsx         # Stat tiles (earned, agents, jobs, revenue)
│   │   │   ├── JobsTable.tsx       # ACP jobs table with live status
│   │   │   └── ActivityFeed.tsx    # Right-column event log
│   │   ├── agents/
│   │   │   └── AgentCard.tsx       # Agent card with simulate button
│   │   └── ui/                     # shadcn/ui components
│   ├── store/
│   │   └── useStore.ts             # Zustand store with localStorage persist
│   ├── types/
│   │   └── index.ts                # All TypeScript types
│   └── lib/
│       ├── mockData.ts             # Seed data for all 4 agents
│       └── utils.ts                # cn() helper
├── .env.example                    # Environment variable template
├── next.config.ts
├── tailwind.config.*
├── tsconfig.json
└── README.md
```

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 15 | App Router, SSR, API routes |
| React | 19 | UI components |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Styling |
| shadcn/ui | Latest | Component library |
| Zustand | 5 | State management + localStorage |
| Recharts | 3 | Earnings bar chart |
| sonner | 2 | Toast notifications |
| Framer Motion | 12 | Animations |
| Lucide React | Latest | Icons |
| date-fns | 4 | Date formatting |

---

## Upgrading to Real ACP Backend

When you're ready to move beyond the localStorage mock:

1. **Add a database** — Supabase (recommended) or Vercel KV for jobs + withdrawals
2. **Implement the webhook** — Uncomment the DB write in `src/app/api/webhook/route.ts`
3. **Add real-time updates** — Replace the localStorage store with TanStack Query + SSE
4. **Wire withdrawals** — Connect Base wallet via wagmi/viem for real USDC transfers
5. **Add auth** — Next-Auth or Clerk for multi-user support

---

## License

MIT — see [LICENSE](./LICENSE)

---

*Built with [Perplexity Computer](https://www.perplexity.ai/computer) · Agent Gas Bible $GSB · Virtuals Protocol ACP*
