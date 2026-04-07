import { runOracle } from "./oracle";
import { runPreacher } from "./preacher";
import { runOnboarding } from "./onboarding";
import { runAlert } from "./alert";
import { runThreadWriter } from "./threadwriter";

// Railway ACP worker IDs — proxied to Railway fire-job
const RAILWAY_WORKER_IDS = new Set([
  "token_analyst",
  "wallet_profiler",
  "alpha_scanner",
  "thread_writer",
]);

// Map Vercel agent ID → Railway worker name
const RAILWAY_WORKER_MAP: Record<string, string> = {
  token_analyst:   "GSB Token Analyst",
  wallet_profiler: "GSB Wallet Profiler",
  alpha_scanner:   "GSB Alpha Scanner",
  thread_writer:   "GSB Thread Writer",
};

export type AgentId =
  | "oracle"
  | "preacher"
  | "onboarding"
  | "alert"
  | "thread-writer"
  | "token_analyst"
  | "wallet_profiler"
  | "alpha_scanner"
  | "thread_writer";

interface AgentInput {
  mission: string;
  context?: Record<string, unknown>;
}

interface AgentOutput {
  result: string;
  usdcEarned: number;
}

const RAILWAY_BASE = "https://gsb-swarm-production.up.railway.app";

// In-memory token cache for Railway auth (Vercel serverless — short-lived)
let _railwayToken: string | null = null;

async function getRailwayToken(): Promise<string> {
  if (_railwayToken) return _railwayToken;
  const password = process.env.DASHBOARD_PASSWORD || "Erock1976";
  const res = await fetch(`${RAILWAY_BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`Railway auth failed (${res.status})`);
  const data = (await res.json()) as { token?: string };
  _railwayToken = data.token!;
  return _railwayToken;
}

/**
 * Proxy a job to Railway /api/fire-job (direct mode — no ACP required)
 */
async function runRailwayWorker(
  agentId: string,
  input: AgentInput
): Promise<AgentOutput> {
  const workerName = RAILWAY_WORKER_MAP[agentId];
  if (!workerName) throw new Error(`Unknown Railway worker: ${agentId}`);

  const token = await getRailwayToken();
  const body = JSON.stringify({
    worker: workerName,
    requirement: input.mission,
    direct: true, // bypass ACP, use Claude directly
  });

  let res = await fetch(`${RAILWAY_BASE}/api/fire-job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gsb-token": token,
    },
    body,
  });

  // If token expired, re-auth once
  if (res.status === 401) {
    _railwayToken = null;
    const freshToken = await getRailwayToken();
    res = await fetch(`${RAILWAY_BASE}/api/fire-job`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gsb-token": freshToken,
      },
      body,
    });
  }

  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Railway worker error: ${err}`);
  }

  const data = (await res.json()) as { result?: string; error?: string };
  if (!data.result) throw new Error(data.error || "No result from Railway");

  // Rough USDC earned based on worker
  const priceMap: Record<string, number> = {
    token_analyst:  0.25,
    wallet_profiler: 0.50,
    alpha_scanner:  0.10,
    thread_writer:  0.15,
  };

  return {
    result: data.result,
    usdcEarned: priceMap[agentId] ?? 0.10,
  };
}

const vercelHandlers: Record<
  string,
  (input: AgentInput) => Promise<AgentOutput>
> = {
  oracle: runOracle,
  preacher: runPreacher,
  onboarding: runOnboarding,
  alert: runAlert,
  "thread-writer": runThreadWriter,
};

export function isValidAgent(id: string): boolean {
  return id in vercelHandlers || RAILWAY_WORKER_IDS.has(id);
}

export function runAgent(
  agentId: AgentId,
  input: AgentInput
): Promise<AgentOutput> {
  if (RAILWAY_WORKER_IDS.has(agentId)) {
    return runRailwayWorker(agentId, input);
  }
  const handler = vercelHandlers[agentId];
  if (!handler) throw new Error(`No handler for agent: ${agentId}`);
  return handler(input);
}
