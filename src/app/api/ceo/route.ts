import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

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

async function railwayAuthed(path: string, init: RequestInit = {}) {
  let token = await getRailwayToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  headers["x-gsb-token"] = token;
  let res = await fetch(`${RAILWAY_BASE}${path}`, { ...init, headers, cache: "no-store" });
  if (res.status === 401) {
    _railwayToken = null;
    token = await getRailwayToken();
    headers["x-gsb-token"] = token;
    res = await fetch(`${RAILWAY_BASE}${path}`, { ...init, headers, cache: "no-store" });
  }
  return res;
}

/** Proxy CEO endpoints: trade-book | execute | arm-plan | tick-plan */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "trade-book");
    const path =
      action === "execute"
        ? "/api/ceo/execute"
        : action === "arm-plan"
          ? "/api/ceo/arm-plan"
          : action === "tick-plan"
            ? "/api/ceo/tick-plan"
            : "/api/ceo/trade-book";
    const res = await railwayAuthed(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const path = id ? `/api/ceo/plans?id=${encodeURIComponent(id)}` : "/api/ceo/plans";
    const res = await railwayAuthed(path);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
