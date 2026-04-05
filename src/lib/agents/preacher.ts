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

function signOAuth1(
  method: string,
  url: string,
  keys: { apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string }
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: keys.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: keys.accessToken,
    oauth_version: "1.0",
  };
  const sortedParams = Object.keys(oauth)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`)
    .join("&");
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(keys.apiSecret)}&${encodeURIComponent(keys.accessTokenSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
  const headerParams = { ...oauth, oauth_signature: signature };
  return (
    "OAuth " +
    Object.keys(headerParams)
      .map((k) => `${k}="${encodeURIComponent((headerParams as Record<string, string>)[k])}"`)
      .join(", ")
  );
}

async function postTweetToX(
  text: string,
  keys: { apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string }
): Promise<string | null> {
  if (!keys.apiKey || !keys.accessToken) return null;
  try {
    const url = "https://api.twitter.com/2/tweets";
    const auth = signOAuth1("POST", url, keys);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 280) }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('[preacher] X post failed:', res.status, errText.slice(0, 200));
      return null;
    }
    const data = await res.json();
    return data.data?.id
      ? `https://x.com/ErikOsol43597/status/${data.data.id}`
      : null;
  } catch (e) {
    console.error('[preacher] postTweetToX error:', e);
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

  // Auto-post first tweet — pass creds directly, no process.env mutation
  let tweetUrl: string | null = null;
  const xKeys = creds || (
    process.env.X_API_KEY ? {
      apiKey: process.env.X_API_KEY,
      apiSecret: process.env.X_API_SECRET || '',
      accessToken: process.env.X_ACCESS_TOKEN || '',
      accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET || '',
    } : null
  );
  if (xKeys?.apiKey) {
    // Extract first tweet (up to first double newline, max 280 chars)
    const lines = result.split('\n').filter((l: string) => l.trim());
    const firstTweet = lines[0]?.slice(0, 280);
    if (firstTweet) {
      console.log('[preacher] Posting to X:', firstTweet.slice(0, 60) + '...');
      tweetUrl = await postTweetToX(firstTweet, xKeys);
      console.log('[preacher] Tweet result:', tweetUrl || 'FAILED');
    }
  } else {
    console.warn('[preacher] No X credentials available — skipping post');
  }

  return {
    result: tweetUrl ? `${result}\n\n✅ Posted to X: ${tweetUrl}` : result,
    usdcEarned: 0.05,
  };
}
