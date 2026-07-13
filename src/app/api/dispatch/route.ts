import { NextRequest, NextResponse } from "next/server";
import { isValidAgent, runAgent } from "@/lib/agents";
import type { AgentId } from "@/lib/agents";
import { createJob, completeJob, failJob } from "@/lib/jobStore";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // No auth required — dashboard is operator-only, dispatch is internal

  let body: {
    agentId: string;
    mission: string;
    context?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.agentId || !body.mission) {
    return NextResponse.json(
      { error: "Missing required fields: agentId, mission" },
      { status: 422 }
    );
  }

  if (!isValidAgent(body.agentId)) {
    return NextResponse.json(
      { error: `Unknown agent: ${body.agentId}. Valid: oracle, preacher, onboarding, alert, token_analyst, wallet_profiler, alpha_scanner, thread_writer` },
      { status: 422 }
    );
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const agentId = body.agentId as AgentId;
  const { mission, context } = body;

  // Persist for same-instance /api/jobs lookups + results feed.
  // Still run synchronously — serverless isolation can't reliably poll across instances.
  createJob(jobId, agentId, mission);

  try {
    const output = await runAgent(agentId, { mission, context });
    completeJob(jobId, output.result, output.usdcEarned);
    return NextResponse.json({
      jobId,
      status: "completed",
      result: output.result,
      usdcEarned: output.usdcEarned,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    failJob(jobId, msg);
    console.error(`[Dispatch] Agent ${agentId} failed:`, msg);
    return NextResponse.json(
      { jobId, status: "failed", result: msg },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "GSB Swarm Dispatch",
    docs: "POST { agentId, mission, context? } → runs agent synchronously and returns { jobId, status, result, usdcEarned }",
    agents: [
      "oracle",
      "preacher",
      "onboarding",
      "alert",
      "token_analyst",
      "wallet_profiler",
      "alpha_scanner",
      "thread_writer",
    ],
  });
}
