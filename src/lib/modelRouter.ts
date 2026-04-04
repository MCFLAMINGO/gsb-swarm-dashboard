/**
 * Model Router — routes agents to cheapest appropriate model
 * via Vercel AI Gateway when AI_GATEWAY_API_KEY is set,
 * otherwise falls back to direct Anthropic (ANTHROPIC_API_KEY).
 *
 * Cost targets (input/output per 1M tokens):
 *   oracle   → gemini-2.5-flash-lite  $0.10/$0.40  (status, analysis)
 *   alert    → grok-4.1-fast          $0.20/$0.50  (alerts, fast)
 *   onboarding → grok-4.1-fast        $0.20/$0.50  (onboarding chat)
 *   preacher → claude-sonnet-4.6      $3.00/$15    (content quality matters)
 */

export type AgentModel = {
  provider: 'anthropic' | 'openai' | 'gateway'
  model: string
  maxTokens: number
}

const GATEWAY_BASE = 'https://gateway.ai.cloudflare.com/v1' // Vercel AI Gateway endpoint

export function getModelForAgent(agentId: string): AgentModel {
  const useGateway = !!process.env.AI_GATEWAY_API_KEY

  if (!useGateway) {
    // Fallback: all agents use Haiku (already cheap)
    return { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', maxTokens: 1500 }
  }

  // Gateway routing — cheapest model per agent
  switch (agentId) {
    case 'oracle':
      return { provider: 'gateway', model: 'google/gemini-2.5-flash-lite', maxTokens: 1500 }
    case 'alert':
      return { provider: 'gateway', model: 'xai/grok-4.1-fast-non-reasoning', maxTokens: 800 }
    case 'onboarding':
      return { provider: 'gateway', model: 'xai/grok-4.1-fast-non-reasoning', maxTokens: 1000 }
    case 'preacher':
      return { provider: 'gateway', model: 'anthropic/claude-sonnet-4.6', maxTokens: 2000 }
    default:
      return { provider: 'gateway', model: 'google/gemini-2.5-flash-lite', maxTokens: 1000 }
  }
}

export async function callModel(agentId: string, systemPrompt: string, userPrompt: string, overrideApiKey?: string): Promise<string> {
  const { provider, model, maxTokens } = getModelForAgent(agentId)
  const gatewayKey = process.env.AI_GATEWAY_API_KEY
  const anthropicKey = overrideApiKey || process.env.ANTHROPIC_API_KEY

  if (provider === 'gateway' && gatewayKey) {
    // Vercel AI Gateway — OpenAI-compatible endpoint
    const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gateway error: ${res.status} ${err}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  }

  // Fallback: direct Anthropic
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: anthropicKey })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  })
  return (msg.content[0] as { text: string }).text || ''
}
