/**
 * GSB Swarm — ACP Webhook Receiver
 *
 * POST /api/webhook  — receive ACP job events; on job.created run the agent
 * GET  /api/webhook  — health check
 */

import { NextRequest, NextResponse } from "next/server";
import { isValidAgent, runAgent, type AgentId } from "@/lib/agents";
import { createJob, completeJob, failJob } from "@/lib/jobStore";

export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────
interface AcpWebhookPayload {
  event: string;
  jobId: string;
  agentId: string;
  jobRef?: string;
  usdcAmount?: number;
  mission?: string;
  requirement?: string;
  prompt?: string;
  metadata?: Record<string, unknown>;
  context?: Record<string, unknown>;
  callbackUrl?: string;
  timestamp?: string;
}

interface WebhookLogEntry {
  jobId: string;
  agentId: string;
  event: string;
  usdcAmount?: number;
  receivedAt: string;
  status?: string;
  resultPreview?: string;
  payload: AcpWebhookPayload;
}

// ── In-memory job log ─────────────────────────────────────────────────────────
const webhookLog: WebhookLogEntry[] = [];
const MAX_LOG = 200;

export function getWebhookLog(n: number): WebhookLogEntry[] {
  return webhookLog.slice(-n).reverse();
}

function pushLog(entry: WebhookLogEntry) {
  webhookLog.push(entry);
  if (webhookLog.length > MAX_LOG) {
    webhookLog.splice(0, webhookLog.length - MAX_LOG);
  }
}

function extractMission(body: AcpWebhookPayload): string {
  const fromMeta =
    typeof body.metadata?.mission === "string"
      ? body.metadata.mission
      : typeof body.metadata?.requirement === "string"
        ? body.metadata.requirement
        : null;
  return (
    body.mission ||
    body.requirement ||
    body.prompt ||
    fromMeta ||
    `ACP job ${body.jobId} for agent ${body.agentId}`
  );
}

async function maybeCallback(
  callbackUrl: string | undefined,
  payload: Record<string, unknown>
) {
  if (!callbackUrl) return;
  try {
    await fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.warn("[GSB Webhook] callback failed:", err);
  }
}

// ── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let body: AcpWebhookPayload;
  try {
    body = (await request.json()) as AcpWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.jobId || !body.agentId || !body.event) {
    return NextResponse.json(
      { error: "Missing required fields: jobId, agentId, event" },
      { status: 422 }
    );
  }

  const receivedAt = new Date().toISOString();
  const shouldRun =
    body.event === "job.created" ||
    body.event === "job.started" ||
    body.event === "job.request";

  // Map common ACP aliases / Virtuals UUIDs → local agent ids
  const agentAlias: Record<string, string> = {
    "gsb-compute-oracle": "oracle",
    "gsb-marketing-preacher": "preacher",
    "gsb-onboarding-broker": "onboarding",
    "gsb-alert-manager": "alert",
    "compute-oracle": "oracle",
    "marketing-preacher": "preacher",
    "onboarding-broker": "onboarding",
    "alert-manager": "alert",
    // Railway / marketplace agents
    "thread_writer": "thread_writer",
    "thread-writer": "thread_writer",
    "gsb-thread-writer": "thread_writer",
    "019d7565-5b56-778e-8550-66ec4b179a81": "thread_writer",
    "ueatopeufdiy9d7ucrjxmkbl": "thread_writer",
    "token_analyst": "token_analyst",
    "019d756b-0217-7252-8094-7854afde1703": "token_analyst",
    "xgu49hcj2bszls4ld5q18x4w": "token_analyst",
    "wallet_profiler": "wallet_profiler",
    "019d756c-9eba-7600-81ba-f1c78f43277c": "wallet_profiler",
    "aq6du2zjiz9iekvewllqtn1i": "wallet_profiler",
    "alpha_scanner": "alpha_scanner",
    "019d755e-dfd0-7b6c-8b4c-21cfbe6fda1c": "alpha_scanner",
    "sxlj5ptb50xuu1u2goe7bcai": "alpha_scanner",
    "ceo": "ceo",
    "itrtj5b95z14av53qoubqwcu": "ceo",
    "019d7568-cd41-7523-9538-e501cc1875cc": "ceo",
  };
  const agentId = (agentAlias[body.agentId] || body.agentId) as string;

  if (shouldRun && isValidAgent(agentId)) {
    const mission = extractMission(body);
    createJob(body.jobId, agentId, mission);

    try {
      const output = await runAgent(agentId as AgentId, {
        mission,
        context: body.context || body.metadata,
      });
      completeJob(body.jobId, output.result, output.usdcEarned);

      const entry: WebhookLogEntry = {
        jobId: body.jobId,
        agentId,
        event: body.event,
        usdcAmount: output.usdcEarned ?? body.usdcAmount,
        receivedAt,
        status: "completed",
        resultPreview: output.result.slice(0, 200),
        payload: body,
      };
      pushLog(entry);

      await maybeCallback(body.callbackUrl, {
        jobId: body.jobId,
        agentId,
        status: "completed",
        result: output.result,
        usdcEarned: output.usdcEarned,
        jobRef: body.jobRef,
      });

      console.log("[GSB Webhook]", receivedAt, body.event, {
        jobId: body.jobId,
        agentId,
        status: "completed",
        usdcEarned: output.usdcEarned,
      });

      return NextResponse.json(
        {
          received: true,
          executed: true,
          jobId: body.jobId,
          agentId,
          event: body.event,
          status: "completed",
          result: output.result,
          usdcEarned: output.usdcEarned,
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      failJob(body.jobId, msg);
      pushLog({
        jobId: body.jobId,
        agentId,
        event: body.event,
        usdcAmount: body.usdcAmount,
        receivedAt,
        status: "failed",
        resultPreview: msg,
        payload: body,
      });
      await maybeCallback(body.callbackUrl, {
        jobId: body.jobId,
        agentId,
        status: "failed",
        error: msg,
        jobRef: body.jobRef,
      });
      return NextResponse.json(
        {
          received: true,
          executed: true,
          jobId: body.jobId,
          agentId,
          event: body.event,
          status: "failed",
          error: msg,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  }

  // Non-executable events — acknowledge & log only
  const entry: WebhookLogEntry = {
    jobId: body.jobId,
    agentId,
    event: body.event,
    usdcAmount: body.usdcAmount,
    receivedAt,
    status: "acked",
    payload: body,
  };
  pushLog(entry);

  console.log("[GSB Webhook]", receivedAt, body.event, {
    jobId: body.jobId,
    agentId,
    usdcAmount: body.usdcAmount ?? "n/a",
  });

  return NextResponse.json(
    {
      received: true,
      executed: false,
      jobId: body.jobId,
      agentId,
      event: body.event,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}

// ── Health-check ──────────────────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "GSB Swarm ACP Webhook",
      version: "2.1.0",
      docs: "POST /api/webhook with ACP job payload | GET /api/webhook/jobs for last 50 jobs",
      executesOn: ["job.created", "job.started", "job.request"],
    },
    { status: 200 }
  );
}
