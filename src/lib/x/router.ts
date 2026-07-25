/**
 * Route inbound X Activity events to GSB agents.
 * Keeps responses fast — heavy work is awaited but webhook already ACK'd.
 */

import { runAgent, type AgentId } from "@/lib/agents";
import { createJob, completeJob, failJob } from "@/lib/jobStore";
import type { NormalizedXEvent } from "@/lib/x/activity";

export interface RoutedResult {
  eventType: string;
  agentId: AgentId | null;
  jobId?: string;
  status: "routed" | "skipped" | "failed";
  detail?: string;
}

function mentionsUs(text?: string): boolean {
  if (!text) return false;
  return /@(agentgasbible|gsb|erik)/i.test(text);
}

function pickAgent(event: NormalizedXEvent): { agentId: AgentId; mission: string } | null {
  const t = event.type.toLowerCase();
  const text = event.text || "";

  // Mentions → Thread Writer drafts a reply (don't auto-post unless asked)
  if (
    t === "post.mention.create" ||
    (t === "post.create" && mentionsUs(text))
  ) {
    return {
      agentId: "thread_writer",
      mission: [
        "Someone mentioned us on X. Draft a sharp reply thread (3-5 tweets).",
        "Draft only — do not post.",
        event.fromUser ? `From: @${event.fromUser}` : null,
        event.postId ? `Post ID: ${event.postId}` : null,
        text ? `Their post: ${text.slice(0, 500)}` : null,
        "Company: Agent Gas Bible. Website: https://www.raidersofthechain.com",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  // Inbound likes / follows → Alert Manager
  if (t === "like.create") {
    return {
      agentId: "alert",
      mission: [
        "Generate a short Telegram + X engagement alert.",
        `Event: like.create${event.direction ? ` (${event.direction})` : ""}`,
        event.fromUser ? `User: @${event.fromUser}` : null,
        event.postId ? `Post: ${event.postId}` : null,
        "Keep it concise — engagement signal for $GSB / Agent Gas Bible.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (t === "follow.follow") {
    return {
      agentId: "onboarding",
      mission: [
        "A new user followed our X account. Write a short welcome DM + public reply suggestion.",
        event.fromUser ? `Handle: @${event.fromUser}` : null,
        "Explain GSB in 2 sentences and invite them to hire agents on Virtuals ACP.",
        "Do not invent fake links — use https://app.virtuals.io/acp and https://www.raidersofthechain.com",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  // DMs / chat → Onboarding
  if (t === "dm.received" || t === "chat.received") {
    return {
      agentId: "onboarding",
      mission: [
        "We received a DM on X. Draft a helpful reply.",
        text ? `Message: ${text.slice(0, 800)}` : "No message text provided.",
        event.fromUser ? `From: @${event.fromUser}` : null,
        "If they ask what GSB is, pitch the tokenized compute bank. If they ask for help hiring agents, give ACP steps.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  // Own post created — confirm / log via Alert (lightweight)
  if (t === "post.create" && event.direction !== "inbound") {
    return {
      agentId: "alert",
      mission: [
        "Our account just posted. Log a brief confirmation alert.",
        text ? `Content: ${text.slice(0, 280)}` : null,
        event.postId ? `Post ID: ${event.postId}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  return null;
}

export async function routeXEvents(events: NormalizedXEvent[]): Promise<RoutedResult[]> {
  const results: RoutedResult[] = [];

  for (const event of events) {
    const pick = pickAgent(event);
    if (!pick) {
      results.push({
        eventType: event.type,
        agentId: null,
        status: "skipped",
        detail: "No agent mapping for this event type",
      });
      continue;
    }

    const jobId = `xaa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    createJob(jobId, pick.agentId, pick.mission);

    try {
      const output = await runAgent(pick.agentId, {
        mission: pick.mission,
        context: {
          source: "x_activity",
          eventType: event.type,
          postId: event.postId,
          fromUser: event.fromUser,
          dryRun: true,
          post: false,
        },
      });
      completeJob(jobId, output.result, output.usdcEarned);
      results.push({
        eventType: event.type,
        agentId: pick.agentId,
        jobId,
        status: "routed",
        detail: output.result.slice(0, 240),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      failJob(jobId, msg);
      results.push({
        eventType: event.type,
        agentId: pick.agentId,
        jobId,
        status: "failed",
        detail: msg,
      });
    }
  }

  return results;
}
