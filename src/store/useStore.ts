"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Agent, AcpJob, Withdrawal, ActivityLog, ApiConnection, EarningsSummary } from "@/types";
import { DEFAULT_AGENTS, DEFAULT_CONNECTIONS, generateSeedJobs, generateSeedLogs } from "@/lib/mockData";

interface GsbStore {
  // Data
  agents: Agent[];
  jobs: AcpJob[];
  withdrawals: Withdrawal[];
  logs: ActivityLog[];
  connections: ApiConnection[];

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
}

export const useStore = create<GsbStore>()(
  persist(
    (set, get) => ({
      agents: DEFAULT_AGENTS.map(a => ({ ...a })),
      jobs: generateSeedJobs(),
      withdrawals: [],
      logs: generateSeedLogs(),
      connections: DEFAULT_CONNECTIONS.map(c => ({ ...c })),

      getSummary: () => {
        const { jobs, withdrawals } = get();
        const confirmed   = jobs.filter(j => j.status === "confirmed" || j.status === "withdrawn");
        const pending     = jobs.filter(j => j.status === "pending");
        const withdrawn   = jobs.filter(j => j.status === "withdrawn");
        const totalEarned = confirmed.reduce((s, j) => s + j.usdcAmount, 0);
        const confirmedBal= jobs.filter(j => j.status === "confirmed").reduce((s, j) => s + j.usdcAmount, 0);
        const pendingAmt  = pending.reduce((s, j) => s + j.usdcAmount, 0);
        const withdrawnAmt= withdrawn.reduce((s, j) => s + j.usdcAmount, 0);
        // Monthly: jobs from last 30 days
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
            message: `Simulated job: ${job.usdcAmount} USDC`,
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
        // Mark confirmed jobs as withdrawn (oldest first up to amount)
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
    }),
    {
      name: "gsb-swarm-store",
      // Don't persist sensitive connection values in plain localStorage in prod
      // — for production, use server-side env vars
    }
  )
);
