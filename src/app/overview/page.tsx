"use client";

import Header from "@/components/layout/Header";
import KpiTile from "@/components/dashboard/KpiTile";
import AgentCard from "@/components/agents/AgentCard";
import JobsTable from "@/components/dashboard/JobsTable";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import { useStore } from "@/store/useStore";
import { useSummary } from "@/hooks/useSummary";
import { useRailway } from "@/hooks/useRailway";
import {
  DollarSign, Users, Flame, TrendingUp, Zap, Eye, FlaskConical,
  Coins, ShieldCheck, TrendingDown, Globe, BarChart3, ExternalLink
} from "lucide-react";
import Link from "next/link";

// ── Workforce skill catalogue — what you can sell to any business ─────────────
const WORKFORCE_SKILLS = [
  {
    icon: Coins,
    color: "text-yellow-400",
    border: "border-yellow-400/20",
    bg: "bg-yellow-400/5",
    name: "Ad Revenue Automation",
    desc: "Agent learns your traffic patterns and places Coinzilla ad units autonomously. Turns dead page space into clickable revenue with zero manual setup.",
    agent: "GSB Alpha Scanner + CEO",
    price: "$0.35/task",
  },
  {
    icon: Eye,
    color: "text-blue-400",
    border: "border-blue-400/20",
    bg: "bg-blue-400/5",
    name: "Sales Pattern Watcher",
    desc: "Watches your on-chain or app transactions for anomalies, volume spikes, churn signals, and emerging customer patterns. Alerts you before problems become losses.",
    agent: "THROW Watcher + Token Analyst",
    price: "Feed subscription",
  },
  {
    icon: BarChart3,
    color: "text-green-400",
    border: "border-green-400/20",
    bg: "bg-green-400/5",
    name: "Token & Market Intel",
    desc: "Full token analysis: price, liquidity, whale wallets, rug risk, and buy/hold/avoid verdict. Runs on Base, Ethereum, Arbitrum, Solana, and 5 other chains.",
    agent: "GSB Token Analyst",
    price: "$0.10–$0.25/job",
  },
  {
    icon: Globe,
    color: "text-purple-400",
    border: "border-purple-400/20",
    bg: "bg-purple-400/5",
    name: "Alpha Signal Content",
    desc: "Scan trending tokens, detect pre-liquidity launches, write market update threads, and publish to X. From data to live post in one agent command.",
    agent: "Alpha Scanner + Thread Writer",
    price: "$0.15–$0.35/job",
  },
  {
    icon: TrendingDown,
    color: "text-orange-400",
    border: "border-orange-400/20",
    bg: "bg-orange-400/5",
    name: "Wallet Intelligence",
    desc: "Profile any wallet across EVM + Solana: holdings, tx history, smart money detection, DCA strategy execution. Hire it to watch a competitor or track whale moves.",
    agent: "GSB Wallet Profiler & DCA Engine",
    price: "$0.10–$0.25/job",
  },
  {
    icon: FlaskConical,
    color: "text-red-400",
    border: "border-red-400/20",
    bg: "bg-red-400/5",
    name: "UI Quality Agents",
    desc: "5 Playwright browser agents that test your web app like real users: auth flows, navigation, every button, form validation, and live signal checks. Test → fail → fix loop.",
    agent: "Playwright Worker (W1–W5)",
    price: "Per test suite",
  },
  {
    icon: ShieldCheck,
    color: "text-teal-400",
    border: "border-teal-400/20",
    bg: "bg-teal-400/5",
    name: "Restaurant Financial Triage",
    desc: "Upload bank statements + POS exports. Get a full burn rate analysis, vendor credit letter, and bank loan request letter — all in under 60 seconds.",
    agent: "GSB Financial Analyst",
    price: "$24.95/triage",
  },
];

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
      sub: railwayStatus ? `Railway: ${railwayStatus.status}` : "connecting...",
      icon: Users,
      colorClass: "text-orange-400",
    },
    {
      label: "Jobs Served",
      value: String(railwayJobsFired || summary.jobCount),
      sub: "ACP jobs completed",
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
        title="MCFLAMINGO Agentic Workforce"
        subtitle={
          railwayStatus
            ? `${agents.filter(a => a.enabled).length} agents live on Railway · ${railwayStatus.status}`
            : "Connecting to Railway backend..."
        }
      />
      <main className="p-5 space-y-8 max-w-6xl mx-auto">

        {/* Hero pitch — for when you show this to a client */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-foreground mb-1">
                Autonomous agents. Real skills. Hire them like contractors.
              </h2>
              <p className="text-sm text-muted-foreground max-w-xl">
                Every agent in this swarm earns USDC on the{" "}
                <a href="https://app.virtuals.io" target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline">Virtuals ACP marketplace</a>.
                {" "}They run 24/7, take jobs from other AI agents, learn from every outcome,
                and get cheaper to run as their skill confidence grows.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href="/marketplace"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all">
                <ExternalLink className="w-3.5 h-3.5" />
                Hire an Agent
              </Link>
              <Link href="/agents"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-secondary text-xs font-medium hover:bg-secondary/80 transition-all">
                View Skills
              </Link>
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {KPIs.map(kpi => <KpiTile key={kpi.label} {...kpi} />)}
        </div>

        {/* Workforce skill catalogue */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              What This Workforce Can Do For Your Business
            </h2>
            <Link href="/marketplace" className="text-xs text-primary hover:underline">
              See all offerings →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {WORKFORCE_SKILLS.map(skill => (
              <div key={skill.name}
                className={`rounded-xl border ${skill.border} ${skill.bg} p-4 flex flex-col gap-2`}>
                <div className="flex items-start justify-between gap-2">
                  <skill.icon className={`w-4 h-4 mt-0.5 shrink-0 ${skill.color}`} />
                  <span className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
                    {skill.price}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-semibold mb-1">{skill.name}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{skill.desc}</p>
                </div>
                <div className="text-[10px] text-muted-foreground/60 mt-auto pt-1 border-t border-border/50">
                  Powered by: {skill.agent}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active agents + live jobs */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Live Worker Agents
              </h2>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Zap size={10} className="text-yellow-400" />
                ACP marketplace · Railway runtime
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {acpAgents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onFireJob={fireJobOnRailway}
                  isFiring={firing === agent.id}
                />
              ))}
            </div>
            {ceoAgent && (
              <div className="mt-2">
                <AgentCard agent={ceoAgent} />
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent Jobs</h2>
                <Link href="/earnings" className="text-xs text-primary hover:underline">View all →</Link>
              </div>
              <JobsTable limit={5} />
            </div>
            <ActivityFeed limit={6} />
          </div>
        </div>

      </main>
    </div>
  );
}
