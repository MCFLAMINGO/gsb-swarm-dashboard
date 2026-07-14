/**
 * GET /api/acp/status
 * Aggregates Railway ACP health for the marketplace dashboard.
 * Surfaces the post-SDK breakage clearly (acpReady, missing sync endpoints).
 */

import { NextResponse } from "next/server";
import { fetchAgentStatus } from "@/lib/railway";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";

const KNOWN_AGENTS = [
  {
    id: "token-analyst",
    name: "GSB Token Analyst",
    virtualsId: "019d756b-0217-7252-8094-7854afde1703",
    hireUrl: "https://app.virtuals.io/acp/agent/019d756b-0217-7252-8094-7854afde1703",
  },
  {
    id: "alpha-scanner",
    name: "GSB Alpha Scanner",
    virtualsId: "019d755e-dfd0-7b6c-8b4c-21cfbe6fda1c",
    hireUrl: "https://app.virtuals.io/acp/agent/019d755e-dfd0-7b6c-8b4c-21cfbe6fda1c",
  },
  {
    id: "thread-writer",
    name: "GSB Thread Writer",
    virtualsId: "019d7565-5b56-778e-8550-66ec4b179a81",
    hireUrl: "https://app.virtuals.io/acp/agent/019d7565-5b56-778e-8550-66ec4b179a81",
    runtime: "vercel", // runs on dashboard after SDK breakage
  },
  {
    id: "wallet-profiler",
    name: "GSB Wallet Profiler & DCA Engine",
    virtualsId: "019d756c-9eba-7600-81ba-f1c78f43277c",
    hireUrl: "https://app.virtuals.io/acp/agent/019d756c-9eba-7600-81ba-f1c78f43277c",
  },
  {
    id: "ceo",
    name: "GSB CEO Agent",
    virtualsId: "019d7568-cd41-7523-9538-e501cc1875cc",
    hireUrl: "https://app.virtuals.io/acp/agent/019d7568-cd41-7523-9538-e501cc1875cc",
  },
];

async function probe(path: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(`${RAILWAY}${path}`, {
      method: path.includes("acp-sync") ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: path.includes("acp-sync") ? JSON.stringify({ secret: "" }) : undefined,
      signal: AbortSignal.timeout(8_000),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function GET() {
  const [agentStatus, skillReport, acpSync] = await Promise.all([
    fetchAgentStatus(),
    probe("/api/skill-report"),
    probe("/api/acp-sync"),
  ]);

  const acpReady = agentStatus?.acpReady === true;
  const issues: string[] = [];

  if (!agentStatus) {
    issues.push("Railway /api/agent-status unreachable");
  } else if (!acpReady) {
    issues.push(
      "Railway acpReady=false — ACP SDK client is not connected (agents won't be discoverable/hireable via marketplace jobs)"
    );
  }
  if (!skillReport.ok) {
    issues.push(
      `Railway /api/skill-report missing (${skillReport.status || "down"}) — removed after SDK migration`
    );
  }
  if (!acpSync.ok) {
    issues.push(
      `Railway /api/acp-sync missing (${acpSync.status || "down"}) — Sync ACP button cannot re-register skills`
    );
  }

  return NextResponse.json({
    ok: true,
    acpReady,
    updatedAt: agentStatus?.updatedAt || new Date().toISOString(),
    totalJobsServed: agentStatus?.totalJobsServed ?? 0,
    workers: agentStatus?.workers || [],
    endpoints: {
      skillReport: skillReport.ok ? "ok" : "missing",
      acpSync: acpSync.ok ? "ok" : "missing",
      agentStatus: agentStatus ? "ok" : "missing",
    },
    agents: KNOWN_AGENTS,
    issues,
    remediation: [
      "Restore ACP SDK client on gsb-swarm-production until acpReady=true",
      "Re-expose /api/acp-sync and /api/skill-report OR replace with current Virtuals SDK registration flow",
      "Set env:X_API_KEY on Railway MCP (secret/tokens exist; consumer key is missing) so Thread Writer can post",
      "Thread Writer now runs on Vercel /api/dispatch — works for multi-company threads even while Railway ACP is down",
    ],
  });
}
