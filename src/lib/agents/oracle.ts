import { callModel } from '@/lib/modelRouter';
import { mcp } from '@/lib/mcp';

const SYSTEM_PROMPT = `You are the GSB Compute Oracle. You provide instant micro-quotes for compute resources on the Agent Gas Bible network. You fetch real DeFi data and translate it into compute cost estimates.

When given market data, incorporate it into your compute pricing analysis. Express costs in GFLOPS and USD equivalents. Be concise and data-driven.

Always mention $GSB and the Agent Gas Bible compute bank.`;

interface OracleInput {
  mission: string;
  context?: Record<string, unknown>;
}

interface OracleResult {
  result: string;
  usdcEarned: number;
}

async function fetchMarketData(): Promise<string> {
  try {
    const [geckoRes, llamaRes] = await Promise.allSettled([
      fetch("https://api.geckoterminal.com/api/v2/networks/base/trending_pools?page=1"),
      fetch("https://api.llama.fi/tvl/base"),
    ]);

    let marketInfo = "";

    if (geckoRes.status === "fulfilled" && geckoRes.value.ok) {
      const data = await geckoRes.value.json();
      const pools = data?.data?.slice(0, 5) || [];
      const topTokens = pools.map((p: Record<string, unknown>) => {
        const attrs = p.attributes as Record<string, unknown> | undefined;
        const vol = (attrs?.volume_usd as Record<string, unknown> | undefined)?.h24;
        return `${attrs?.name}: $${Number(attrs?.base_token_price_usd || 0).toFixed(4)} (Vol: $${Number(vol || 0).toLocaleString()})`;
      }).join("\n");
      marketInfo += `Top 5 Base Trending Pools:\n${topTokens}\n\n`;
    }

    if (llamaRes.status === "fulfilled" && llamaRes.value.ok) {
      const tvl = await llamaRes.value.json();
      marketInfo += `Base Network TVL: $${Number(tvl).toLocaleString()}\n`;
    }

    return marketInfo || "Market data temporarily unavailable.";
  } catch {
    return "Market data temporarily unavailable.";
  }
}

export async function runOracle({ mission, context }: OracleInput): Promise<OracleResult> {
  const marketData = await fetchMarketData();

  // Pull key from MCP if not set locally
  const anthropicKey = process.env.ANTHROPIC_API_KEY || await mcp.anthropicKey();

  if (!anthropicKey) {
    return {
      result: `[Oracle Fallback — no API key]\n\n${marketData}\n\nCompute Quote: Based on current Base network activity, estimated compute cost is 0.0015 USDC/GFLOP. GSB bank rate: 0.002 USDC per quote. $GSB tokenized compute bank is operational.`,
      usdcEarned: 0.002,
    };
  }

  const messageText = await callModel('oracle', SYSTEM_PROMPT, `Market Data:\n${marketData}\n\nContext: ${JSON.stringify(context || {})}\n\nMission: ${mission}`, anthropicKey);

  const result = messageText;

  return { result, usdcEarned: 0.002 };
}
