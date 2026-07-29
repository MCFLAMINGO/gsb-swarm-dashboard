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

async function railwayFetch(path: string, init: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers["x-gsb-token"] = token;
  return fetch(`${RAILWAY_BASE}${path}`, { ...init, headers, cache: "no-store" });
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "status";
  try {
    if (action === "status") {
      // status is public boolean-ish on Railway
      const res = await railwayFetch("/api/robinhood/status");
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    const token = await getRailwayToken();
    if (action === "connect") {
      let res = await railwayFetch("/api/robinhood/connect", {}, token);
      if (res.status === 401) {
        _railwayToken = null;
        const fresh = await getRailwayToken();
        res = await railwayFetch("/api/robinhood/connect", {}, fresh);
      }
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    if (action === "portfolio" || action === "accounts") {
      const path = action === "accounts" ? "/api/robinhood/accounts" : "/api/robinhood/portfolio";
      let res = await railwayFetch(path, {}, token);
      if (res.status === 401) {
        _railwayToken = null;
        const fresh = await getRailwayToken();
        res = await railwayFetch(path, {}, fresh);
      }
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    if (action === "health") {
      let res = await railwayFetch("/api/robinhood/health", {}, token);
      if (res.status === 401) {
        _railwayToken = null;
        const fresh = await getRailwayToken();
        res = await railwayFetch("/api/robinhood/health", {}, fresh);
      }
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let token = await getRailwayToken();
    const action = String(body.action || "execute");
    const path = action === "import-tokens" ? "/api/robinhood/import-tokens" : "/api/robinhood/execute";
    const payload = action === "import-tokens"
      ? {
          access_token: body.access_token || body.accessToken,
          refresh_token: body.refresh_token || body.refreshToken,
          client_id: body.client_id || body.clientId,
        }
      : body;
    let res = await railwayFetch(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      token
    );
    if (res.status === 401) {
      _railwayToken = null;
      token = await getRailwayToken();
      res = await railwayFetch(
        path,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        token
      );
    }
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
