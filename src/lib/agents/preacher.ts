import { callModel } from '@/lib/modelRouter';
import { mcp } from '@/lib/mcp';
import crypto from "crypto";

const SYSTEM_PROMPT = `You are the GSB Marketing Preacher. You write viral crypto content for $GSB (Agent Gas Bible) — the tokenized compute bank on Base. Your voice is bold, Web3-native, and punchy.

You write for X/Twitter, Instagram, Facebook, Bluesky, and Reddit. Adapt your style to each platform:
- X/Twitter: punchy threads, max 280 chars per tweet, use line breaks
- Instagram: visual caption style with emojis and hashtag blocks
- Facebook: longer form, community-oriented
- Bluesky: concise, 300 char max
- Reddit: informative, less hype, more substance

Always include $GSB, #AgentGasBible, #Base hashtags where appropriate for the platform.
Always hype the Agent Gas Bible tokenized compute bank concept.`;

interface PreacherInput {
  mission: string;
  context?: Record<string, unknown>;
}

interface PreacherResult {
  result: string;
  usdcEarned: number;
}

function detectPlatform(mission: string): string {
  const lower = mission.toLowerCase();
  if (lower.includes("instagram") || lower.includes("ig")) return "Instagram";
  if (lower.includes("facebook") || lower.includes("fb")) return "Facebook";
  if (lower.includes("bluesky") || lower.includes("bsky")) return "Bluesky";
  if (lower.includes("reddit")) return "Reddit";
  return "X/Twitter";
}

function signOAuth1(method: string, url: string): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: process.env.X_API_KEY || "",
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.X_ACCESS_TOKEN || "",
    oauth_version: "1.0",
  };
  const sortedParams = Object.keys(oauth)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`)
    .join("&");
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(process.env.X_API_SECRET || "")}&${encodeURIComponent(process.env.X_ACCESS_TOKEN_SECRET || "")}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
  const headerParams = { ...oauth, oauth_signature: signature };
  return (
    "OAuth " +
    Object.keys(headerParams)
      .map((k) => `${k}="${encodeURIComponent((headerParams as Record<string, string>)[k])}"`)
      .join(", ")
  );
}

async function postTweetToX(text: string): Promise<string | null> {
  if (!process.env.X_API_KEY || !process.env.X_ACCESS_TOKEN) return null;
  try {
    const url = "https://api.twitter.com/2/tweets";
    const auth = signOAuth1("POST", url);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 280) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.id
      ? `https://x.com/ErikOsol43597/status/${data.data.id}`
      : null;
  } catch {
    return null;
  }
}

export async function runPreacher({ mission, context }: PreacherInput): Promise<PreacherResult> {
  const platform = detectPlatform(mission);

  // Pull keys from MCP if not in local env
  const creds = await mcp.xCredentials();
  const anthropicKey = process.env.ANTHROPIC_API_KEY || await mcp.anthropicKey();

  if (!anthropicKey) {
    return {
      result: `[Preacher Fallback — no API key]\n\nPlatform: ${platform}\n\n🔥 $GSB is the COMPUTE BANK for AI agents on Base.\n\nAgents don't just chat — they BORROW compute, EARN USDC, and DEPOSIT back to treasury.\n\nThis is DeFi for machine intelligence.\n\n$GSB #AgentGasBible #Base #DeFi #AI`,
      usdcEarned: 0.05,
    };
  }

  // Fetch real GSB swarm stats before writing
  let realStats = '';
  try {
    const statsRes = await fetch('https://gsb-swarm-production.up.railway.app/api/public');
    if (statsRes.ok) {
      const stats = await statsRes.json();
      realStats = `Real GSB Stats: ${stats.agentCount || 4} graduated agents on Virtuals Protocol. Status: ${stats.status || 'ONLINE'}.`;
    }
  } catch { realStats = 'GSB Swarm: 4 graduated agents on Virtuals Protocol (Base chain).'; }

  // Fetch real $GSB token data
  let tokenData = '';
  try {
    const tokenRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x6dA1A9793Ebe96975c240501A633ab8B3c83D14A');
    if (tokenRes.ok) {
      const td = await tokenRes.json();
      const pair = td.pairs?.[0];
      if (pair) {
        const price = parseFloat(pair.priceUsd || '0').toFixed(8);
        const vol = Number(pair.volume?.h24 || 0).toLocaleString();
        const chg = pair.priceChange?.h24 || '0';
        tokenData = `$GSB Price: $${price} | 24h Vol: $${vol} | 24h Change: ${chg}%`;
      }
    }
  } catch { tokenData = ''; }

  const groundedContext = [realStats, tokenData].filter(Boolean).join('\n');

  const messageText = await callModel('preacher', SYSTEM_PROMPT, `Platform: ${platform}\nReal Data (USE THESE NUMBERS ONLY — do not invent stats):\n${groundedContext}\n\nContext: ${JSON.stringify(context || {})}\n\nMission: ${mission}`, anthropicKey || undefined);

  const result = messageText;

  // Auto-post first tweet — use MCP creds if local env empty
  let tweetUrl: string | null = null;
  const xKey = creds?.apiKey || process.env.X_API_KEY;
  if (xKey) {
    // Temporarily set env vars from MCP for signOAuth1
    if (creds) {
      process.env.X_API_KEY = creds.apiKey;
      process.env.X_API_SECRET = creds.apiSecret;
      process.env.X_ACCESS_TOKEN = creds.accessToken;
      process.env.X_ACCESS_TOKEN_SECRET = creds.accessTokenSecret;
    }
    const firstTweet = result.split("\n\n")[0]?.slice(0, 280);
    if (firstTweet) tweetUrl = await postTweetToX(firstTweet);
  }

  return {
    result: tweetUrl ? `${result}\n\n✅ Posted to X: ${tweetUrl}` : result,
    usdcEarned: 0.05,
  };
}
