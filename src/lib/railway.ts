/**
 * Railway backend API client
 * Connects the dashboard to live GSB swarm data at Railway.
 */

const RAILWAY_BASE = "https://gsb-swarm-production.up.railway.app";

// ── Railway operator auth ──────────────────────────────────────────────────

let cachedToken: string | null = null;

async function getRailwayToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const password = process.env.RAILWAY_OPERATOR_PASSWORD || "Erock1976";
  const res = await fetch(`${RAILWAY_BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    throw new Error(`Railway auth failed (${res.status})`);
  }
  const data = await res.json();
  cachedToken = data.token;
  return cachedToken!;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface RailwayPublicStatus {
  name: string;
  status: string;
  agentCount: number;
  message: string;
  jobsFired?: number;
  jobsCompleted?: number;
  totalEarned?: number;
}

export interface RailwayWorker {
  id: string;
  name: string;
  status: string;
  jobsCompleted?: number;
  totalEarned?: number;
  lastActiveAt?: string;
}

export interface FireJobResult {
  jobId: string;
  status: string;
  message?: string;
}

// ── Railway agent ID mapping ────────────────────────────────────────────────

export const RAILWAY_AGENT_IDS: Record<string, string> = {
  token_analyst: "token_analyst",
  wallet_profiler: "wallet_profiler",
  alpha_scanner: "alpha_scanner",
  thread_writer: "thread_writer",
};

export const DEFAULT_MISSIONS: Record<string, string> = {
  token_analyst: "Analyze $GSB token contract 0x6dA1A9793Ebe96975c240501A633ab8B3c83D14A on Base",
  wallet_profiler: "Profile wallet 0x592b6eEbd4C99b49Cf23f722E4F62FAEf4cD044d",
  alpha_scanner: "Scan for alpha signals on Base chain",
  thread_writer: "Write a thread about $GSB token performance and ACP agent earnings",
};

// ── Graduation data (hardcoded — one-time milestone) ────────────────────────

export interface GraduationTarget {
  agentId: string;
  name: string;
  completed: number;
  target: number;
  graduated: boolean;
}

export const GRADUATION_TARGETS: GraduationTarget[] = [
  { agentId: "token_analyst",   name: "Token Analyst",   completed: 9,  target: 10, graduated: false },
  { agentId: "wallet_profiler", name: "Wallet Profiler", completed: 12, target: 10, graduated: true },
  { agentId: "alpha_scanner",   name: "Alpha Scanner",   completed: 10, target: 10, graduated: true },
  { agentId: "thread_writer",   name: "Thread Writer",   completed: 10, target: 10, graduated: true },
];

// ── API calls ───────────────────────────────────────────────────────────────

export async function fetchPublicStatus(): Promise<RailwayPublicStatus | null> {
  try {
    const res = await fetch(`${RAILWAY_BASE}/api/public`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchWorkers(): Promise<RailwayWorker[]> {
  try {
    const res = await fetch(`${RAILWAY_BASE}/api/workers`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function fireJob(agentId: string, mission: string): Promise<FireJobResult> {
  const token = await getRailwayToken();
  const res = await fetch(`${RAILWAY_BASE}/api/fire-job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gsb-token": token,
    },
    body: JSON.stringify({ worker: agentId, requirement: mission, direct: true }),
  });

  if (!res.ok) {
    // If auth expired, clear cache and retry once
    if (res.status === 401) {
      cachedToken = null;
      const retryToken = await getRailwayToken();
      const retry = await fetch(`${RAILWAY_BASE}/api/fire-job`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gsb-token": retryToken,
        },
        body: JSON.stringify({ worker: agentId, requirement: mission, direct: true }),
      });
      if (!retry.ok) {
        const text = await retry.text().catch(() => "Unknown error");
        throw new Error(`Railway fire-job failed (${retry.status}): ${text}`);
      }
      return retry.json();
    }
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Railway fire-job failed (${res.status}): ${text}`);
  }

  return res.json();
}
