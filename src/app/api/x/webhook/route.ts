import { NextRequest, NextResponse } from "next/server";
import {
  crcResponseToken,
  getXKeys,
  normalizeXEvents,
  verifyWebhookSignature,
} from "@/lib/x/activity";
import { routeXEvents } from "@/lib/x/router";
import { getRecentXEvents, pushRecentXEvent } from "@/lib/x/eventLog";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const crcToken = request.nextUrl.searchParams.get("crc_token");
  if (!crcToken) {
    return NextResponse.json({
      status: "ok",
      service: "GSB X Activity Webhook",
      docs: "Register this URL with X Webhooks API, then subscribe via Activity API",
      crc: "Pass ?crc_token=... for Challenge-Response Check",
      events: getRecentXEvents(20),
    });
  }

  const keys = await getXKeys();
  const secret = keys?.apiSecret || process.env.X_API_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "X_API_SECRET / consumer secret not configured — cannot answer CRC" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    response_token: crcResponseToken(crcToken, secret),
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const keys = await getXKeys();
  const secret = keys?.apiSecret || process.env.X_API_SECRET;

  // Signature verification when secret is available
  if (secret) {
    const sig = request.headers.get("x-twitter-webhooks-signature");
    const skipVerify = process.env.X_WEBHOOK_SKIP_VERIFY === "true";
    if (!skipVerify && !verifyWebhookSignature(rawBody, sig, secret)) {
      console.warn("[x/webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody.trim() ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Empty CRC / keepalive
  if (!Object.keys(payload).length) {
    return NextResponse.json({ ok: true });
  }

  const events = normalizeXEvents(payload);
  if (!events.length) {
    pushRecentXEvent({
      at: new Date().toISOString(),
      type: "unknown",
      status: "acked",
      detail: `Keys: ${Object.keys(payload).join(",")}`,
    });
    // Still 200 — X retries on non-2xx
    return NextResponse.json({ ok: true, routed: 0, note: "No recognized events" });
  }

  // Route to agents (await so Vercel doesn't freeze mid-flight)
  const results = await routeXEvents(events);
  for (const r of results) {
    pushRecentXEvent({
      at: new Date().toISOString(),
      type: r.eventType,
      status: r.status,
      detail: r.detail,
    });
  }

  return NextResponse.json({
    ok: true,
    received: events.length,
    results,
  });
}
