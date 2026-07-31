import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Batch Yahoo chart quotes for paper concept marking */
export async function GET(req: NextRequest) {
  const symbols = String(req.nextUrl.searchParams.get("symbols") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 40);
  if (!symbols.length) {
    return NextResponse.json({ error: "symbols required" }, { status: 400 });
  }

  const quotes: Record<string, number> = {};
  const errors: Record<string, string> = {};

  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
        const res = await fetch(url, {
          headers: { "User-Agent": "gsb-swarm-dashboard/1.0" },
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) {
          errors[sym] = `yahoo ${res.status}`;
          return;
        }
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        const px = Number(meta?.regularMarketPrice ?? meta?.previousClose);
        if (Number.isFinite(px)) quotes[sym] = px;
        else errors[sym] = "no price";
      } catch (e) {
        errors[sym] = e instanceof Error ? e.message : "fetch failed";
      }
    })
  );

  return NextResponse.json({ quotes, errors, at: new Date().toISOString() });
}
