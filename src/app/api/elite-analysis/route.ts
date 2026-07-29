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

async function railwayPost(path: string, body: unknown, token: string) {
  return fetch(`${RAILWAY_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gsb-token": token,
    },
    body: JSON.stringify(body),
  });
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
    const includeSynthesis = body.includeSynthesis !== false;

    if (!query) {
      return NextResponse.json({ error: "query is required (ticker, company, or token address)" }, { status: 400 });
    }

    let token = await getRailwayToken();

    // Prefer dedicated elite-analysis endpoint; fall back to fire-job Equity Analyst
    let res = await railwayPost(
      "/api/elite-analysis",
      { query, assetType, includeSynthesis },
      token
    );

    if (res.status === 401) {
      _railwayToken = null;
      token = await getRailwayToken();
      res = await railwayPost("/api/elite-analysis", { query, assetType, includeSynthesis }, token);
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
      return NextResponse.json({ error: `Railway elite-analysis failed: ${err}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({ ...data, via: "elite-analysis" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
