import { NextRequest } from "next/server";

const PLAYWRIGHT_WORKER = "https://playwright-worker-production-a627.up.railway.app";
const WAKE_TIMEOUT_MS  = 60_000; // 60s — Playwright install can be slow on cold boot
const WAKE_POLL_MS     = 3_000;

function sseError(msg: string): Response {
  const body =
    `data: ${JSON.stringify({ type: "log", msg })}\n\n` +
    `data: ${JSON.stringify({ type: "done", result: { ok: false, error: msg } })}\n\n`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Poll /health until 200 or timeout. Returns true if healthy. */
async function wakeWorker(): Promise<boolean> {
  const deadline = Date.now() + WAKE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${PLAYWRIGHT_WORKER}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (r.ok) return true;
    } catch {
      // still starting — keep polling
    }
    await new Promise((res) => setTimeout(res, WAKE_POLL_MS));
  }
  return false;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { appId, suite } = body as { appId: string; suite: "quick" | "full" };

  if (!appId || !suite) {
    return new Response(JSON.stringify({ error: "appId and suite required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Wake the worker (handles cold-boot / Railway restart)
  const alive = await wakeWorker();
  if (!alive) {
    return sseError(
      `❌ Playwright worker unreachable after ${WAKE_TIMEOUT_MS / 1000}s. ` +
      `Check Railway service playwright-worker-production-a627.`
    );
  }

  // Proxy SSE stream from playwright-worker to the browser
  let upstream: Response;
  try {
    upstream = await fetch(`${PLAYWRIGHT_WORKER}/run-suite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, suite }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signal: AbortSignal.timeout(300_000), // 5 min max for full suite
    } as any);
  } catch (e: unknown) {
    return sseError(`❌ Worker fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!upstream.ok || !upstream.body) {
    return sseError(`❌ Worker error HTTP ${upstream.status}.`);
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
