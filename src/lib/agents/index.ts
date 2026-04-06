import { runOracle } from "./oracle";
import { runPreacher } from "./preacher";
import { runOnboarding } from "./onboarding";
import { runAlert } from "./alert";
import { runThreadWriter } from "./threadwriter";

export type AgentId = "oracle" | "preacher" | "onboarding" | "alert" | "thread-writer";

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
  'thread-writer': runThreadWriter,
};

export function isValidAgent(id: string): id is AgentId {
  return id in handlers;
}

export function runAgent(agentId: AgentId, input: AgentInput): Promise<AgentOutput> {
  return handlers[agentId](input);
}
