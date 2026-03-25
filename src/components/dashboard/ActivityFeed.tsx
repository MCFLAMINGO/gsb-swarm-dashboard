"use client";

import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

const TYPE_META = {
  job:    { label: "Job",    color: "bg-primary/10 text-primary border-primary/25" },
  alert:  { label: "Alert",  color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25" },
  payout: { label: "Payout", color: "bg-orange-500/10 text-orange-400 border-orange-500/25" },
  config: { label: "Config", color: "bg-secondary text-muted-foreground" },
  error:  { label: "Error",  color: "bg-destructive/10 text-destructive" },
};

const ICONS: Record<string, string> = {
  oracle: "⚡", preacher: "📢", onboarding: "🚀", alert: "🔔",
};

export default function ActivityFeed({ limit = 8 }: { limit?: number }) {
  const allLogs = useStore(s => s.logs);
  const logs = useMemo(() => allLogs.slice(0, limit), [allLogs, limit]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Activity Feed</h3>
      </div>
      <div className="divide-y divide-border">
        {logs.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">No activity yet</div>
        )}
        {logs.map(log => {
          const meta = TYPE_META[log.type] || TYPE_META.config;
          return (
            <div key={log.id} className={`log-line ${log.type} px-4 py-2.5`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                  {log.agentId && <span className="text-base leading-none">{ICONS[log.agentId] || "⚙️"}</span>}
                  <span className="text-xs">{log.message}</span>
                  <Badge className={`text-[10px] ${meta.color}`}>{meta.label}</Badge>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                </span>
              </div>
              {log.detail && (
                <div className="mono text-[10px] text-muted-foreground mt-0.5">{log.detail}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
