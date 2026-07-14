/**
 * GSB x402 base discovery
 * GET /x402 — list available payment endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { X402_AGENTS, priceToAtomic } from "@/lib/x402";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const agents = Object.entries(X402_AGENTS).map(([key, meta]) => ({
    id: meta.id,
    key,
    name: meta.name,
    priceUsd: meta.priceUsd,
    priceUsdcAtomic: priceToAtomic(meta.priceUsd),
    endpoint: `${origin}/x402/${key}`,
    capabilities: meta.capabilities,
    description: meta.description,
  }));

  return NextResponse.json({
    status: "ok",
    service: "GSB Swarm x402 Endpoints",
    network: "base",
    count: agents.length,
    agents,
    docs: "POST to an agent endpoint with { mission } to run a job. Set X402_REQUIRE_PAYMENT=true to enforce USDC micropayments.",
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
