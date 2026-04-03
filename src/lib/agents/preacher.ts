import { callModel } from '@/lib/modelRouter';
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      result: `[Preacher Fallback — no API key]\n\nPlatform: ${platform}\n\n🔥 $GSB is the COMPUTE BANK for AI agents on Base.\n\nAgents don't just chat — they BORROW compute, EARN USDC, and DEPOSIT back to treasury.\n\nThis is DeFi for machine intelligence.\n\n$GSB #AgentGasBible #Base #DeFi #AI`,
      usdcEarned: 0.05,
    };
  }

  const messageText = await callModel('preacher', SYSTEM_PROMPT, `Platform: ${platform}\nContext: ${JSON.stringify(context || {})}\n\nMission: ${mission}`);

  const result = messageText;

  // Auto-post first tweet if X is configured
  let tweetUrl: string | null = null;
  if (process.env.X_API_KEY) {
    const firstTweet = result.split("\n\n")[0]?.slice(0, 280);
    if (firstTweet) tweetUrl = await postTweetToX(firstTweet);
  }

  return {
    result: tweetUrl ? `${result}\n\n✅ Posted to X: ${tweetUrl}` : result,
    usdcEarned: 0.05,
  };
}
