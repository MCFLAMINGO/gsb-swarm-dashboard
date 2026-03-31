import { NextRequest, NextResponse } from "next/server";
import { runOracle } from "@/lib/agents/oracle";
import { runPreacher } from "@/lib/agents/preacher";
import { runAlert } from "@/lib/agents/alert";
import { createJob, completeJob, failJob } from "@/lib/jobStore";

// ── Simple cache for trending tokens ─────────────────────────────────────────
interface CacheEntry {
  data: string;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

function setCache(key: string, data: string) {
  cache.set(key, { data, cachedAt: Date.now() });
}

function getCache(key: string, maxAgeMs: number): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > maxAgeMs) return null;
  return entry.data;
}

// ── Heartbeat handler ────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Verify CRON_SECRET if set
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results: Record<string, { status: string; result?: string; error?: string }> = {};

  // 1. Preacher: generate 1 GSB awareness post for X
  const preacherJobId = `cron_preacher_${Date.now()}`;
  createJob(preacherJobId, "preacher", "[CRON] Generate $GSB awareness post for X");
  try {
    const preacherOut = await runPreacher({
      mission: "Write a viral X/Twitter post about $GSB (Agent Gas Bible) — the tokenized compute bank on Base. Include latest excitement about AI agents earning USDC. Make it punchy and shareable.",
    });
    completeJob(preacherJobId, preacherOut.result, preacherOut.usdcEarned);
    results.preacher = { status: "ok", result: preacherOut.result.slice(0, 200) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    failJob(preacherJobId, msg);
    results.preacher = { status: "error", error: msg };
  }

  // 2. Alert: check $GSB price, generate alert if needed
  const alertJobId = `cron_alert_${Date.now()}`;
  createJob(alertJobId, "alert", "[CRON] Check $GSB price and generate alert");
  try {
    const alertOut = await runAlert({
      mission: "Check $GSB token price on Base. If there's been a significant move, generate alert copy for Telegram and X DM. Always generate a status update even if no major move.",
    });
    completeJob(alertJobId, alertOut.result, alertOut.usdcEarned);
    results.alert = { status: "ok", result: alertOut.result.slice(0, 200) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    failJob(alertJobId, msg);
    results.alert = { status: "error", error: msg };
  }

  // 3. Oracle: cache latest Base trending tokens
  const oracleJobId = `cron_oracle_${Date.now()}`;
  createJob(oracleJobId, "oracle", "[CRON] Cache Base trending tokens");
  try {
    const cached = getCache("trending_tokens", 30 * 60 * 1000);
    if (cached) {
      completeJob(oracleJobId, cached, 0.002);
      results.oracle = { status: "ok (cached)", result: cached.slice(0, 200) };
    } else {
      const oracleOut = await runOracle({
        mission: "List the top 5 trending tokens on Base by volume with current prices. Provide compute cost estimates for analyzing each.",
      });
      completeJob(oracleJobId, oracleOut.result, oracleOut.usdcEarned);
      setCache("trending_tokens", oracleOut.result);
      results.oracle = { status: "ok", result: oracleOut.result.slice(0, 200) };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    failJob(oracleJobId, msg);
    results.oracle = { status: "error", error: msg };
  }

  return NextResponse.json({
    heartbeat: "ok",
    timestamp: new Date().toISOString(),
    results,
  });
}
