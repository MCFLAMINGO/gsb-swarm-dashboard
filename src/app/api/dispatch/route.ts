import { NextRequest, NextResponse } from "next/server";
import { isValidAgent, runAgent } from "@/lib/agents";
import type { AgentId } from "@/lib/agents";

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

  // Run synchronously — wait for result and return it directly.
  // This avoids serverless instance isolation killing async jobs.
  try {
    const output = await runAgent(agentId, { mission, context });
    return NextResponse.json({
      jobId,
      status: "completed",
      result: output.result,
      usdcEarned: output.usdcEarned,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Dispatch] Agent ${agentId} failed:`, msg);
    return NextResponse.json(
      { jobId, status: "failed", result: msg },
      { status: 500 }
    );
  }
}
