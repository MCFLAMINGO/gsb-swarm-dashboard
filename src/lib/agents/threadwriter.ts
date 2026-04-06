/**
 * GSB Thread Writer Agent
 * Powered by the GSB Content Engine
 * Generates full X/Twitter threads with audience intelligence, humanization, and voice profiles
 */

import { callModel } from '@/lib/modelRouter';
import { mcp } from '@/lib/mcp';
import crypto from "crypto";

const SYSTEM_PROMPT = `You are the GSB Thread Writer — an elite X/Twitter thread architect.

You write threads that:
- Hook in tweet 1 (max 240 chars, standalone power statement)
- Build a narrative arc across 5-15 tweets
- Use each tweet as a standalone point that reinforces the whole
- End with a clear CTA and optional question for engagement
- Feel human, opinionated, and earned — not templated

FORMAT:
1/ [hook — the boldest claim or most painful truth]
2/ [context or setup]
3/ [proof point or story]
...
N/ [CTA + question]

RULES:
- Number every tweet (1/, 2/, etc.)
- Each tweet max 280 chars
- No markdown formatting in tweets
- No "thread 🧵" as the first word — start with the actual hook
- When covering bleeding.cash: restaurant pain, speed, $24.95 price, link https://www.bleeding.cash
- When covering $GSB: Web3-native, bold, Base chain, Virtuals Protocol
- Never mention $GSB when writing about bleeding.cash and vice versa`;

interface ThreadWriterInput {
  mission: string;
  context?: Record<string, unknown>;
}

interface ThreadWriterResult {
  result: string;
  usdcEarned: number;
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

// Fetch audience intelligence from content engine
async function getAudienceIntel(url: string): Promise<string> {
  try {
    const res = await fetch('https://gsb-swarm-production.up.railway.app/api/content/analyze-audience', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, walletAddress: 'thread-writer-agent' }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    if (!data.ok) return '';
    const a = data.primaryAudience;
    return `Audience: ${a?.demographics} | Pain points: ${a?.painPoints?.join(', ')} | Tone: ${data.contentStrategy?.tone}`;
  } catch { return ''; }
}

// Humanize via content engine
async function humanizeThread(text: string): Promise<string> {
  try {
    const res = await fetch('https://gsb-swarm-production.up.railway.app/api/content/humanize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, intensity: 'light' }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.ok ? (data.humanized || text) : text;
  } catch { return text; }
}

// Rewrite with voice profile
async function applyVoice(text: string, voiceProfile: string): Promise<string> {
  try {
    const res = await fetch('https://gsb-swarm-production.up.railway.app/api/content/rewrite-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceProfile }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return data.ok ? (data.rewritten || text) : text;
  } catch { return text; }
}

export async function runThreadWriter({ mission, context }: ThreadWriterInput): Promise<ThreadWriterResult> {
  const creds = await mcp.xCredentials();
  const anthropicKey = process.env.ANTHROPIC_API_KEY || await mcp.anthropicKey();

  if (!anthropicKey) {
    return {
      result: `[Thread Writer — no API key]\n\n1/ The restaurant industry loses $100B+ per year to food cost and labor waste.\n\n2/ Most owners don't know where it's going.\n\n3/ bleeding.cash finds it in 3 minutes.\n\nhttps://www.bleeding.cash`,
      usdcEarned: 0.10,
    };
  }

  // Detect brand context
  const lowerMission = mission.toLowerCase();
  const isBleeding = lowerMission.includes('bleeding') || lowerMission.includes('restaurant');
  const isGSB = lowerMission.includes('gsb') || lowerMission.includes('agent gas bible') || lowerMission.includes('raiders');

  // Get audience intel
  let audienceIntel = '';
  if (isBleeding) audienceIntel = await getAudienceIntel('https://www.bleeding.cash');
  else if (isGSB) audienceIntel = await getAudienceIntel('https://www.raidersofthechain.com');

  // Get real data
  let groundedData = '';
  if (isGSB) {
    try {
      const tokenRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x6dA1A9793Ebe96975c240501A633ab8B3c83D14A');
      if (tokenRes.ok) {
        const td = await tokenRes.json();
        const pair = td.pairs?.[0];
        if (pair) {
          groundedData = `$GSB Price: $${parseFloat(pair.priceUsd || '0').toFixed(8)} | 24h Change: ${pair.priceChange?.h24 || '0'}%`;
        }
      }
    } catch {}
  }

  const contextStr = [audienceIntel, groundedData].filter(Boolean).join('\n');

  const rawThread = await callModel(
    'thread-writer',
    SYSTEM_PROMPT,
    `Write a compelling 7-10 tweet thread.\n\n${contextStr ? `Context:\n${contextStr}\n\n` : ''}Mission: ${mission}\n\nAdditional context: ${JSON.stringify(context || {})}`,
    anthropicKey || undefined
  );

  // Detect voice preference from mission
  const voiceMatch = mission.match(/voice[:\s]+(\w+)/i);
  const voiceProfile = voiceMatch?.[1] || (isGSB ? 'web3_degen' : 'gsb_default');

  // Apply voice then humanize
  let finalThread = rawThread;
  if (voiceProfile !== 'gsb_default') {
    finalThread = await applyVoice(rawThread, voiceProfile);
  }
  finalThread = await humanizeThread(finalThread);

  // Post first tweet via Railway
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
    const lines = finalThread.split('\n').filter((l: string) => l.trim());
    const firstTweet = (
      lines.find((l: string) => l.match(/^1\//) || (l.length >= 40 && !l.startsWith('#'))) || lines[0] || ''
    ).replace(/^1\/\s*/, '').slice(0, 280);

    if (firstTweet) {
      try {
        const railwayRes = await fetch('https://gsb-swarm-production.up.railway.app/api/tweet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-gsb-token': 'gsb-dispatch-2026' },
          body: JSON.stringify({ text: firstTweet }),
        });
        const railwayData = await railwayRes.json();
        tweetUrl = railwayData.url || null;
      } catch {}
    }
  }

  return {
    result: tweetUrl ? `${finalThread}\n\n✅ Thread hook posted to X: ${tweetUrl}` : finalThread,
    usdcEarned: 0.10,
  };
}
