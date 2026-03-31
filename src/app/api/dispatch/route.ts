import { NextRequest, NextResponse } from "next/server";
import { createJob, completeJob, failJob } from "@/lib/jobStore";
import { isValidAgent, runAgent } from "@/lib/agents";
import type { AgentId } from "@/lib/agents";

export async function POST(request: NextRequest) {
  // Auth check — skip if DISPATCH_SECRET not set (easy testing)
  const secret = process.env.DISPATCH_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: {
    agentId: string;
    mission: string;
    context?: Record<string, unknown>;
    callbackUrl?: string;
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
      { error: `Unknown agent: ${body.agentId}. Valid: oracle, preacher, onboarding, alert` },
      { status: 422 }
    );
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  createJob(jobId, body.agentId, body.mission);

  // Run async — don't block the response
  const agentId = body.agentId as AgentId;
  const { mission, context, callbackUrl } = body;

  // Use waitUntil-style: start the promise but don't await it
  const work = (async () => {
    try {
      const output = await runAgent(agentId, { mission, context });
      completeJob(jobId, output.result, output.usdcEarned);

      // POST result to callback URL if provided
      if (callbackUrl) {
        try {
          await fetch(callbackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId,
              agentId,
              result: output.result,
              usdcEarned: output.usdcEarned,
              completedAt: new Date().toISOString(),
            }),
          });
        } catch (err) {
          console.error(`[Dispatch] Callback failed for ${jobId}:`, err);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      failJob(jobId, msg);
      console.error(`[Dispatch] Agent ${agentId} failed for ${jobId}:`, msg);
    }
  })();

  // In Vercel edge/serverless, the response returns immediately.
  // The work promise continues in the background.
  // For robustness, we also catch unhandled rejections.
  work.catch(() => {});

  return NextResponse.json({ jobId, status: "accepted" }, { status: 202 });
}
