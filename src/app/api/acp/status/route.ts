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
    virtualsId: "xgu49hcj2bszls4ld5q18x4w",
    hireUrl: "https://app.virtuals.io/acp/agents/xgu49hcj2bszls4ld5q18x4w",
  },
  {
    id: "alpha-scanner",
    name: "GSB Alpha Scanner",
    virtualsId: "sxlj5ptb50xuu1u2goe7bcai",
    hireUrl: "https://app.virtuals.io/acp/agents/sxlj5ptb50xuu1u2goe7bcai",
  },
  {
    id: "thread-writer",
    name: "GSB Thread Writer",
    virtualsId: "ueatopeufdiy9d7ucrjxmkbl",
    hireUrl: "https://app.virtuals.io/acp/agents/ueatopeufdiy9d7ucrjxmkbl",
    runtime: "vercel", // runs on dashboard after SDK breakage
  },
  {
    id: "wallet-profiler",
    name: "GSB Wallet Profiler & DCA Engine",
    virtualsId: "aq6du2zjiz9iekvewllqtn1i",
    hireUrl: "https://app.virtuals.io/acp/agents/aq6du2zjiz9iekvewllqtn1i",
  },
  {
    id: "ceo",
    name: "GSB CEO Agent",
    virtualsId: "itrtj5b95z14av53qoubqwcu",
    hireUrl: "https://app.virtuals.io/acp/agents/itrtj5b95z14av53qoubqwcu",
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
