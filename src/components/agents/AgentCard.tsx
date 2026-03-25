"use client";

import { useStore } from "@/store/useStore";
import type { Agent } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, ExternalLink, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

function StatusBadge({ status, enabled }: { status: Agent["status"]; enabled: boolean }) {
  if (!enabled) return <Badge variant="secondary" className="text-[10px] gap-1"><span className="status-dot idle" />Disabled</Badge>;
  if (status === "active") return (
    <Badge className="text-[10px] gap-1.5 border" style={{ background: "hsl(4 85% 44% / 0.12)", color: "hsl(4 85% 44%)", borderColor: "hsl(4 85% 44% / 0.3)" }}>
      <span className="status-dot active" />Active
    </Badge>
  );
  if (status === "error") return <Badge variant="destructive" className="text-[10px] gap-1"><span className="status-dot error" />Error</Badge>;
  return <Badge variant="secondary" className="text-[10px] gap-1"><span className="status-dot idle" />Idle</Badge>;
}

export default function AgentCard({ agent }: { agent: Agent }) {
  const simulateJob = useStore(s => s.simulateJob);

  const handleSimulate = () => {
    if (!agent.enabled) { toast.error("Agent is disabled"); return; }
    simulateJob(agent.id);
    toast.success(`${agent.shortName}: job simulated`, {
      description: `+$${agent.pricePerJob.toFixed(4)} USDC confirmed`,
    });
  };

  return (
    <TooltipProvider>
      <div className="agent-card relative rounded-lg border border-border bg-card p-4 flex flex-col gap-3"
        data-testid={`agent-card-${agent.id}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl leading-none">{agent.icon}</span>
            <div>
              <div className="text-sm font-semibold leading-tight">{agent.name}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{agent.role}</div>
            </div>
          </div>
          <StatusBadge status={agent.status} enabled={agent.enabled} />
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>

        {/* Stat row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Per Job", val: `$${agent.pricePerJob.toFixed(3)}`, accent: true },
            { label: "Jobs",    val: String(agent.jobsCompleted),        accent: false },
            { label: "Sub/mo",  val: `$${agent.subscriptionPrice}`,      accent: true },
          ].map(({ label, val, accent }) => (
            <div key={label} className="bg-secondary rounded-md p-2 text-center">
              <div className="text-[10px] text-muted-foreground">{label}</div>
              <div className={cn("text-sm font-bold tabular mt-0.5", accent ? "text-primary" : "text-foreground")}>{val}</div>
            </div>
          ))}
        </div>

        {/* Last active */}
        {agent.lastActiveAt && (
          <p className="text-[10px] text-muted-foreground">
            Last active: {formatDistanceToNow(new Date(agent.lastActiveAt), { addSuffix: true })}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs gap-1.5 h-8 border-border hover:border-primary/50 hover:text-primary"
            onClick={handleSimulate}
            disabled={!agent.enabled}
            data-testid={`btn-simulate-${agent.id}`}
          >
            <Play size={11} /> Simulate Job
          </Button>

          <Tooltip>
            <TooltipTrigger>
              <a
                href={agent.acpJobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                aria-label="Open on Virtuals ACP"
              >
                <ExternalLink size={13} />
              </a>
            </TooltipTrigger>
            <TooltipContent>Open on Virtuals ACP</TooltipContent>
          </Tooltip>
        </div>

        {/* x402 endpoint */}
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-default">
              <span className="mono bg-secondary px-2 py-1 rounded truncate flex-1">{agent.x402Endpoint}</span>
              <Info size={11} className="shrink-0" />
            </div>
          </TooltipTrigger>
          <TooltipContent>x402 payment endpoint → routes through your GSB tokenized bank</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
