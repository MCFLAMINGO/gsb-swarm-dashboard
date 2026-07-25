/**
 * GET  /api/x/status  — credential + webhook readiness for operators
 * POST /api/x/status  — optional: register webhook URL with X (needs bearer)
 *
 * This does NOT replace restoring Railway ACP — it makes agents useful on X.
 */

import { NextRequest, NextResponse } from "next/server";
import { getXKeys } from "@/lib/x/activity";
import { getRecentXEvents } from "@/lib/x/eventLog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const keys = await getXKeys();
  const origin = new URL(request.url).origin;
  const webhookUrl = `${origin}/api/x/webhook`;

  return NextResponse.json({
    ok: true,
    webhookUrl,
    credentials: {
      apiKey: Boolean(keys?.apiKey || process.env.X_API_KEY),
      apiSecret: Boolean(keys?.apiSecret || process.env.X_API_SECRET),
      accessToken: Boolean(keys?.accessToken || process.env.X_ACCESS_TOKEN),
      accessTokenSecret: Boolean(
        keys?.accessTokenSecret || process.env.X_ACCESS_TOKEN_SECRET
      ),
      complete: Boolean(
        keys?.apiKey &&
          keys?.apiSecret &&
          keys?.accessToken &&
          keys?.accessTokenSecret
      ),
    },
    agentRouting: {
      "post.mention.create": "thread_writer (draft reply, no auto-post)",
      "post.create + @mention": "thread_writer",
      "like.create": "alert",
      "follow.follow": "onboarding",
      "dm.received / chat.received": "onboarding",
      "post.create (own)": "alert (confirm)",
    },
    setup: [
      "1. Add missing env:X_API_KEY on Railway MCP (secret/tokens already present)",
      "2. Register webhook: POST https://api.x.com/2/webhooks  { url: webhookUrl } with App Bearer",
      "3. Create Activity subscriptions: POST /2/activity/subscriptions for post.mention.create, like.create, follow.follow, dm.received",
      "4. Filter by your GSB bot user_id",
      "5. Optional: connect X MCP (https://api.x.com/mcp) in Cursor for operator tooling",
      "6. Separate track: restore Railway acpReady=true so Virtuals marketplace can hire these agents",
    ],
    recentEvents: getRecentXEvents(20),
    mcp: {
      xApi: "https://api.x.com/mcp",
      docs: "https://docs.x.com/mcp",
      note: "Use xurl bridge with CLIENT_ID/CLIENT_SECRET for user-context writes; App Bearer for read-only",
    },
  });
}

export async function POST(request: NextRequest) {
  // Soft helper: register webhook if operator passes App Bearer
  let body: { bearer?: string; url?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }

  const bearer = body.bearer || process.env.X_BEARER_TOKEN || process.env.X_APP_BEARER;
  if (!bearer) {
    return NextResponse.json(
      {
        error: "Pass { bearer: APP_ONLY_BEARER } or set X_BEARER_TOKEN",
        hint: "Create App-only Bearer in X Developer Portal → Keys and tokens",
      },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const url = body.url || `${origin}/api/x/webhook`;

  try {
    const res = await fetch("https://api.x.com/2/webhooks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(
      {
        ok: res.ok,
        status: res.status,
        webhookUrl: url,
        response: data,
      },
      { status: res.ok ? 200 : res.status }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Register failed" },
      { status: 500 }
    );
  }
}
