"use client";

import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import type { EarningsSummary } from "@/types";

/**
 * Computes the earnings summary from raw Zustand store data.
 * Using `useMemo` prevents creating new objects on every render,
 * which would cause the `useSyncExternalStore` getServerSnapshot loop.
 */
export function useSummary(): EarningsSummary {
  const jobs = useStore(s => s.jobs);

  return useMemo(() => {
    const confirmed    = jobs.filter(j => j.status === "confirmed" || j.status === "withdrawn");
    const pending      = jobs.filter(j => j.status === "pending");
    const withdrawn    = jobs.filter(j => j.status === "withdrawn");
    const totalEarned  = confirmed.reduce((s, j) => s + j.usdcAmount, 0);
    const confirmedBal = jobs.filter(j => j.status === "confirmed").reduce((s, j) => s + j.usdcAmount, 0);
    const pendingAmt   = pending.reduce((s, j) => s + j.usdcAmount, 0);
    const withdrawnAmt = withdrawn.reduce((s, j) => s + j.usdcAmount, 0);
    const cutoff       = Date.now() - 30 * 24 * 3600 * 1000;
    const monthly      = confirmed
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
  }, [jobs]);
}
