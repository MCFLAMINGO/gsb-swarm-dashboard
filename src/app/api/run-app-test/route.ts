import { NextRequest } from "next/server";

const PLAYWRIGHT_WORKER = "https://playwright-worker-production.up.railway.app";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { appId, suite } = body as { appId: string; suite: "quick" | "full" };

  if (!appId || !suite) {
    return new Response(JSON.stringify({ error: "appId and suite required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Proxy SSE stream from playwright-worker to the browser
  const upstream = await fetch(`${PLAYWRIGHT_WORKER}/run-suite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId, suite }),
  });

  if (!upstream.ok || !upstream.body) {
    // Return a synthetic SSE error so the client logs it cleanly
    const errMsg = `data: ${JSON.stringify({ type: "log", data: `❌ Worker unreachable (HTTP ${upstream.status}). Check Railway — service may be spun down.` })}\n\ndata: ${JSON.stringify({ type: "done" })}\n\n`;
    return new Response(errMsg, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // Pass SSE stream through directly
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
