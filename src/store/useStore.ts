"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Agent, AcpJob, Withdrawal, ActivityLog, ApiConnection, EarningsSummary } from "@/types";
import { RAILWAY_AGENTS, CEO_AGENT, DEFAULT_CONNECTIONS, generateSeedLogs } from "@/lib/mockData";
import type { RailwayPublicStatus } from "@/lib/railway";

interface GsbStore {
  // Data
  agents: Agent[];
  jobs: AcpJob[];
  withdrawals: Withdrawal[];
  logs: ActivityLog[];
  connections: ApiConnection[];

  // Live Railway data
  railwayStatus: RailwayPublicStatus | null;
  railwayJobsFired: number;
  railwayLastFetched: string | null;

  // Computed
  getSummary: () => EarningsSummary;
  getAgent: (id: string) => Agent | undefined;

  // Actions
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  simulateJob: (agentId: string) => void;
  addJob: (job: AcpJob) => void;
  withdraw: (toAddress: string, amount: number, dest: "wallet" | "gsb_bank") => void;
  updateConnection: (key: string, value: string) => void;
  addLog: (log: Omit<ActivityLog, "id" | "createdAt">) => void;
  setRailwayStatus: (status: RailwayPublicStatus) => void;
}

export const useStore = create<GsbStore>()(
  persist(
    (set, get) => ({
      // Initialize with Railway ACP agents + CEO agent (no more fake Vercel agents on main page)
      agents: [...RAILWAY_AGENTS.map(a => ({ ...a })), { ...CEO_AGENT }],
      jobs: [],
      withdrawals: [],
      logs: generateSeedLogs(),
      connections: DEFAULT_CONNECTIONS.map(c => ({ ...c })),

      // Live Railway data
      railwayStatus: null,
      railwayJobsFired: 0,
      railwayLastFetched: null,

      getSummary: () => {
        const { jobs } = get();
        const confirmed   = jobs.filter(j => j.status === "confirmed" || j.status === "withdrawn");
        const pending     = jobs.filter(j => j.status === "pending");
        const withdrawn   = jobs.filter(j => j.status === "withdrawn");
        const totalEarned = confirmed.reduce((s, j) => s + j.usdcAmount, 0);
        const confirmedBal= jobs.filter(j => j.status === "confirmed").reduce((s, j) => s + j.usdcAmount, 0);
        const pendingAmt  = pending.reduce((s, j) => s + j.usdcAmount, 0);
        const withdrawnAmt= withdrawn.reduce((s, j) => s + j.usdcAmount, 0);
        const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
        const monthly = confirmed
          .filter(j => new Date(j.createdAt).getTime() > cutoff)
          .reduce((s, j) => s + j.usdcAmount, 0);
        return {
          totalEarned,
          confirmedBalance: confirmedBal,
          pendingAmount: pendingAmt,
          withdrawnAmount: withdrawnAmt,
          monthlyRevenue: monthly,
          jobCount: confirmed.length,
        };
      },

      getAgent: (id) => get().agents.find(a => a.id === id),

      updateAgent: (id, patch) =>
        set(s => ({ agents: s.agents.map(a => a.id === id ? { ...a, ...patch } : a) })),

      simulateJob: (agentId) => {
        const agent = get().agents.find(a => a.id === agentId);
        if (!agent) return;
        const job: AcpJob = {
          id: `job_${Date.now()}`,
          agentId,
          agentName: agent.shortName,
          jobRef: `sim_${agentId}_${Date.now()}`,
          usdcAmount: agent.pricePerJob,
          status: "confirmed",
          type: "micro",
          createdAt: new Date().toISOString(),
          confirmedAt: new Date().toISOString(),
        };
        set(s => ({
          jobs: [job, ...s.jobs],
          agents: s.agents.map(a =>
            a.id === agentId
              ? { ...a, jobsCompleted: a.jobsCompleted + 1, totalEarned: a.totalEarned + job.usdcAmount, status: "active", lastActiveAt: new Date().toISOString() }
              : a
          ),
          logs: [{
            id: `log_${Date.now()}`,
            agentId,
            type: "job",
            message: `Job fired on Railway: ${job.usdcAmount} USDC`,
            detail: `ref: ${job.jobRef}`,
            createdAt: new Date().toISOString(),
          }, ...s.logs],
        }));
      },

      addJob: (job) =>
        set(s => ({ jobs: [job, ...s.jobs] })),

      withdraw: (toAddress, amount, dest) => {
        const w: Withdrawal = {
          id: `w_${Date.now()}`,
          toAddress, usdcAmount: amount, destination: dest,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        let remaining = amount;
        const updatedJobs = [...get().jobs].map(j => {
          if (j.status === "confirmed" && remaining > 0) {
            remaining -= j.usdcAmount;
            return { ...j, status: "withdrawn" as const };
          }
          return j;
        });
        set(s => ({
          withdrawals: [w, ...s.withdrawals],
          jobs: updatedJobs,
          logs: [{
            id: `log_${Date.now()}`,
            agentId: null,
            type: "payout",
            message: `Withdrawal: ${amount.toFixed(4)} USDC → ${dest === "gsb_bank" ? "GSB Bank" : "Wallet"}`,
            detail: toAddress,
            createdAt: new Date().toISOString(),
          }, ...s.logs],
        }));
      },

      updateConnection: (key, value) =>
        set(s => ({
          connections: s.connections.map(c => c.key === key ? { ...c, value } : c),
          logs: [{
            id: `log_${Date.now()}`,
            agentId: null,
            type: "config",
            message: `API connection updated`,
            detail: key,
            createdAt: new Date().toISOString(),
          }, ...s.logs],
        })),

      addLog: (log) =>
        set(s => ({
          logs: [{ ...log, id: `log_${Date.now()}`, createdAt: new Date().toISOString() }, ...s.logs],
        })),

      setRailwayStatus: (status) =>
        set(() => ({
          railwayStatus: status,
          railwayJobsFired: status.jobsFired ?? status.agentCount ?? 0,
          railwayLastFetched: new Date().toISOString(),
        })),
    }),
    {
      name: "gsb-swarm-store",
    }
  )
);
