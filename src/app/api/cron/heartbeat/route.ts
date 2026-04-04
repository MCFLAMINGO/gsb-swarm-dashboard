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

// ── Alert throttle: max once per 24 hours + $20 buy threshold ─────────────────
let lastAlertSentAt = 0;
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

async function checkForSignificantBuy(tokenAddress: string): Promise<{ hasBuy: boolean; amount: number; priceChange: number }> {
  try {
    // Check DexScreener for recent trades on $GSB
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      { next: { revalidate: 300 } }
    );
    const data = await res.json();
    const pair = data?.pairs?.[0];
    if (!pair) return { hasBuy: false, amount: 0, priceChange: 0 };

    const priceChange1h = Math.abs(parseFloat(pair.priceChange?.h1 || '0'));
    const volume1h = parseFloat(pair.volume?.h1 || '0');
    const buys1h = pair.txns?.h1?.buys || 0;

    // Trigger alert if: price moved >2% OR volume in last hour >$20 with buys
    const hasBuy = (priceChange1h >= 2) || (volume1h >= 20 && buys1h > 0);
    return { hasBuy, amount: volume1h, priceChange: priceChange1h };
  } catch {
    return { hasBuy: false, amount: 0, priceChange: 0 };
  }
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

  // 2. Alert: only fire if significant buy ($20+) AND 24h cooldown passed
  const GSB_TOKEN = '0x6dA1A9793Ebe96975c240501A633ab8B3c83D14A';
  const cooldownPassed = Date.now() - lastAlertSentAt > ALERT_COOLDOWN_MS;
  const buyCheck = await checkForSignificantBuy(GSB_TOKEN);

  if (!cooldownPassed) {
    results.alert = { status: 'skipped — 24h cooldown active', result: `Last alert: ${new Date(lastAlertSentAt).toISOString()}` };
  } else if (!buyCheck.hasBuy) {
    results.alert = { status: `skipped — no significant activity (vol: $${buyCheck.amount.toFixed(2)}, move: ${buyCheck.priceChange.toFixed(2)}%)` };
  } else {
    // Significant activity detected — fire alert
    const alertJobId = `cron_alert_${Date.now()}`;
    createJob(alertJobId, "alert", "[CRON] Check $GSB price and generate alert");
    try {
      const alertOut = await runAlert({
        mission: `$GSB has significant activity: volume $${buyCheck.amount.toFixed(0)} in last hour, price moved ${buyCheck.priceChange.toFixed(1)}%. Generate a Telegram alert about this movement.`,
      });
      completeJob(alertJobId, alertOut.result, alertOut.usdcEarned);
      results.alert = { status: "ok", result: alertOut.result.slice(0, 200) };

      // Send Telegram alert ONCE (agent no longer sends internally)
      const tgCreds = await import('@/lib/mcp').then(m => m.mcp.telegramCredentials());
      const cronTelegramToken = tgCreds?.botToken || process.env.TELEGRAM_BOT_TOKEN;
      const cronTelegramChatId = tgCreds?.channelId || process.env.TELEGRAM_CHANNEL_ID;
      if (cronTelegramToken && cronTelegramChatId) {
        const telegramMatch = alertOut.result.match(/---\s*TELEGRAM ALERT\s*---\n?([\s\S]*?)(?:---\s*X DM COPY\s*---|$)/i);
        const telegramText = telegramMatch ? telegramMatch[1].trim() : alertOut.result.slice(0, 400);
        if (telegramText.length > 10) {
          await fetch(`https://api.telegram.org/bot${cronTelegramToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: cronTelegramChatId, text: telegramText, parse_mode: "Markdown" }),
          });
          lastAlertSentAt = Date.now(); // update cooldown
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      failJob(alertJobId, msg);
      results.alert = { status: "error", error: msg };
    }
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
