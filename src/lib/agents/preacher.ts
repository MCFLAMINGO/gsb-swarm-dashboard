import { callModel } from '@/lib/modelRouter';
import { mcp } from '@/lib/mcp';
import crypto from "crypto";

const SYSTEM_PROMPT = `You are a viral marketing copywriter and content strategist powered by the GSB Content Engine.

Adapt your style to the platform:
- X/Twitter: punchy, emotional, 240 chars max for the FIRST tweet so it stands alone as a hook. Write full post content, not just a title line.
- Instagram: visual caption style with emojis and hashtag blocks
- Facebook: longer form, community-oriented
- Bluesky: concise, 300 char max
- Reddit: informative, less hype, more substance

IMPORTANT RULES:
1. When writing about bleeding.cash: focus entirely on the pain of restaurants losing money, the speed of the triage, and the $24.95 price. Do NOT mention $GSB, crypto, or Web3 unless explicitly asked. ALWAYS link to https://www.bleeding.cash (with www) — never use http://bleeding.cash without www.
2. When writing about $GSB or Agent Gas Bible: be bold and Web3-native, include $GSB #AgentGasBible #Base hashtags.
3. Write ACTUAL CONTENT with substance, not just a title line. The first tweet should be the complete hook with the full emotional argument.
4. Never start with hashtags. Lead with the human problem or the bold claim.
5. When audience intelligence is provided, use it to speak directly to that audience's pain points and language.`;

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

// Detect which brand/site the mission is about
function detectBrandUrl(mission: string): string | null {
  if (mission.toLowerCase().includes('bleeding.cash') || mission.toLowerCase().includes('restaurant')) {
    return 'https://www.bleeding.cash';
  }
  if (mission.toLowerCase().includes('gsb') || mission.toLowerCase().includes('agent gas bible') || mission.toLowerCase().includes('raiders')) {
    return 'https://www.raidersofthechain.com';
  }
  return null;
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

// Fetch audience intelligence from content engine
async function getAudienceIntel(url: string): Promise<string> {
  try {
    const res = await fetch('https://gsb-swarm-production.up.railway.app/api/content/analyze-audience', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, walletAddress: 'preacher-agent' }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    if (!data.ok) return '';
    const a = data.primaryAudience;
    return `Audience Intel for ${url}:
- Demographics: ${a?.demographics || 'unknown'}
- Pain points: ${a?.painPoints?.join(', ') || 'none'}
- Goals: ${a?.goals?.join(', ') || 'none'}
- Awareness level: ${a?.awarenessLevel || 'unknown'}
- Trust sources: ${data.trustSources?.join(', ') || 'none'}
- Tone: ${data.contentStrategy?.tone || 'neutral'}`;
  } catch {
    return '';
  }
}

// Humanize post via content engine
async function humanizePost(text: string): Promise<string> {
  try {
    const res = await fetch('https://gsb-swarm-production.up.railway.app/api/content/humanize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, intensity: 'medium' }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.ok ? (data.humanized || text) : text;
  } catch {
    return text;
  }
}

export async function runPreacher({ mission, context }: PreacherInput): Promise<PreacherResult> {
  const platform = detectPlatform(mission);
  const brandUrl = detectBrandUrl(mission);

  // Pull keys from MCP if not in local env
  const creds = await mcp.xCredentials();
  const anthropicKey = process.env.ANTHROPIC_API_KEY || await mcp.anthropicKey();

  if (!anthropicKey) {
    return {
      result: `[Preacher Fallback — no API key]\n\nPlatform: ${platform}\n\n🔥 $GSB is the COMPUTE BANK for AI agents on Base.\n\nAgents don't just chat — they BORROW compute, EARN USDC, and DEPOSIT back to treasury.\n\nThis is DeFi for machine intelligence.\n\n$GSB #AgentGasBible #Base #DeFi #AI`,
      usdcEarned: 0.05,
    };
  }

  // Fetch real GSB swarm stats
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

  // Fetch audience intelligence for brand-specific posts
  let audienceIntel = '';
  if (brandUrl) {
    audienceIntel = await getAudienceIntel(brandUrl);
  }

  const groundedContext = [realStats, tokenData, audienceIntel].filter(Boolean).join('\n');

  const rawContent = await callModel(
    'preacher',
    SYSTEM_PROMPT,
    `Platform: ${platform}\nReal Data (USE THESE NUMBERS ONLY — do not invent stats):\n${groundedContext}\n\nContext: ${JSON.stringify(context || {})}\n\nMission: ${mission}`,
    anthropicKey || undefined
  );

  // Humanize the content so it doesn't read as AI-generated
  const result = await humanizePost(rawContent);

  // Auto-post first tweet
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
    const lines = result.split('\n').filter((l: string) => l.trim());
    const firstTweet = (
      lines.find((l: string) =>
        l.length >= 60 &&
        !l.match(/^#+\s/) &&
        !l.match(/^[A-Z\s$]+:?$/) &&
        !l.startsWith('#')
      ) || lines[0] || ''
    ).slice(0, 280);
    if (firstTweet) {
      console.log('[preacher] Posting via Railway tweet endpoint...');
      try {
        const railwayRes = await fetch('https://gsb-swarm-production.up.railway.app/api/tweet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-gsb-token': 'gsb-dispatch-2026' },
          body: JSON.stringify({ text: firstTweet }),
        });
        const railwayData = await railwayRes.json();
        if (railwayData.url) {
          tweetUrl = railwayData.url;
          console.log('[preacher] Posted via Railway:', tweetUrl);
        } else {
          tweetUrl = await postTweetToX(firstTweet, xKeys);
          console.log('[preacher] Posted directly:', tweetUrl || 'FAILED');
        }
      } catch {
        tweetUrl = await postTweetToX(firstTweet, xKeys);
      }
    }
  } else {
    console.warn('[preacher] No X credentials — skipping post');
  }

  return {
    result: tweetUrl ? `${result}\n\n✅ Posted to X: ${tweetUrl}` : result,
    usdcEarned: 0.05,
  };
}
