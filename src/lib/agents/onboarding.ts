import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are the GSB Onboarding Broker. You onboard new agents and humans into the GSB ecosystem. You write personalized cold outreach emails, answer 'what is GSB' questions with full pitches, and walk developers through ACP integration.

GSB is a tokenized AI compute bank on Base — agents borrow compute credit, earn USDC, deposit back to treasury. The $GSB token powers the whole system.

Key facts:
- GSB runs on Virtuals Protocol ACP (Agent Commerce Protocol)
- Agents pay micro-fees (as low as $0.002) for compute quotes
- The x402 payment protocol handles instant micro-transactions
- Treasury address is on Base network
- Agents can subscribe for $2.99/month or pay per job

When writing emails, use a professional but Web3-native tone. Include clear CTAs.
When explaining GSB, be thorough but engaging.
When writing integration guides, be precise and developer-friendly.`;

interface OnboardingInput {
  mission: string;
  context?: Record<string, unknown>;
}

interface OnboardingResult {
  result: string;
  usdcEarned: number;
}

function detectMode(mission: string): "email" | "explain" | "integrate" | "general" {
  const lower = mission.toLowerCase();
  if (lower.includes("email") || lower.includes("outreach") || lower.includes("cold")) return "email";
  if (lower.includes("explain") || lower.includes("what is") || lower.includes("pitch")) return "explain";
  if (lower.includes("integrate") || lower.includes("acp") || lower.includes("setup") || lower.includes("developer")) return "integrate";
  return "general";
}

export async function runOnboarding({ mission, context }: OnboardingInput): Promise<OnboardingResult> {
  const mode = detectMode(mission);

  if (!process.env.ANTHROPIC_API_KEY) {
    const fallbacks: Record<string, string> = {
      email: `[Onboarding Fallback — no API key]\n\nSubject: Partner with GSB — AI Compute Bank on Base\n\nHi there,\n\nI'm reaching out from GSB (Agent Gas Bible) — we're building the tokenized compute bank for AI agents on Base.\n\nOur agents earn USDC by providing compute quotes, marketing, onboarding, and alerts — all via the Virtuals Protocol ACP.\n\nWould love to explore a partnership. Reply to chat?\n\nBest,\nGSB Onboarding Broker`,
      explain: `[Onboarding Fallback — no API key]\n\nGSB (Agent Gas Bible) is a tokenized AI compute bank on Base.\n\n• Agents borrow compute credit from the GSB treasury\n• They earn USDC by completing jobs (quotes, content, onboarding, alerts)\n• Earnings flow back to the treasury, growing the bank\n• $GSB token holders benefit from the growing compute economy\n\nIt's DeFi meets AI infrastructure — powered by Virtuals Protocol ACP and x402 micro-payments.`,
      integrate: `[Onboarding Fallback — no API key]\n\nACP Integration Guide:\n\n1. Register your agent at app.virtuals.io/acp\n2. Set your webhook URL to receive job assignments\n3. Implement POST /api/webhook to handle incoming jobs\n4. Return results via the callback URL\n5. Set up x402 payment endpoint for micro-transactions\n6. Configure your pricing ($0.002 - $0.25 per job)\n\nDocs: https://docs.virtuals.io/acp`,
      general: `[Onboarding Fallback — no API key]\n\nWelcome to GSB! The Agent Gas Bible is a tokenized compute bank for AI agents on Base. How can I help you get started?`,
    };

    return { result: fallbacks[mode], usdcEarned: 0.10 };
  }

  const client = new Anthropic();
  const modeHint = {
    email: "Write a personalized cold outreach email with subject line and body.",
    explain: "Write a full GSB pitch/explainer tailored to the audience.",
    integrate: "Write a step-by-step ACP integration guide for developers.",
    general: "Help the user with their GSB onboarding question.",
  }[mode];

  const message = await client.messages.create({
    model: "claude-3-5-haiku-latest",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Mode: ${mode}\nInstruction: ${modeHint}\nContext: ${JSON.stringify(context || {})}\n\nMission: ${mission}`,
      },
    ],
  });

  const result = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return { result, usdcEarned: 0.10 };
}
