import Anthropic from "@anthropic-ai/sdk";

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

export async function runPreacher({ mission, context }: PreacherInput): Promise<PreacherResult> {
  const platform = detectPlatform(mission);

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      result: `[Preacher Fallback — no API key]\n\nPlatform: ${platform}\n\n🔥 $GSB is the COMPUTE BANK for AI agents on Base.\n\nAgents don't just chat — they BORROW compute, EARN USDC, and DEPOSIT back to treasury.\n\nThis is DeFi for machine intelligence.\n\n$GSB #AgentGasBible #Base #DeFi #AI`,
      usdcEarned: 0.05,
    };
  }

  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-3-5-haiku-latest",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Platform: ${platform}\nContext: ${JSON.stringify(context || {})}\n\nMission: ${mission}`,
      },
    ],
  });

  const result = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return { result, usdcEarned: 0.05 };
}
