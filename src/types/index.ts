// ── Agent types ──────────────────────────────────────────────────────────────
export type AgentStatus = "active" | "idle" | "error" | "disabled";
export type JobStatus   = "pending" | "confirmed" | "failed" | "withdrawn";
export type JobType     = "micro" | "subscription" | "batch";
export type PayoutDest  = "wallet" | "gsb_bank";

export interface Agent {
  id: string;
  name: string;
  shortName: string;
  description: string;
  role: string;
  icon: string;
  color: string;          // tailwind color token e.g. "text-red-400"
  enabled: boolean;
  status: AgentStatus;
  pricePerJob: number;
  subscriptionPrice: number;
  jobsCompleted: number;
  totalEarned: number;
  lastActiveAt: string | null;
  acpAgentId: string;
  acpJobUrl: string;
  x402Endpoint: string;
  webhookUrl: string;
  // ACP registration
  acpCategory: string;
  acpDescription: string;
  acpCapabilities: string[];
}

// ── ACP Job ──────────────────────────────────────────────────────────────────
export interface AcpJob {
  id: string;
  agentId: string;
  agentName: string;
  jobRef: string;
  usdcAmount: number;
  status: JobStatus;
  type: JobType;
  createdAt: string;
  confirmedAt: string | null;
  metadata?: string;
}

// ── Withdrawal ───────────────────────────────────────────────────────────────
export interface Withdrawal {
  id: string;
  toAddress: string;
  usdcAmount: number;
  destination: PayoutDest;
  status: "pending" | "sent" | "failed";
  txHash?: string;
  createdAt: string;
}

// ── Activity log ─────────────────────────────────────────────────────────────
export interface ActivityLog {
  id: string;
  agentId: string | null;
  type: "job" | "alert" | "payout" | "config" | "error";
  message: string;
  detail?: string;
  createdAt: string;
}

// ── API Connections ──────────────────────────────────────────────────────────
export interface ApiConnection {
  key: string;
  label: string;
  value: string;
  category: "telegram" | "x" | "x402" | "wallet" | "acp" | "virtuals";
  placeholder: string;
  description: string;
  isSecret: boolean;
}

// ── Summary / KPI ────────────────────────────────────────────────────────────
export interface EarningsSummary {
  totalEarned: number;
  confirmedBalance: number;
  pendingAmount: number;
  withdrawnAmount: number;
  monthlyRevenue: number;
  jobCount: number;
}
