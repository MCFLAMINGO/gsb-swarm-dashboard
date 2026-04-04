import { callModel } from '@/lib/modelRouter';
import { mcp } from '@/lib/mcp';

const SYSTEM_PROMPT = `You are the GSB Alert Manager. You monitor crypto assets and generate alert messages for Telegram and X. You are concise, data-driven, and urgent when needed.

Format alerts in two sections:
1. TELEGRAM ALERT — use Telegram markdown (bold with *, code with \`)
2. X DM COPY — plain text, under 280 chars

Include relevant price data, percentage changes, and actionable info.
Always reference $GSB and Agent Gas Bible where relevant.`;

interface AlertInput {
  mission: string;
  context?: Record<string, unknown>;
}

interface AlertResult {
  result: string;
  usdcEarned: number;
}

async function fetchTokenPrice(token: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/search/pools?query=${encodeURIComponent(token)}&network=base&page=1`
    );
    if (!res.ok) return `Price data for ${token} unavailable.`;
    const data = await res.json();
    const pool = data?.data?.[0];
    if (!pool) return `No pool found for ${token} on Base.`;
    const attrs = pool.attributes as Record<string, unknown> | undefined;
    const price = attrs?.base_token_price_usd;
    const change = (attrs?.price_change_percentage as Record<string, unknown>)?.h1;
    return `${attrs?.name}: $${Number(price || 0).toFixed(6)} (1h change: ${change ?? "N/A"}%)`;
  } catch {
    return `Price data for ${token} unavailable.`;
  }
}

function extractWallet(text: string): string | null {
  const match = text.match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0] : null;
}

function extractToken(text: string): string | null {
  const match = text.match(/\$([A-Za-z]{2,10})/);
  return match ? match[1] : null;
}

export async function runAlert({ mission, context }: AlertInput): Promise<AlertResult> {
  const wallet = extractWallet(mission);
  const token = extractToken(mission) || "GSB";
  const priceData = await fetchTokenPrice(token);

  let extraContext = `Token Price Data:\n${priceData}\n`;
  if (wallet) {
    const balanceNote = (context as Record<string, unknown>)?.balanceNote || "Balance info from mission context";
    extraContext += `Wallet: ${wallet}\nBalance Note: ${balanceNote}\n`;
  }

  // Pull Telegram creds from MCP if not in local env
  const tgCreds = await mcp.telegramCredentials();
  const anthropicKey = process.env.ANTHROPIC_API_KEY || await mcp.anthropicKey();
  if (tgCreds) {
    process.env.TELEGRAM_BOT_TOKEN = tgCreds.botToken;
    process.env.TELEGRAM_CHANNEL_ID = tgCreds.channelId;
  }

  if (!anthropicKey) {
    const fallbackResult = `[Alert Fallback — no API key]\n\n${extraContext}\n--- TELEGRAM ALERT ---\n*$${token} Alert* 🚨\n${priceData}\nMonitor via GSB Alert Manager\n#AgentGasBible #Base\n\n--- X DM COPY ---\n🚨 $${token} price update: ${priceData}. Powered by GSB Alert Manager. #AgentGasBible`;

    // Telegram sent by cron handler only
    return { result: fallbackResult, usdcEarned: 0.01 };
  }

  const messageText = await callModel('alert', SYSTEM_PROMPT, `${extraContext}\nContext: ${JSON.stringify(context || {})}\n\nMission: ${mission}`);

  const result = messageText;

  // NOTE: Telegram is sent by the cron handler (heartbeat/route.ts), not here.
  // This prevents duplicates when called from both cron and direct dispatch.

  return { result, usdcEarned: 0.01 };
}
