import { callModel } from '@/lib/modelRouter';
import { mcp } from '@/lib/mcp';

const SYSTEM_PROMPT = `You are the GSB Compute Oracle. You analyze real compute token market data (AKT, RNDR, IO) alongside Base DEX activity to identify compute demand signals.

Your job:
1. Report real token prices and 24h changes for compute tokens (AKT, RNDR, IO/io.net)
2. Identify which Base DEX pools show the highest trading activity
3. Give a SIGNAL: which compute tokens show bullish momentum and why
4. Recommend whether the copy trader should be active or stand down

Be direct, data-driven, and specific. Use real numbers only — never invent prices or volumes.
Always include $GSB and the Agent Gas Bible compute bank context.`;

interface OracleInput {
  mission: string;
  context?: Record<string, unknown>;
}

interface OracleResult {
  result: string;
  usdcEarned: number;
  signal?: {
    action: 'BUY' | 'HOLD' | 'STANDBY';
    tokens: string[];
    reason: string;
    confidence: number;
  };
}

async function fetchComputeTokens(): Promise<string> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=akash-network,render-token,io-net&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true',
      { headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) return '';
    const data = await res.json();

    const format = (id: string, symbol: string) => {
      const d = data[id];
      if (!d) return '';
      const chg = d.usd_24h_change?.toFixed(2) ?? '0.00';
      const dir = Number(chg) >= 0 ? '📈' : '📉';
      return `${symbol}: $${d.usd?.toFixed(4)} ${dir} ${chg}% | Vol: $${Number(d.usd_24h_vol || 0).toLocaleString()}`;
    };

    const lines = [
      format('akash-network', 'AKT (Akash)'),
      format('render-token', 'RNDR (Render)'),
      format('io-net', 'IO (io.net)'),
    ].filter(Boolean);

    return lines.length ? `Compute Token Prices:\n${lines.join('\n')}` : '';
  } catch {
    return '';
  }
}

async function fetchBasePools(): Promise<string> {
  try {
    const res = await fetch('https://api.geckoterminal.com/api/v2/networks/base/trending_pools?page=1');
    if (!res.ok) return '';
    const data = await res.json();
    const pools = data?.data?.slice(0, 5) || [];
    const lines = pools.map((p: Record<string, unknown>) => {
      const attrs = p.attributes as Record<string, unknown> | undefined;
      const vol = (attrs?.volume_usd as Record<string, unknown> | undefined)?.h24;
      const chg = (attrs?.price_change_percentage as Record<string, unknown> | undefined)?.h24;
      const name = attrs?.name ?? 'Unknown';
      return `${name}: Vol $${Number(vol || 0).toLocaleString()} | 24h ${Number(chg || 0).toFixed(1)}%`;
    });
    return lines.length ? `Top 5 Base DEX Pools:\n${lines.join('\n')}` : '';
  } catch {
    return '';
  }
}

async function fetchSwarmStats(): Promise<string> {
  try {
    const res = await fetch('https://gsb-swarm-production.up.railway.app/api/public');
    if (!res.ok) return '';
    const data = await res.json();
    return `GSB Swarm Status: ${data.status || 'ONLINE'} | Agents: ${data.agentCount || 4} | Jobs completed: ${data.jobsCompleted || 0}`;
  } catch {
    return 'GSB Swarm: ONLINE | 4 graduated agents';
  }
}

export async function runOracle({ mission, context }: OracleInput): Promise<OracleResult> {
  // Fetch all data in parallel
  const [computeTokens, basePools, swarmStats] = await Promise.all([
    fetchComputeTokens(),
    fetchBasePools(),
    fetchSwarmStats(),
  ]);

  const marketData = [computeTokens, basePools, swarmStats].filter(Boolean).join('\n\n');

  // Pull key from MCP if not set locally
  const anthropicKey = process.env.ANTHROPIC_API_KEY || await mcp.anthropicKey();

  if (!anthropicKey) {
    return {
      result: `[Oracle — no API key]\n\n${marketData}`,
      usdcEarned: 0.002,
    };
  }

  const messageText = await callModel(
    'oracle',
    SYSTEM_PROMPT,
    `Real Market Data:\n${marketData}\n\nContext: ${JSON.stringify(context || {})}\n\nMission: ${mission}`,
    anthropicKey
  );

  // Parse a simple signal from the response
  const upper = messageText.toUpperCase();
  let action: 'BUY' | 'HOLD' | 'STANDBY' = 'HOLD';
  const tokens: string[] = [];
  if (upper.includes('BULLISH') || upper.includes('BUY') || upper.includes('STRONG')) action = 'BUY';
  if (upper.includes('STANDBY') || upper.includes('STAND DOWN') || upper.includes('BEARISH')) action = 'STANDBY';
  if (upper.includes('AKT')) tokens.push('AKT');
  if (upper.includes('RNDR')) tokens.push('RNDR');
  if (upper.includes('IO')) tokens.push('IO');

  return {
    result: messageText,
    usdcEarned: 0.002,
    signal: { action, tokens, reason: messageText.slice(0, 200), confidence: 0.7 },
  };
}
