import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Elite runs often 45–90s (parallel feeds + NIM memo). 60s Vercel default
// cut the response → UI looked empty / "nothing shows up".
export const maxDuration = 300;

const RAILWAY_BASE = "https://gsb-swarm-production.up.railway.app";

let _railwayToken: string | null = null;

async function getRailwayToken(): Promise<string> {
  if (_railwayToken) return _railwayToken;
  const password = process.env.DASHBOARD_PASSWORD || process.env.RAILWAY_OPERATOR_PASSWORD || "Erock1976";
  const res = await fetch(`${RAILWAY_BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`Railway auth failed (${res.status})`);
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("Railway auth returned no token");
  _railwayToken = data.token;
  return _railwayToken;
}

async function railwayPost(path: string, body: unknown, token: string, timeoutMs = 95_000) {
  return fetch(`${RAILWAY_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gsb-token": token,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
}

function isGatewayTimeout(status: number, text: string) {
  if (status === 502 || status === 503 || status === 504) return true;
  return /Application failed to respond|gateway|timed? ?out/i.test(text || "");
}

export async function GET() {
  try {
    const res = await fetch(`${RAILWAY_BASE}/api/elite-sources`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Railway elite-sources unavailable (${res.status}) — deploy gsb-swarm elite branch if missing`,
          sources: null,
        },
        { status: 502 }
      );
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error", sources: null },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const query = String(body.query || body.ticker || body.symbol || "").trim();
    const assetType = ["auto", "equity", "crypto"].includes(body.assetType) ? body.assetType : "auto";
    let includeSynthesis = body.includeSynthesis !== false;

    if (!query) {
      return NextResponse.json({ error: "query is required (ticker, company, or token address)" }, { status: 400 });
    }

    let token = await getRailwayToken();

    // Prefer dedicated elite-analysis endpoint; fall back to fire-job Equity Analyst
    let res: Response;
    try {
      res = await railwayPost(
        "/api/elite-analysis",
        { query, assetType, includeSynthesis },
        token
      );
    } catch (err) {
      // AbortError / network — retry fast pack without NIM
      if (includeSynthesis) {
        includeSynthesis = false;
        res = await railwayPost(
          "/api/elite-analysis",
          { query, assetType, includeSynthesis: false },
          token,
          60_000
        );
      } else {
        throw err;
      }
    }

    if (res.status === 401) {
      _railwayToken = null;
      token = await getRailwayToken();
      res = await railwayPost("/api/elite-analysis", { query, assetType, includeSynthesis }, token);
    }

    // Railway edge 502 "Application failed to respond" = NIM/synthesis hung past ~100s.
    // Retry once with includeSynthesis:false (research pack only, ~4–15s).
    if (includeSynthesis) {
      const peek = !res.ok ? await res.clone().text().catch(() => "") : "";
      if (isGatewayTimeout(res.status, peek)) {
        console.warn(`[elite-analysis] ${res.status} with synthesis — retrying without NIM`);
        res = await railwayPost(
          "/api/elite-analysis",
          { query, assetType, includeSynthesis: false },
          token,
          60_000
        );
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({
            ...data,
            via: "elite-analysis",
            synthesis_note:
              data.synthesis_note ||
              "Full NIM memo timed out on Railway — returned fast desk pack (fallback memo).",
          });
        }
      } else if (!res.ok && peek) {
        // Restore body for error path below by re-wrapping — we consumed clone only
      }
    }

    if (res.status === 404) {
      // Older Railway deploy without /api/elite-analysis — use fire-job direct
      res = await railwayPost(
        "/api/fire-job",
        {
          worker: "GSB Equity Analyst",
          requirement: `Run elite deep dive on ${query} — technicals, fundamentals, online intel, industry and adjacent industries. Return structured BUY/HOLD/AVOID memo.`,
          direct: true,
        },
        token
      );
      if (!res.ok) {
        const err = await res.text().catch(() => `HTTP ${res.status}`);
        return NextResponse.json({ error: `Railway fire-job failed: ${err}` }, { status: 502 });
      }
      const data = (await res.json()) as { result?: string; error?: string; jobId?: string };
      let report: unknown = data.result;
      try {
        report = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
      } catch {
        /* keep string */
      }
      return NextResponse.json({
        ok: true,
        via: "fire-job",
        jobId: data.jobId,
        report,
      });
    }

    if (!res.ok) {
      const err = await res.text().catch(() => `HTTP ${res.status}`);
      return NextResponse.json(
        {
          error: `Railway elite-analysis failed: ${err}`,
          hint:
            "If you see Application failed to respond, NIM synthesis hung — retry; dashboard auto-retries without synthesis.",
        },
        { status: res.status === 504 ? 504 : 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ ...data, via: "elite-analysis" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const timedOut = /timeout|aborted|TimeoutError/i.test(msg);
    return NextResponse.json(
      {
        error: timedOut
          ? "Elite timed out waiting for Railway (often NVIDIA NIM). Retry — or wait for the NIM timeout hotfix deploy."
          : msg,
      },
      { status: timedOut ? 504 : 500 }
    );
  }
}
