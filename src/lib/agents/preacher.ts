import { callModel } from '@/lib/modelRouter';
import { mcp } from '@/lib/mcp';
import crypto from "crypto";

const SYSTEM_PROMPT = `You are a viral content writer and strategist. You write for real audiences on real topics — not just one brand.

Adapt your style to the platform:
- X/Twitter: punchy, emotional, 240 chars max for the FIRST tweet so it stands alone as a hook. Write full post content, not just a title line.
- Instagram: visual caption style with emojis and hashtag blocks
- Facebook: longer form, community-oriented
- Bluesky: concise, 300 char max
- Reddit: informative, less hype, more substance

IMPORTANT RULES:
1. When writing about bleeding.cash: focus entirely on the pain of restaurants losing money, the speed of the triage, and the $24.95 price. Do NOT mention $GSB, crypto, or Web3 unless explicitly asked. ALWAYS link to https://www.bleeding.cash (with www).
2. When writing about $GSB or Agent Gas Bible: be bold and Web3-native, include $GSB #AgentGasBible #Base hashtags. ALWAYS include the contract address on Base: 0x8E223841aA396d36a6727EfcEAFC61d691692a37 — put it at the end of the post so people can find and buy it.
3. When writing about ANY OTHER TOPIC: write authentically about that topic. Do NOT force GSB or bleeding.cash in. Use the real data and context provided.
4. Write ACTUAL CONTENT with substance, not just a title line. The first tweet should be the complete hook with the full emotional argument.
5. Never start with hashtags. Lead with the human problem or the bold claim.
6. When real data is provided, use it. When audience intelligence is provided, speak directly to that audience's pain points.
7. NEVER ask questions or request more information. You are a writer, not a researcher. If you lack details, write boldly from what you DO know. Make a strong claim and back it up. A post that ships beats a perfect post that never gets written.
8. NEVER output a numbered list of questions. NEVER output a research brief. NEVER say "I need more info". Write the post — that is your ONLY job.`;

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
  keys: { apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string },
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
  const allParams = { ...extraParams, ...oauth };
  const sortedParams = Object.keys(allParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
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

// Search X/Twitter for recent tweets on a topic — gives Preacher real context
async function searchX(
  query: string,
  keys: { apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string }
): Promise<string> {
  try {
    const url = 'https://api.twitter.com/2/tweets/search/recent';
    const params = new URLSearchParams({
      query: query.slice(0, 80) + ' -is:retweet lang:en',
      max_results: '10',
      'tweet.fields': 'text,public_metrics,created_at',
    });
    const fullUrl = url + '?' + params.toString();
    const extraParams: Record<string, string> = {};
    params.forEach((v, k) => { extraParams[k] = v; });
    const auth = signOAuth1('GET', url, keys, extraParams);
    const res = await fetch(fullUrl, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn('[preacher] X search failed: ' + res.status);
      return '';
    }
    const data = await res.json();
    const tweets: Array<{ text: string; public_metrics?: { like_count: number; retweet_count: number } }> = data.data || [];
    if (!tweets.length) return '';
    const sorted = tweets
      .sort((a, b) =>
        ((b.public_metrics?.like_count || 0) + (b.public_metrics?.retweet_count || 0)) -
        ((a.public_metrics?.like_count || 0) + (a.public_metrics?.retweet_count || 0))
      )
      .slice(0, 5);
    const resultLines = sorted.map((t, i) => {
      const likes = t.public_metrics?.like_count || 0;
      const rts = t.public_metrics?.retweet_count || 0;
      return (i + 1) + '. "' + t.text.slice(0, 200) + '" (' + likes + ' likes ' + rts + ' rt)';
    });
    return 'Recent X conversation about "' + query.slice(0, 40) + '":\n' + resultLines.join('\n');
  } catch (e) {
    console.warn('[preacher] searchX error:', e);
    return '';
  }
}

// Detect topic type
function detectTopic(mission: string): 'gsb' | 'restaurant' | 'crypto' | 'general' {
  const m = mission.toLowerCase();
  if (m.includes('gsb') || m.includes('agent gas bible') || m.includes('raiders')) return 'gsb';
  if (m.includes('bleeding.cash') || m.includes('restaurant')) return 'restaurant';
  if (m.includes('bitcoin') || m.includes('btc') || m.includes('solana') || m.includes('sol') || m.includes('eth') || m.includes('crypto') || m.includes('defi') || m.includes('nft') || m.includes('token') || m.includes('pump') || m.includes('memecoin')) return 'crypto';
  return 'general';
}

// Fetch live crypto data for any token mentioned in mission
async function fetchCryptoContext(mission: string): Promise<string> {
  try {
    // Extract potential ticker symbols (1-6 uppercase letters preceded by $ or as standalone words)
    const tickers = mission.match(/\$([A-Z]{2,6})/g)?.map(t => t.slice(1)) || [];
    if (!tickers.length) {
      // Try common names
      const m = mission.toLowerCase();
      if (m.includes('bitcoin') || m.includes('btc')) tickers.push('BTC');
      if (m.includes('solana') || m.includes('sol')) tickers.push('SOL');
      if (m.includes('ethereum') || m.includes('eth')) tickers.push('ETH');
    }
    if (!tickers.length) return '';

    const results: string[] = [];
    for (const ticker of tickers.slice(0, 3)) {
      // Try DexScreener first for on-chain tokens
      const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${ticker}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const pair = data.pairs?.find((p: Record<string, unknown>) =>
          (p.baseToken as Record<string, string>)?.symbol?.toUpperCase() === ticker &&
          ((p.chainId as string) === 'solana' || (p.chainId as string) === 'ethereum' || (p.chainId as string) === 'base')
        ) || data.pairs?.[0];
        if (pair) {
          results.push(`$${ticker}: $${pair.priceUsd || '?'} | 24h vol: $${Number(pair.volume?.h24 || 0).toLocaleString()} | 24h chg: ${pair.priceChange?.h24 || '?'}% | chain: ${pair.chainId}`);
        }
      }
    }
    return results.join('\n');
  } catch {
    return '';
  }
}

// Fetch trending news/context for general topics via DexScreener trending or web search fallback
async function fetchGeneralContext(mission: string): Promise<string> {
  try {
    // Pull Solana trending tokens as general crypto context
    const res = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return '';
    const data = await res.json();
    const top = (Array.isArray(data) ? data : []).slice(0, 5).map((t: Record<string, string>) => t.symbol || t.tokenAddress?.slice(0, 8)).join(', ');
    return top ? `Trending tokens right now: ${top}` : '';
  } catch {
    return '';
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
  const topic = detectTopic(mission);

  // Pull keys from MCP if not in local env
  const creds = await mcp.xCredentials();
  const anthropicKey = process.env.ANTHROPIC_API_KEY || await mcp.anthropicKey();

  if (!anthropicKey) {
    return {
      result: `[Preacher Fallback — no API key]\n\nPlatform: ${platform}\n\n🔥 $GSB is the COMPUTE BANK for AI agents on Base.\n\nAgents don't just chat — they BORROW compute, EARN USDC, and DEPOSIT back to treasury.\n\nThis is DeFi for machine intelligence.\n\n$GSB #AgentGasBible #Base #DeFi #AI`,
      usdcEarned: 0.05,
    };
  }

  // Search X for real conversation context on the topic
  let xSearchContext = '';
  const searchKeys = creds || (process.env.X_API_KEY ? {
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET || '',
    accessToken: process.env.X_ACCESS_TOKEN || '',
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET || '',
  } : null);
  if (searchKeys?.apiKey) {
    // Build a search query from the mission — extract key nouns/tickers
    const searchQuery = mission.length > 80 ? mission.slice(0, 80) : mission;
    xSearchContext = await searchX(searchQuery, searchKeys);
    if (xSearchContext) console.log('[preacher] X search context fetched');
  }

  // Fetch grounded context based on topic type
  let groundedContext = '';

  if (topic === 'gsb') {
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

    // Fetch audience intel for Raiders/GSB
    const audienceIntel = brandUrl ? await getAudienceIntel(brandUrl) : '';
    groundedContext = [realStats, tokenData, audienceIntel].filter(Boolean).join('\n');

  } else if (topic === 'restaurant') {
    // Audience intel only — no crypto noise
    groundedContext = await getAudienceIntel('https://www.bleeding.cash');

  } else if (topic === 'crypto') {
    // Live DexScreener data for the token(s) mentioned
    groundedContext = await fetchCryptoContext(mission);

  } else {
    // General topic — trending tokens as ambient context
    groundedContext = await fetchGeneralContext(mission);
  }

  const rawContent = await callModel(
    'preacher',
    SYSTEM_PROMPT,
    `Platform: ${platform}\nReal Data (USE THESE NUMBERS ONLY — do not invent stats):\n${groundedContext}\n\n${xSearchContext ? `Live X conversation context (use to understand current sentiment and angles):\n${xSearchContext}\n\n` : ''}Context: ${JSON.stringify(context || {})}\n\nMission: ${mission}`,
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
    // Detect if output looks like a research brief / question list — don't post it
    const looksLikeResearchBrief = (
      lines.filter((l: string) => l.trim().endsWith('?')).length >= 2 ||
      lines.some((l: string) => /^(Look,|Here'?s what|I need|Give me|What is|What'?s|So here'?s|Before I|Can you|Tell me)/i.test(l.trim()))
    );

    const firstTweet = looksLikeResearchBrief ? '' : (
      lines.find((l: string) =>
        l.length >= 60 &&
        !l.trim().endsWith('?') &&
        !l.match(/^#+\s/) &&
        !l.match(/^[A-Z\s$]+:?$/) &&
        !l.startsWith('#') &&
        !/^(Look,|Here'?s what|I need|Give me|What is|So here'?s)/i.test(l.trim())
      ) || lines[0] || ''
    ).slice(0, 280);

    if (looksLikeResearchBrief) {
      console.warn('[preacher] Output looks like a research brief — skipping post');
    }
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
