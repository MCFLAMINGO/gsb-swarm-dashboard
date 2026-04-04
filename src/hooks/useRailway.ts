"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import { fetchPublicStatus, fetchWorkers, fireJob as railwayFireJob, DEFAULT_MISSIONS } from "@/lib/railway";
import type { RailwayWorker } from "@/lib/railway";
import { toast } from "sonner";

const POLL_INTERVAL = 30_000; // 30 seconds

/**
 * Hook that polls the Railway backend for live swarm status
 * and provides a fireJob function for the UI.
 */
export function useRailway() {
  const setRailwayStatus = useStore(s => s.setRailwayStatus);
  const updateAgent = useStore(s => s.updateAgent);
  const addJob = useStore(s => s.addJob);
  const addLog = useStore(s => s.addLog);
  const [firing, setFiring] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollStatus = useCallback(async () => {
    // Fetch public status
    const status = await fetchPublicStatus();
    if (status) {
      setRailwayStatus(status);
    }

    // Fetch worker details and update agent cards
    const workers = await fetchWorkers();
    if (workers.length > 0) {
      workers.forEach((w: RailwayWorker) => {
        const agentId = w.id || w.name?.toLowerCase().replace(/\s+/g, "_");
        if (agentId) {
          updateAgent(agentId, {
            status: w.status === "active" || w.status === "online" ? "active" : "idle",
            ...(w.jobsCompleted != null ? { jobsCompleted: w.jobsCompleted } : {}),
            ...(w.totalEarned != null ? { totalEarned: w.totalEarned } : {}),
            ...(w.lastActiveAt ? { lastActiveAt: w.lastActiveAt } : {}),
          });
        }
      });
    }
  }, [setRailwayStatus, updateAgent]);

  // Start polling on mount
  useEffect(() => {
    pollStatus(); // immediate first fetch
    intervalRef.current = setInterval(pollStatus, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pollStatus]);

  // Fire a real job on Railway
  const fireJobOnRailway = useCallback(async (agentId: string, mission?: string) => {
    setFiring(agentId);
    const missionText = mission || DEFAULT_MISSIONS[agentId] || `Run ${agentId} task`;

    try {
      const result = await railwayFireJob(agentId, missionText);

      // Add job to local store
      addJob({
        id: result.jobId || `rw_${Date.now()}`,
        agentId,
        agentName: agentId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        jobRef: result.jobId || `rw_${agentId}_${Date.now()}`,
        usdcAmount: 0.01,
        status: "pending",
        type: "micro",
        createdAt: new Date().toISOString(),
        confirmedAt: null,
      });

      addLog({
        agentId,
        type: "job",
        message: `Job fired on Railway: ${agentId}`,
        detail: `jobId: ${result.jobId}`,
      });

      toast.success(`Job fired: ${agentId.replace(/_/g, " ")}`, {
        description: `jobId: ${result.jobId}`,
      });

      // Refresh status after firing
      setTimeout(pollStatus, 2000);

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to fire ${agentId}`, { description: msg });
      addLog({
        agentId,
        type: "error",
        message: `Railway fire-job failed: ${agentId}`,
        detail: msg,
      });
      throw err;
    } finally {
      setFiring(null);
    }
  }, [addJob, addLog, pollStatus]);

  return {
    fireJobOnRailway,
    firing,
    pollStatus,
  };
}
