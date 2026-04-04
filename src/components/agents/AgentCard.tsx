"use client";

import type { Agent } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, ExternalLink, Info, Loader2, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { RAILWAY_AGENT_IDS, GRADUATION_TARGETS } from "@/lib/railway";

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

interface AgentCardProps {
  agent: Agent;
  onFireJob?: (agentId: string) => void;
  isFiring?: boolean;
}

export default function AgentCard({ agent, onFireJob, isFiring }: AgentCardProps) {
  const isRailwayAgent = agent.id in RAILWAY_AGENT_IDS;
  const isCeo = agent.id === "ceo";
  const graduation = GRADUATION_TARGETS.find(g => g.agentId === agent.id);

  const handleFire = () => {
    if (!agent.enabled) return;
    if (onFireJob) {
      onFireJob(agent.id);
    }
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

        {/* Graduation progress (Railway ACP agents) */}
        {graduation && (
          <div className="rounded-md border border-border bg-secondary/50 p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Graduation Progress
              </span>
              {graduation.graduated ? (
                <Badge className="text-[10px] gap-1 bg-green-500/10 text-green-400 border-green-500/25">
                  <CheckCircle2 size={10} /> Done
                </Badge>
              ) : (
                <Badge className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/25">
                  {graduation.target - graduation.completed} job{graduation.target - graduation.completed !== 1 ? "s" : ""} needed
                </Badge>
              )}
            </div>
            <div className="w-full bg-secondary rounded-full h-1.5">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  graduation.graduated ? "bg-green-400" : "bg-yellow-400"
                )}
                style={{ width: `${Math.min(100, (graduation.completed / graduation.target) * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {graduation.completed}/{graduation.target} jobs completed (Virtuals ACP)
            </div>
          </div>
        )}

        {/* CEO pending status */}
        {isCeo && (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5">
            <div className="text-[10px] font-semibold text-amber-400">Pending Graduation</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Submitted ~Apr 1, estimated 7 business days
            </div>
          </div>
        )}

        {/* Stat row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Per Job", val: agent.pricePerJob > 0 ? `$${agent.pricePerJob.toFixed(3)}` : "—", accent: true },
            { label: "Jobs",    val: String(agent.jobsCompleted), accent: false },
            { label: isCeo ? "Status" : "Sub/mo", val: isCeo ? "Pending" : (agent.subscriptionPrice > 0 ? `$${agent.subscriptionPrice}` : "—"), accent: !isCeo },
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
        {!isCeo && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "flex-1 text-xs gap-1.5 h-8 border-border hover:border-primary/50 hover:text-primary",
                isRailwayAgent && "border-green-500/30 hover:border-green-500/60 hover:text-green-400"
              )}
              onClick={handleFire}
              disabled={!agent.enabled || isFiring === true}
              data-testid={`btn-fire-${agent.id}`}
            >
              {isFiring ? (
                <><Loader2 size={11} className="animate-spin" /> Firing...</>
              ) : (
                <><Play size={11} /> {isRailwayAgent ? "Fire Job" : "Fire Job"}</>
              )}
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
        )}

        {/* x402 endpoint (only for agents that have one) */}
        {agent.x402Endpoint && (
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-default">
                <span className="mono bg-secondary px-2 py-1 rounded truncate flex-1">{agent.x402Endpoint}</span>
                <Info size={11} className="shrink-0" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isRailwayAgent ? "Railway fire-job endpoint" : "x402 payment endpoint → routes through your GSB tokenized bank"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
