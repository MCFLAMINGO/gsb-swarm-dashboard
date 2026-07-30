import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 15;

/** Resolve a friendly company name for Desk session titles (AAPL → Apple). */
export async function GET(req: NextRequest) {
  const symbol = String(req.nextUrl.searchParams.get("symbol") || "")
    .trim()
    .toUpperCase()
    .replace(/^\$/, "");
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=5&newsCount=0`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "GSB-Desk/1.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ symbol, name: null, error: `yahoo ${res.status}` });
    }
    const data = (await res.json()) as {
      quotes?: Array<{ symbol?: string; shortname?: string; longname?: string; quoteType?: string }>;
    };
    const hit =
      (data.quotes || []).find(
        (q) => String(q.symbol || "").toUpperCase() === symbol && (q.quoteType === "EQUITY" || !q.quoteType)
      ) || (data.quotes || [])[0];
    const name = hit?.shortname || hit?.longname || null;
    return NextResponse.json({ symbol, name });
  } catch (err) {
    return NextResponse.json({
      symbol,
      name: null,
      error: err instanceof Error ? err.message : "lookup failed",
    });
  }
}
