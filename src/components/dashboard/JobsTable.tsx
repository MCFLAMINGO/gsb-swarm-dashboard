"use client";

import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

const ICONS: Record<string, string> = {
  oracle: "⚡", preacher: "📢", onboarding: "🚀", alert: "🔔",
  token_analyst: "🔬", wallet_profiler: "👛", alpha_scanner: "🔍", thread_writer: "✍️",
  ceo: "👔",
};

export default function JobsTable({ limit = 10 }: { limit?: number }) {
  const allJobs = useStore(s => s.jobs);
  const jobs = useMemo(() => allJobs.slice(0, limit), [allJobs, limit]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Job Ref</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">USDC</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No jobs yet — simulate one from an agent card
                </td>
              </tr>
            )}
            {jobs.map(job => (
              <tr key={job.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                </td>
                <td className="px-4 py-2.5 text-xs capitalize">
                  {ICONS[job.agentId] || "🤖"} {job.agentName}
                </td>
                <td className="px-4 py-2.5 mono text-xs text-muted-foreground">{job.jobRef}</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className="text-[10px] capitalize">{job.type}</Badge>
                </td>
                <td className="px-4 py-2.5 text-right tabular font-semibold text-primary text-sm">
                  ${job.usdcAmount.toFixed(4)}
                </td>
                <td className="px-4 py-2.5">
                  <Badge
                    className={cn(
                      "text-[10px]",
                      job.status === "confirmed"  && "bg-primary/10 text-primary border-primary/25",
                      job.status === "pending"    && "bg-yellow-500/10 text-yellow-400 border-yellow-500/25",
                      job.status === "withdrawn"  && "bg-blue-500/10 text-blue-400 border-blue-500/25",
                      job.status === "failed"     && "bg-destructive/10 text-destructive border-destructive/25",
                    )}
                  >
                    {job.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// cn is not imported — add it
function cn(...args: (string | undefined | false | null)[]) {
  return args.filter(Boolean).join(" ");
}
