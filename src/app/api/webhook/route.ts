/**
 * GSB Swarm — ACP Webhook Receiver
 *
 * POST /api/webhook
 *
 * Called by Virtuals ACP when a job is assigned to one of your registered agents.
 * The dashboard's localStorage store is client-side, so this endpoint validates
 * the incoming payload and returns a 200 ACK so ACP knows you received it.
 *
 * In a full production deployment you would:
 *   1. Verify the X-ACP-Signature header (HMAC-SHA256 of request body)
 *   2. Write the job to a real database (e.g. Supabase, PlanetScale, Vercel KV)
 *   3. Push an update to the frontend via SSE or WebSocket
 *
 * For the MVP / mock backend this route just logs and returns 200.
 */

import { NextRequest, NextResponse } from "next/server";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AcpWebhookPayload {
  event:    string;   // "job.created" | "job.confirmed" | "job.failed"
  jobId:    string;
  agentId:  string;
  jobRef?:  string;
  usdcAmount?: number;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body: AcpWebhookPayload;
  try {
    body = (await request.json()) as AcpWebhookPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // ── 2. Basic validation ────────────────────────────────────────────────────
  if (!body.jobId || !body.agentId || !body.event) {
    return NextResponse.json(
      { error: "Missing required fields: jobId, agentId, event" },
      { status: 422 }
    );
  }

  // ── 3. Optional: verify signature ─────────────────────────────────────────
  // const signature = request.headers.get("x-acp-signature");
  // if (!verifySignature(signature, rawBody, process.env.ACP_WEBHOOK_SECRET)) {
  //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  // }

  // ── 4. Log (console only for MVP) ─────────────────────────────────────────
  console.log("[GSB Webhook]", new Date().toISOString(), body.event, {
    jobId:      body.jobId,
    agentId:    body.agentId,
    usdcAmount: body.usdcAmount ?? "n/a",
  });

  // ── 5. TODO: persist to DB + push to frontend ──────────────────────────────
  // await db.insert(jobs).values({ ... });
  // await pusher.trigger("gsb-swarm", "job.update", body);

  // ── 6. Return ACK so ACP marks the webhook as delivered ───────────────────
  return NextResponse.json(
    {
      received: true,
      jobId:    body.jobId,
      agentId:  body.agentId,
      event:    body.event,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}

// ── Health-check ──────────────────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json(
    {
      status:  "ok",
      service: "GSB Swarm ACP Webhook",
      version: "1.0.0",
      docs:    "POST /api/webhook with ACP job payload",
    },
    { status: 200 }
  );
}
