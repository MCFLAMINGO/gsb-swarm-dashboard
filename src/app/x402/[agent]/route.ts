/**
 * GSB x402 payment endpoints
 *
 * GET  /x402/:agent  — discovery + pricing
 * POST /x402/:agent  — run paid/unpaid agent job
 *
 * Agents: oracle | preacher | onboarding | alert
 */

import { NextRequest } from "next/server";
import {
  handleX402Get,
  handleX402Post,
  handleX402Options,
  X402_AGENTS,
} from "@/lib/x402";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ agent: string }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const { agent } = await ctx.params;
  return handleX402Get(request, agent.toLowerCase());
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const { agent } = await ctx.params;
  const key = agent.toLowerCase();
  if (!(key in X402_AGENTS)) {
    return handleX402Get(request, key); // returns 404 for unknown
  }
  return handleX402Post(request, key);
}

export async function OPTIONS() {
  return handleX402Options();
}
