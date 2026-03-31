/**
 * GSB Swarm — ACP Webhook Receiver
 *
 * POST /api/webhook  — receive ACP job events, store to in-memory log
 * GET  /api/webhook  — health check
 */

import { NextRequest, NextResponse } from "next/server";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AcpWebhookPayload {
  event: string;
  jobId: string;
  agentId: string;
  jobRef?: string;
  usdcAmount?: number;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

interface WebhookLogEntry {
  jobId: string;
  agentId: string;
  event: string;
  usdcAmount?: number;
  receivedAt: string;
  payload: AcpWebhookPayload;
}

// ── In-memory job log ─────────────────────────────────────────────────────────
const webhookLog: WebhookLogEntry[] = [];
const MAX_LOG = 200;

export function getWebhookLog(n: number): WebhookLogEntry[] {
  return webhookLog.slice(-n).reverse();
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

  // Store to in-memory log
  const entry: WebhookLogEntry = {
    jobId: body.jobId,
    agentId: body.agentId,
    event: body.event,
    usdcAmount: body.usdcAmount,
    receivedAt: new Date().toISOString(),
    payload: body,
  };

  webhookLog.push(entry);
  if (webhookLog.length > MAX_LOG) {
    webhookLog.splice(0, webhookLog.length - MAX_LOG);
  }

  console.log("[GSB Webhook]", entry.receivedAt, body.event, {
    jobId: body.jobId,
    agentId: body.agentId,
    usdcAmount: body.usdcAmount ?? "n/a",
  });

  return NextResponse.json(
    {
      received: true,
      jobId: body.jobId,
      agentId: body.agentId,
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
      version: "2.0.0",
      docs: "POST /api/webhook with ACP job payload | GET /api/webhook/jobs for last 50 jobs",
    },
    { status: 200 }
  );
}
