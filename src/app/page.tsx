"use client";

import Header from "@/components/layout/Header";
import KpiTile from "@/components/dashboard/KpiTile";
import AgentCard from "@/components/agents/AgentCard";
import JobsTable from "@/components/dashboard/JobsTable";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import { useStore } from "@/store/useStore";
import { useSummary } from "@/hooks/useSummary";
import { DollarSign, Users, Clock, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";

export default function SwarmOverview() {
  const agents  = useStore(s => s.agents);
  const summary = useSummary();

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
      value: `${agents.filter(a => a.enabled).length} / ${agents.length}`,
      sub: "broker agents online",
      icon: Users,
      colorClass: "text-orange-400",
    },
    {
      label: "Pending Jobs",
      value: String(useStore.getState().jobs.filter(j => j.status === "pending").length),
      sub: "awaiting confirmation",
      icon: Clock,
      colorClass: "text-yellow-400",
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
        subtitle="Live status of your 4 GSB broker agents earning USDC on Virtuals Protocol"
      />
      <main className="p-5 space-y-6 max-w-6xl mx-auto">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {KPIs.map(kpi => <KpiTile key={kpi.label} {...kpi} />)}
        </div>

        {/* Agent grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Broker Agents</h2>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Zap size={10} className="text-yellow-400" />
              Use "Simulate Job" to test the revenue flow
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
          </div>
        </div>

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
