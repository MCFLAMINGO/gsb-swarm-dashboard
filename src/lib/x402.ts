/**
 * GSB x402 agent endpoint helpers
 *
 * Implements HTTP 402 Payment Required discovery + paid job execution
 * for the four Vercel-hosted broker agents (oracle, preacher, onboarding, alert).
 *
 * Payment enforcement:
 *   - If X402_REQUIRE_PAYMENT=true AND a payTo address is configured,
 *     POST without X-PAYMENT / X-PAYMENT-RESPONSE returns 402.
 *   - Otherwise endpoints run freely (ACP may settle payment out-of-band).
 */

import { NextRequest, NextResponse } from "next/server";
import { isValidAgent, runAgent, type AgentId } from "@/lib/agents";
import { createJob, completeJob, failJob } from "@/lib/jobStore";

// Base USDC (native) — EIP-3009 asset used by x402 on Base
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export interface X402AgentMeta {
  id: AgentId;
  name: string;
  description: string;
  priceUsd: number;
  capabilities: string[];
}

export const X402_AGENTS: Record<string, X402AgentMeta> = {
  oracle: {
    id: "oracle",
    name: "GSB Compute Oracle",
    description:
      "Instant micro-quote engine for Agent Gas Bible ($GSB) compute resources on Base.",
    priceUsd: 0.002,
    capabilities: [
      "micro-quote",
      "x402-lending-link",
      "compute-pricing",
      "gsb-bank-integration",
    ],
  },
  preacher: {
    id: "preacher",
    name: "GSB Marketing Preacher",
    description:
      "Viral X threads, Butler promotions, and Web3-native copy for $GSB.",
    priceUsd: 0.05,
    capabilities: ["viral-thread", "x-posting", "butler-promo", "web3-copywriting"],
  },
  onboarding: {
    id: "onboarding",
    name: "GSB Onboarding Broker",
    description:
      "Step-by-step onboarding for new AI agents entering the GSB ecosystem.",
    priceUsd: 0.1,
    capabilities: [
      "agent-onboarding",
      "first-borrow-guide",
      "x402-setup",
      "acp-integration",
    ],
  },
  alert: {
    id: "alert",
    name: "GSB Alert Manager",
    description:
      "Real-time cheap-compute alerts via Telegram and X. Relationship management.",
    priceUsd: 0.01,
    capabilities: [
      "cheap-compute-alert",
      "telegram-notify",
      "x-dm",
      "relationship-mgmt",
    ],
  },
};

/** Convert USD price to USDC atomic units (6 decimals) as a decimal string */
export function priceToAtomic(usd: number): string {
  return Math.round(usd * 1_000_000).toString();
}

function payToAddress(): string {
  return (
    process.env.GSB_BANK_ADDRESS ||
    process.env.X402_PAY_TO ||
    process.env.NEXT_PUBLIC_GSB_BANK_ADDRESS ||
    ""
  );
}

function requirePayment(): boolean {
  const flag = process.env.X402_REQUIRE_PAYMENT;
  if (flag === "true" || flag === "1") return Boolean(payToAddress());
  return false;
}

function hasPaymentProof(request: NextRequest): boolean {
  return Boolean(
    request.headers.get("x-payment") ||
      request.headers.get("X-PAYMENT") ||
      request.headers.get("x-payment-response") ||
      request.headers.get("payment-signature") ||
      request.headers.get("authorization")?.toLowerCase().startsWith("x402 ")
  );
}

export function build402Body(agent: X402AgentMeta, resourceUrl: string) {
  const payTo = payToAddress() || "0x0000000000000000000000000000000000000000";
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: "base",
        maxAmountRequired: priceToAtomic(agent.priceUsd),
        resource: resourceUrl,
        description: agent.description,
        mimeType: "application/json",
        payTo,
        maxTimeoutSeconds: 120,
        asset: USDC_BASE,
        extra: {
          name: "USD Coin",
          version: "2",
        },
      },
    ],
    error: "Payment required — attach X-PAYMENT header with USDC authorization",
  };
}

export function discoveryResponse(agent: X402AgentMeta, resourceUrl: string) {
  const payTo = payToAddress();
  return NextResponse.json(
    {
      status: "ok",
      service: agent.name,
      agentId: agent.id,
      priceUsd: agent.priceUsd,
      priceUsdcAtomic: priceToAtomic(agent.priceUsd),
      network: "base",
      asset: USDC_BASE,
      payTo: payTo || null,
      paymentRequired: requirePayment(),
      capabilities: agent.capabilities,
      description: agent.description,
      docs: {
        get: "Discovery + pricing (this response)",
        post: "Run agent job. Body: { mission | requirement | prompt, context? }",
        payment:
          "Include X-PAYMENT header with x402 authorization when X402_REQUIRE_PAYMENT=true",
      },
      x402: build402Body(agent, resourceUrl),
    },
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type, X-PAYMENT, X-PAYMENT-RESPONSE, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    }
  );
}

function extractMission(body: Record<string, unknown>): string | null {
  const candidates = [
    body.mission,
    body.requirement,
    body.prompt,
    body.query,
    body.message,
    body.input,
    // ACP-style nested payloads
    (body.job as Record<string, unknown> | undefined)?.requirement,
    (body.job as Record<string, unknown> | undefined)?.mission,
    (body.data as Record<string, unknown> | undefined)?.mission,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

export async function handleX402Post(
  request: NextRequest,
  agentKey: string
): Promise<NextResponse> {
  const agent = X402_AGENTS[agentKey];
  if (!agent || !isValidAgent(agent.id)) {
    return NextResponse.json(
      { error: `Unknown x402 agent: ${agentKey}` },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const resourceUrl = `${url.origin}/x402/${agentKey}`;

  // Payment gate
  if (requirePayment() && !hasPaymentProof(request)) {
    return NextResponse.json(build402Body(agent, resourceUrl), {
      status: 402,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type, X-PAYMENT, X-PAYMENT-RESPONSE, Authorization",
        "Payment-Required": "true",
      },
    });
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mission =
    extractMission(body) ||
    `Default ${agent.name} job — provide a compute/service response for GSB.`;

  const context =
    (body.context as Record<string, unknown> | undefined) ||
    (body.metadata as Record<string, unknown> | undefined) ||
    undefined;

  const jobId =
    (typeof body.jobId === "string" && body.jobId) ||
    (typeof body.job_id === "string" && body.job_id) ||
    `x402_${agent.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  createJob(jobId, agent.id, mission);

  try {
    const output = await runAgent(agent.id, { mission, context });
    completeJob(jobId, output.result, output.usdcEarned);

    return NextResponse.json(
      {
        ok: true,
        jobId,
        agentId: agent.id,
        status: "completed",
        result: output.result,
        usdcEarned: output.usdcEarned,
        priceUsd: agent.priceUsd,
        paid: hasPaymentProof(request) || !requirePayment(),
        completedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "Content-Type, X-PAYMENT, X-PAYMENT-RESPONSE, Authorization",
        },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    failJob(jobId, msg);
    console.error(`[x402/${agentKey}] failed:`, msg);
    return NextResponse.json(
      { ok: false, jobId, agentId: agent.id, status: "failed", error: msg },
      { status: 500 }
    );
  }
}

export function handleX402Options() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, X-PAYMENT, X-PAYMENT-RESPONSE, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export function handleX402Get(request: NextRequest, agentKey: string) {
  const agent = X402_AGENTS[agentKey];
  if (!agent) {
    return NextResponse.json(
      { error: `Unknown x402 agent: ${agentKey}` },
      { status: 404 }
    );
  }
  const url = new URL(request.url);
  return discoveryResponse(agent, `${url.origin}/x402/${agentKey}`);
}
