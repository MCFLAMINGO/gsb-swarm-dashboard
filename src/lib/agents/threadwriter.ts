/**
 * GSB Thread Writer Agent
 * Powered by the GSB Content Engine
 *
 * Writes X/Twitter threads for ANY company/brand — not just $GSB.
 * Optionally posts the full thread as a reply chain via X API v2.
 */

import { callModel } from "@/lib/modelRouter";
import { mcp } from "@/lib/mcp";
import crypto from "crypto";

const GSB_TOKEN_CA = "0x8E223841aA396d36a6727EfcEAFC61d691692a37";

const SYSTEM_PROMPT = `You are the GSB Thread Writer — an elite X/Twitter thread architect.

You write threads for whatever brand/company/product the mission specifies.
Adapt tone to the brand. Do NOT force $GSB or crypto into non-GSB threads.

You write threads that:
- Hook in tweet 1 (max 240 chars, standalone power statement)
- Build a narrative arc across 5-12 tweets
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
- When covering bleeding.cash: restaurant pain, speed, $24.95 price, link https://www.bleeding.cash — NEVER mention $GSB/crypto
- When covering $GSB / Agent Gas Bible: Web3-native, bold, Base chain, Virtuals Protocol. Include contract ${GSB_TOKEN_CA} near the end
- When covering ANY OTHER company: stay on-brand, use their URL/CTA if provided, never inject $GSB or bleeding.cash
- NEVER ask questions back or request more info — write the thread from what you have`;

interface ThreadWriterInput {
  mission: string;
  context?: Record<string, unknown>;
}

interface ThreadWriterResult {
  result: string;
  usdcEarned: number;
}

interface BrandContext {
  name: string;
  website?: string;
  voice: string;
  kind: "gsb" | "bleeding" | "custom";
}

interface XKeys {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

function signOAuth1(
  method: string,
  url: string,
  keys: XKeys,
  extraParams: Record<string, string> = {}
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: keys.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: keys.accessToken,
    oauth_version: "1.0",
  };
  const allParams = { ...oauth, ...extraParams };
  const sortedParams = Object.keys(allParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join("&");
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(keys.apiSecret)}&${encodeURIComponent(keys.accessTokenSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
  const headerParams: Record<string, string> = { ...oauth, oauth_signature: signature };
  return (
    "OAuth " +
    Object.keys(headerParams)
      .map((k) => `${k}="${encodeURIComponent(headerParams[k])}"`)
      .join(", ")
  );
}

async function getAudienceIntel(url: string): Promise<string> {
  try {
    const res = await fetch(
      "https://gsb-swarm-production.up.railway.app/api/content/analyze-audience",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, walletAddress: "thread-writer-agent" }),
        signal: AbortSignal.timeout(12_000),
      }
    );
    if (!res.ok) return "";
    const data = await res.json();
    if (!data.ok) return "";
    const a = data.primaryAudience;
    return `Audience: ${a?.demographics} | Pain points: ${a?.painPoints?.join(", ")} | Tone: ${data.contentStrategy?.tone}`;
  } catch {
    return "";
  }
}

async function humanizeThread(text: string): Promise<string> {
  try {
    const res = await fetch(
      "https://gsb-swarm-production.up.railway.app/api/content/humanize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, intensity: "light" }),
        signal: AbortSignal.timeout(12_000),
      }
    );
    if (!res.ok) return text;
    const data = await res.json();
    return data.ok ? data.humanized || text : text;
  } catch {
    return text;
  }
}

async function applyVoice(text: string, voiceProfile: string): Promise<string> {
  try {
    const res = await fetch(
      "https://gsb-swarm-production.up.railway.app/api/content/rewrite-voice",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceProfile }),
        signal: AbortSignal.timeout(12_000),
      }
    );
    if (!res.ok) return text;
    const data = await res.json();
    return data.ok ? data.rewritten || text : text;
  } catch {
    return text;
  }
}

function detectBrand(mission: string, context?: Record<string, unknown>): BrandContext {
  const lower = mission.toLowerCase();

  const ctxCompany =
    (typeof context?.company === "string" && context.company) ||
    (typeof context?.brand === "string" && context.brand) ||
    (typeof context?.client === "string" && context.client) ||
    null;
  const ctxWebsite =
    (typeof context?.website === "string" && context.website) ||
    (typeof context?.url === "string" && context.url) ||
    (typeof context?.site === "string" && context.site) ||
    null;
  const ctxVoice =
    (typeof context?.voice === "string" && context.voice) || null;

  const companyMatch =
    mission.match(/(?:company|brand|client|for)\s*[:\-]\s*([^\n|,]+)/i) ||
    mission.match(/write (?:a |an )?(?:thread|post|tweets?) (?:for|about)\s+([A-Z][\w&.\- ]{1,40})/);
  const urlMatch = mission.match(/https?:\/\/[^\s)]+/i);
  const voiceMatch = mission.match(/voice[:\s]+(\w+)/i);

  if (
    lower.includes("bleeding") ||
    (lower.includes("restaurant") && !ctxCompany && !companyMatch)
  ) {
    return {
      name: "bleeding.cash",
      website: "https://www.bleeding.cash",
      voice: voiceMatch?.[1] || ctxVoice || "gsb_default",
      kind: "bleeding",
    };
  }

  if (
    lower.includes("gsb") ||
    lower.includes("agent gas bible") ||
    lower.includes("raiders of the chain") ||
    lower.includes("$gsb")
  ) {
    return {
      name: "$GSB / Agent Gas Bible",
      website: "https://www.raidersofthechain.com",
      voice: voiceMatch?.[1] || ctxVoice || "web3_degen",
      kind: "gsb",
    };
  }

  const name = (ctxCompany || companyMatch?.[1] || "the brand").trim();
  const website = ctxWebsite || urlMatch?.[0];
  return {
    name,
    website,
    voice: voiceMatch?.[1] || ctxVoice || "gsb_default",
    kind: "custom",
  };
}

function shouldPost(mission: string, context?: Record<string, unknown>): boolean {
  const lower = mission.toLowerCase();
  if (context?.post === false || context?.dryRun === true || context?.dry_run === true) {
    return false;
  }
  if (context?.post === true || context?.publish === true) return true;
  if (/\b(dry[- ]?run|draft only|do not post|don't post|no post)\b/i.test(lower)) {
    return false;
  }
  // Default: write + post unless explicitly told not to
  return true;
}

function extractTweets(thread: string): string[] {
  const lines = thread
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const numbered = lines
    .filter((l) => /^\d+\//.test(l))
    .map((l) => l.replace(/^\d+\/\s*/, "").slice(0, 280));

  if (numbered.length >= 2) return numbered;

  // Fallback: split long paragraphs into tweet-sized chunks
  return lines
    .filter((l) => l.length >= 20 && !l.startsWith("#"))
    .map((l) => l.slice(0, 280))
    .slice(0, 12);
}

async function postTweetToX(
  text: string,
  keys: XKeys,
  replyToId?: string
): Promise<{ id: string; url: string } | null> {
  if (!keys.apiKey || !keys.accessToken) return null;
  try {
    const url = "https://api.twitter.com/2/tweets";
    const auth = signOAuth1("POST", url, keys);
    const body: Record<string, unknown> = { text: text.slice(0, 280) };
    if (replyToId) {
      body.reply = { in_reply_to_tweet_id: replyToId };
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("[threadwriter] X post failed:", res.status, errText.slice(0, 200));
      return null;
    }
    const data = await res.json();
    const id = data.data?.id as string | undefined;
    if (!id) return null;
    return { id, url: `https://x.com/i/status/${id}` };
  } catch (e) {
    console.error("[threadwriter] postTweetToX error:", e);
    return null;
  }
}

async function postViaRailway(text: string): Promise<string | null> {
  try {
    const railwayRes = await fetch(
      "https://gsb-swarm-production.up.railway.app/api/tweet",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gsb-token": "gsb-dispatch-2026",
        },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(15_000),
      }
    );
    const railwayData = await railwayRes.json();
    return railwayData.url || null;
  } catch {
    return null;
  }
}

async function postFullThread(
  tweets: string[],
  keys: XKeys | null
): Promise<{ urls: string[]; note: string }> {
  if (!tweets.length) return { urls: [], note: "No tweets to post" };

  // Prefer direct X API (supports reply chains). Railway only posts a single tweet.
  if (keys?.apiKey && keys.apiSecret && keys.accessToken && keys.accessTokenSecret) {
    const urls: string[] = [];
    let replyTo: string | undefined;
    for (const tweet of tweets) {
      const posted = await postTweetToX(tweet, keys, replyTo);
      if (!posted) {
        return {
          urls,
          note:
            urls.length > 0
              ? `Partial post — failed after tweet ${urls.length}/${tweets.length}`
              : "X API post failed — check X_API_KEY / tokens",
        };
      }
      urls.push(posted.url);
      replyTo = posted.id;
      // Small delay to avoid burst rate limits
      await new Promise((r) => setTimeout(r, 800));
    }
    return { urls, note: `Posted full ${urls.length}-tweet thread` };
  }

  // Fallback: Railway single-tweet (credentials may be incomplete for direct OAuth)
  const url = await postViaRailway(tweets[0]);
  if (url) {
    return {
      urls: [url],
      note: "Posted hook via Railway only (full thread needs X_API_KEY on MCP/Vercel)",
    };
  }
  return {
    urls: [],
    note:
      "X credentials incomplete — set env:X_API_KEY (+ secret/token/token_secret) on Railway MCP or Vercel to enable posting",
  };
}

export async function runThreadWriter({
  mission,
  context,
}: ThreadWriterInput): Promise<ThreadWriterResult> {
  const creds = await mcp.xCredentials();
  const anthropicKey = process.env.ANTHROPIC_API_KEY || (await mcp.anthropicKey());
  const brand = detectBrand(mission, context);
  const postRequested = shouldPost(mission, context);

  if (!anthropicKey) {
    const fallback =
      brand.kind === "bleeding"
        ? `1/ The restaurant industry loses $100B+ per year to food cost and labor waste.\n\n2/ Most owners don't know where it's going.\n\n3/ bleeding.cash finds it in 3 minutes.\n\n4/ Upload statements. Get the burn report + vendor + loan letters.\n\n5/ Start here → https://www.bleeding.cash`
        : brand.kind === "gsb"
          ? `1/ AI agents don't need salaries. They need compute credit.\n\n2/ $GSB is the tokenized compute bank on Base — agents borrow, earn USDC, deposit back.\n\n3/ Live on Virtuals Protocol ACP right now.\n\n4/ Contract: ${GSB_TOKEN_CA}\n\n5/ Hire the swarm → https://app.virtuals.io/acp`
          : `1/ ${brand.name} has a story worth telling — most people just haven't heard it yet.\n\n2/ Here's what matters in plain English.\n\n3/ The problem is real. The solution is shippable.\n\n4/ If this is your audience, lean in.\n\n5/ ${brand.website ? `Start here → ${brand.website}` : "Want the full thread? Dispatch Thread Writer with company + website."}`;

    return { result: `[Thread Writer — no API key]\n\n${fallback}`, usdcEarned: 0.1 };
  }

  let audienceIntel = "";
  if (brand.website) audienceIntel = await getAudienceIntel(brand.website);

  let groundedData = "";
  if (brand.kind === "gsb") {
    try {
      const tokenRes = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${GSB_TOKEN_CA}`,
        { signal: AbortSignal.timeout(8_000) }
      );
      if (tokenRes.ok) {
        const td = await tokenRes.json();
        const pair = td.pairs?.[0];
        if (pair) {
          groundedData = `$GSB Price: $${parseFloat(pair.priceUsd || "0").toFixed(8)} | 24h Change: ${pair.priceChange?.h24 || "0"}% | Contract: ${GSB_TOKEN_CA}`;
        }
      }
    } catch {
      groundedData = `$GSB Contract on Base: ${GSB_TOKEN_CA}`;
    }
  }

  const brandBrief = [
    `Brand: ${brand.name}`,
    brand.website ? `Website: ${brand.website}` : null,
    `Brand kind: ${brand.kind}`,
    audienceIntel || null,
    groundedData || null,
  ]
    .filter(Boolean)
    .join("\n");

  const rawThread = await callModel(
    "thread-writer",
    SYSTEM_PROMPT,
    `Write a compelling 7-10 tweet thread for ${brand.name}.\n\n${brandBrief}\n\nMission: ${mission}\n\nAdditional context: ${JSON.stringify(context || {})}`,
    anthropicKey || undefined
  );

  let finalThread = rawThread;
  if (brand.voice && brand.voice !== "gsb_default") {
    finalThread = await applyVoice(rawThread, brand.voice);
  }
  finalThread = await humanizeThread(finalThread);

  const tweets = extractTweets(finalThread);
  let postFooter = "";

  if (postRequested) {
    const xKeys =
      creds ||
      (process.env.X_API_KEY
        ? {
            apiKey: process.env.X_API_KEY,
            apiSecret: process.env.X_API_SECRET || "",
            accessToken: process.env.X_ACCESS_TOKEN || "",
            accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET || "",
          }
        : null);

    const { urls, note } = await postFullThread(tweets, xKeys);
    if (urls.length) {
      postFooter = `\n\n✅ ${note}\n${urls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`;
    } else {
      postFooter = `\n\n⚠️ Not posted: ${note}`;
    }
  } else {
    postFooter = "\n\n📝 Draft only — posting skipped (dry-run / do not post).";
  }

  return {
    result: `${finalThread}${postFooter}`,
    usdcEarned: 0.15,
  };
}
