import { runOracle } from "./oracle";
import { runPreacher } from "./preacher";
import { runOnboarding } from "./onboarding";
import { runAlert } from "./alert";

export type AgentId = "oracle" | "preacher" | "onboarding" | "alert";

interface AgentInput {
  mission: string;
  context?: Record<string, unknown>;
}

interface AgentOutput {
  result: string;
  usdcEarned: number;
}

const handlers: Record<AgentId, (input: AgentInput) => Promise<AgentOutput>> = {
  oracle: runOracle,
  preacher: runPreacher,
  onboarding: runOnboarding,
  alert: runAlert,
};

export function isValidAgent(id: string): id is AgentId {
  return id in handlers;
}

export function runAgent(agentId: AgentId, input: AgentInput): Promise<AgentOutput> {
  return handlers[agentId](input);
}
