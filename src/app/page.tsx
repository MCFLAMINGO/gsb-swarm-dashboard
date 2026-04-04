"use client";

import Header from "@/components/layout/Header";
import KpiTile from "@/components/dashboard/KpiTile";
import AgentCard from "@/components/agents/AgentCard";
import JobsTable from "@/components/dashboard/JobsTable";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import { useStore } from "@/store/useStore";
import { useSummary } from "@/hooks/useSummary";
import { useRailway } from "@/hooks/useRailway";
import { DollarSign, Users, Flame, TrendingUp, Zap, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { GRADUATION_TARGETS } from "@/lib/railway";

export default function SwarmOverview() {
  const agents = useStore(s => s.agents);
  const railwayStatus = useStore(s => s.railwayStatus);
  const railwayJobsFired = useStore(s => s.railwayJobsFired);
  const summary = useSummary();
  const { fireJobOnRailway, firing } = useRailway();

  const acpAgents = agents.filter(a => a.id !== "ceo");
  const ceoAgent = agents.find(a => a.id === "ceo");

  const KPIs = [
    {
      label: "Total Earned",
      value: `$${summary.totalEarned.toFixed(4)}`,
      sub: "USDC all time",
      icon: DollarSign,
      colorClass: "text-primary",
      glowClass: "glow-red",
    },
    {
      label: "Active Agents",
      value: `${agents.filter(a => a.enabled && a.status === "active").length} / ${agents.filter(a => a.id !== "ceo").length}`,
      sub: railwayStatus ? `Railway: ${railwayStatus.status}` : "connecting to Railway...",
      icon: Users,
      colorClass: "text-orange-400",
    },
    {
      label: "Jobs Fired",
      value: String(railwayJobsFired || summary.jobCount),
      sub: "on Railway backend",
      icon: Flame,
      colorClass: "text-yellow-400",
      glowClass: railwayJobsFired > 0 ? "glow-yellow" : undefined,
    },
    {
      label: "Monthly Revenue",
      value: `$${summary.monthlyRevenue.toFixed(4)}`,
      sub: "USDC last 30 days",
      icon: TrendingUp,
      colorClass: "text-green-400",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Swarm Overview"
        subtitle={
          railwayStatus
            ? `Live from Railway — ${railwayStatus.message || railwayStatus.name}`
            : "Connecting to live Railway backend..."
        }
      />
      <main className="p-5 space-y-6 max-w-6xl mx-auto">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {KPIs.map(kpi => <KpiTile key={kpi.label} {...kpi} />)}
        </div>

        {/* Graduation Targets */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Virtuals ACP Graduation
            </h2>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              10 jobs each to graduate
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {GRADUATION_TARGETS.map(g => (
              <div
                key={g.agentId}
                className={`rounded-lg border p-3 ${
                  g.graduated
                    ? "border-green-500/20 bg-green-500/5"
                    : "border-yellow-500/20 bg-yellow-500/5"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">{g.name}</span>
                  {g.graduated ? (
                    <CheckCircle2 size={14} className="text-green-400" />
                  ) : (
                    <Badge className="text-[9px] bg-yellow-500/10 text-yellow-400 border-yellow-500/25 px-1.5 py-0">
                      {g.target - g.completed} left
                    </Badge>
                  )}
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 mb-1">
                  <div
                    className={`h-1.5 rounded-full ${g.graduated ? "bg-green-400" : "bg-yellow-400"}`}
                    style={{ width: `${Math.min(100, (g.completed / g.target) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {g.completed}/{g.target} jobs
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">ACP Worker Agents</h2>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Zap size={10} className="text-yellow-400" />
              Fire real jobs on Railway backend
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {acpAgents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onFireJob={fireJobOnRailway}
                isFiring={firing === agent.id}
              />
            ))}
          </div>
        </div>

        {/* CEO Agent */}
        {ceoAgent && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Executive Agent
            </h2>
            <div className="max-w-md">
              <AgentCard agent={ceoAgent} />
            </div>
          </div>
        )}

        {/* Bottom row: jobs + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent ACP Jobs</h2>
              <Link href="/earnings" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            <JobsTable limit={6} />
          </div>
          <div className="lg:col-span-2">
            <ActivityFeed limit={8} />
          </div>
        </div>
      </main>
    </div>
  );
}
