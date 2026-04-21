"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DollarSign, TrendingUp, Zap, Users, BarChart2,
  Clock, RefreshCw, XCircle, Globe, CheckCircle2,
  Shield, ExternalLink, Activity
} from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";
const REVENUE_GOAL = 546000;

// ── Types ────────────────────────────────────────────────────────────────────

interface RevenueSummary {
  today: number;
  this_week: number;
  this_month: number;
  all_time: number;
  calls_today: number;
  calls_week: number;
  calls_month: number;
  top_tools: ToolStat[];
  top_callers: CallerStat[];
}

interface ToolStat {
  tool: string;
  calls: number;
  revenue: number;
}

interface CallerStat {
  agent_id: string;
  calls: number;
  revenue: number;
}

interface BudgetStatus {
  concurrent_agents: number;
  gate_status: "throttled" | "normal" | "accelerated";
  revenue_7d: number;
}

interface CallEntry {
  ts: string | null;
  tool: string;
  caller: string;
  entry: string;
  zip: string | null;
  intent: string | null;
  latency: number | null;
  cost: number;
  paid: boolean;
}

interface CallLog {
  count: number;
  calls: CallEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(2)}k`;
  return `$${n.toFixed(2)}`;
}

function fmtCalls(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return fallback;
    return await res.json() as T;
  } catch {
    return fallback;
  }
}

function gateColor(status: string | undefined): string {
  if (status === "accelerated") return "#22c55e";
  if (status === "throttled")   return "#ef4444";
  return "#eab308";
}

function gateBg(status: string | undefined): string {
  if (status === "accelerated") return "#22c55e18";
  if (status === "throttled")   return "#ef444418";
  return "#eab30818";
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ w = "100%", h = 14 }: { w?: string; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 4,
      background: "hsl(0 0% 14%)",
      animation: "pulse 1.5s ease-in-out infinite"
    }} />
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)",
      borderRadius: 12, padding: 20, ...style
    }}>
      {children}
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = "#00e5a0" }: {
  value: number; max: number; color?: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ height: 6, borderRadius: 99, background: "hsl(0 0% 14%)", overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${pct}%`, borderRadius: 99,
        background: color, transition: "width 700ms cubic-bezier(.4,0,.2,1)"
      }} />
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color = "#00e5a0", loading }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color?: string;
  loading?: boolean;
}) {
  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          background: `${color}18`, border: `1px solid ${color}30`
        }}>
          <Icon size={15} style={{ color }} />
        </div>
        <span style={{ fontSize: 11, color: "hsl(0 0% 45%)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {label}
        </span>
      </div>
      {loading ? (
        <Skeleton h={32} w="70%" />
      ) : (
        <div style={{ transition: "all 400ms" }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#f0ebe3", lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: "hsl(0 0% 45%)", marginTop: 4 }}>{sub}</div>}
        </div>
      )}
    </Panel>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionDiv({ icon: Icon, letter, title, error }: {
  icon: React.ElementType; letter: string; title: string; error?: boolean
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
      paddingBottom: 10, borderBottom: "1px solid hsl(0 0% 14%)"
    }}>
      <Icon size={16} style={{ color: "#00e5a0" }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: "#f0ebe3", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {letter} — {title}
      </span>
      {error && (
        <span style={{ fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
          <XCircle size={11} /> Endpoint unavailable — showing stale/mock data
        </span>
      )}
    </div>
  );
}

// ── Bar Row ───────────────────────────────────────────────────────────────────

function BarRow({ label, value, max, amount, color = "#00e5a0" }: {
  label: string; value: number; max: number; amount?: number; color?: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#f0ebe3", fontFamily: "monospace" }}>{label}</span>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 11, color: "hsl(0 0% 50%)" }}>{value.toLocaleString()} calls</span>
          {amount !== undefined && (
            <span style={{ fontSize: 11, fontWeight: 600, color }}>{fmtUSD(amount)}</span>
          )}
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: "hsl(0 0% 12%)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 99,
          background: color, transition: "width 600ms cubic-bezier(.4,0,.2,1)"
        }} />
      </div>
    </div>
  );
}

// ── Agentic Visibility Config ─────────────────────────────────────────────────

const VISIBILITY_CARDS = [
  {
    name: "Smithery",
    category: "MCP Registry",
    status: "submitted",
    statusColor: "#22c55e",
    link: "https://smithery.ai",
    icon: Globe
  },
  {
    name: "PulseMCP",
    category: "MCP Registry",
    status: "submitted",
    statusColor: "#22c55e",
    link: "https://pulsemcp.com",
    icon: Globe
  },
  {
    name: "mcp.run",
    category: "MCP Registry",
    status: "submitted",
    statusColor: "#22c55e",
    link: "https://mcp.run",
    icon: Globe
  },
  {
    name: "Virtuals ACP",
    category: "Agent Protocol",
    status: "registered",
    statusColor: "#22c55e",
    link: "https://app.virtuals.io/acp",
    icon: Zap
  },
  {
    name: "Google A2A",
    category: "Agent Card",
    status: "Agent Card live",
    statusColor: "#22c55e",
    link: "https://swarm-deploy-throw.vercel.app/.well-known/agent.json",
    icon: CheckCircle2
  },
  {
    name: "Fetch.ai Agentverse",
    category: "Agent Network",
    status: "broadcasting",
    statusColor: "#00e5a0",
    link: "https://agentverse.ai",
    icon: Globe
  },
  {
    name: "AGNTCY",
    category: "Agent Registry",
    status: "pending submission",
    statusColor: "#eab308",
    link: "https://agntcy.org",
    icon: Shield
  },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LocalIntelRevenuePage() {
  const [revenue, setRevenue]     = useState<RevenueSummary | null>(null);
  const [budget, setBudget]       = useState<BudgetStatus | null>(null);
  const [callLog, setCallLog]     = useState<CallLog | null>(null);
  const [loading, setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [errors, setErrors]       = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const counterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    const errs: Record<string, boolean> = {};

    const [rawRev, bgt, log] = await Promise.all([
      safeFetch<Record<string, unknown> | null>(
        `${RAILWAY}/api/local-intel/revenue-summary`, null
      ).catch(() => { errs.revenue = true; return null; }),
      safeFetch<BudgetStatus | null>(
        `${RAILWAY}/api/local-intel/budget-status`, null
      ).catch(() => { errs.budget = true; return null; }),
      safeFetch<CallLog | null>(
        `${RAILWAY}/api/local-intel/call-log?limit=50`, null
      ).catch(() => null),
    ]);

    // Normalise revenue-summary — API returns nested {calls, revenue_pathusd} objects
    let rev: RevenueSummary | null = null;
    if (rawRev) {
      const g = (key: string) => (rawRev[key] as Record<string, number> | undefined);
      rev = {
        today:        g('today')?.revenue_pathusd       ?? 0,
        this_week:    g('week')?.revenue_pathusd        ?? 0,
        this_month:   g('month')?.revenue_pathusd       ?? 0,
        all_time:     g('allTime')?.revenue_pathusd     ?? 0,
        calls_today:  g('today')?.calls                 ?? 0,
        calls_week:   g('week')?.calls                  ?? 0,
        calls_month:  g('month')?.calls                 ?? 0,
        top_tools:    (rawRev.topTools   as ToolStat[])   ?? [],
        top_callers:  ((rawRev.topCallers ?? []) as Record<string, unknown>[]).map(c => ({
          agent_id: (c.caller as string | undefined) ?? (c.agent_id as string | undefined) ?? 'unknown',
          calls:    (c.calls as number | undefined)   ?? 0,
          revenue:  (c.revenue as number | undefined) ?? 0,
        })),
      };
    }

    setRevenue(rev);
    setBudget(bgt);
    setCallLog(log);
    setErrors(errs);
    setLoading(false);
    setLastUpdated(new Date());
    setSecondsAgo(0);
  }, []);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(fetchAll, 60_000);
    counterRef.current = setInterval(() => setSecondsAgo(s => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (counterRef.current) clearInterval(counterRef.current);
    };
  }, [fetchAll]);

  const today      = revenue?.today      ?? 0;
  const thisWeek   = revenue?.this_week  ?? 0;
  const thisMonth  = revenue?.this_month ?? 0;
  const allTime    = revenue?.all_time   ?? 0;
  const callsToday = revenue?.calls_today ?? 0;
  const callsWeek  = revenue?.calls_week  ?? 0;
  const callsMon   = revenue?.calls_month ?? 0;
  const topTools: ToolStat[]   = revenue?.top_tools   ?? [];
  const topCallers: CallerStat[] = revenue?.top_callers ?? [];

  const goalPct = Math.min(100, (allTime / REVENUE_GOAL) * 100);
  const maxToolCalls   = topTools.reduce((m, t) => Math.max(m, t.calls), 0);
  const maxCallerCalls = topCallers.reduce((m, c) => Math.max(m, c.calls), 0);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px", background: "hsl(0 0% 4%)" }}>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f0ebe3", display: "flex", alignItems: "center", gap: 10 }}>
            <DollarSign size={20} style={{ color: "#00e5a0" }} />
            Revenue & Monetization
          </h1>
          <p style={{ fontSize: 12, color: "hsl(0 0% 45%)", marginTop: 4 }}>
            Live tool call billing · budget gate · agentic registry visibility · polling every 60s
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "hsl(0 0% 40%)", display: "flex", alignItems: "center", gap: 5 }}>
            <Clock size={11} />
            {lastUpdated ? `Updated ${secondsAgo}s ago` : "Loading…"}
          </span>
          <button
            onClick={fetchAll}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8, fontSize: 12,
              background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 18%)",
              color: "hsl(0 0% 70%)", cursor: "pointer"
            }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION A — REVENUE STATS
          ══════════════════════════════════════════════════════════ */}
      <SectionDiv icon={DollarSign} letter="A" title="Revenue Stats" error={errors.revenue} />

      {/* KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <KpiCard
          label="Today" value={loading ? "—" : fmtUSD(today)}
          sub={`${fmtCalls(callsToday)} calls`}
          icon={DollarSign} color="#00e5a0" loading={loading}
        />
        <KpiCard
          label="This Week" value={loading ? "—" : fmtUSD(thisWeek)}
          sub={`${fmtCalls(callsWeek)} calls`}
          icon={TrendingUp} color="#22c55e" loading={loading}
        />
        <KpiCard
          label="This Month" value={loading ? "—" : fmtUSD(thisMonth)}
          sub={`${fmtCalls(callsMon)} calls`}
          icon={BarChart2} color="#eab308" loading={loading}
        />
        <KpiCard
          label="All Time" value={loading ? "—" : fmtUSD(allTime)}
          sub="cumulative"
          icon={Zap} color="hsl(4 85% 44%)" loading={loading}
        />
      </div>

      {/* Goal progress */}
      <Panel style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#f0ebe3" }}>
            Revenue to $546k Goal
          </span>
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ fontSize: 12, color: "hsl(0 0% 45%)" }}>
              {loading ? "—" : fmtUSD(allTime)} earned
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#00e5a0" }}>
              {loading ? "—" : `${goalPct.toFixed(2)}%`}
            </span>
            <span style={{ fontSize: 12, color: "hsl(0 0% 40%)" }}>
              {loading ? "—" : `${fmtUSD(REVENUE_GOAL - allTime)} remaining`}
            </span>
          </div>
        </div>
        <ProgressBar value={allTime} max={REVENUE_GOAL} color="#00e5a0" />
        <div style={{
          display: "flex", justifyContent: "space-between",
          marginTop: 6, fontSize: 10, color: "hsl(0 0% 35%)"
        }}>
          <span>$0</span>
          <span>$136.5k</span>
          <span>$273k</span>
          <span>$409.5k</span>
          <span>$546k</span>
        </div>
      </Panel>

      {/* ══════════════════════════════════════════════════════════
          SECTION B + C — TOP TOOLS & TOP CALLERS (2-col)
          ══════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

        {/* Section B — Top Tools */}
        <Panel>
          <SectionDiv icon={BarChart2} letter="B" title="Top Tools" />
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <Skeleton h={12} w="80%" />
                <div style={{ height: 5, background: "hsl(0 0% 12%)", borderRadius: 99, marginTop: 6 }} />
              </div>
            ))
          ) : topTools.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <BarRow key={i} label="—" value={0} max={1} color="#00e5a0" />
            ))
          ) : (
            topTools.map((t) => (
              <BarRow
                key={t.tool}
                label={t.tool}
                value={t.calls}
                max={maxToolCalls}
                amount={t.revenue}
                color="#00e5a0"
              />
            ))
          )}
        </Panel>

        {/* Section C — Top Callers */}
        <Panel>
          <SectionDiv icon={Users} letter="C" title="Top Callers" />
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <Skeleton h={12} w="80%" />
                <div style={{ height: 5, background: "hsl(0 0% 12%)", borderRadius: 99, marginTop: 6 }} />
              </div>
            ))
          ) : topCallers.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <BarRow key={i} label="—" value={0} max={1} color="hsl(4 85% 44%)" />
            ))
          ) : (
            topCallers.map((c, i) => (
              <BarRow
                key={c.agent_id}
                label={c.agent_id}
                value={c.calls}
                max={maxCallerCalls}
                amount={c.revenue}
                color={i === 0 ? "#00e5a0" : i === 1 ? "#22c55e" : "hsl(4 85% 44%)"}
              />
            ))
          )}
        </Panel>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION D — BUDGET GATE STATUS
          ══════════════════════════════════════════════════════════ */}
      <SectionDiv icon={Shield} letter="D" title="Budget Gate Status" error={errors.budget} />

      <Panel style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {/* Concurrent agents */}
          <div style={{
            padding: "16px 20px", borderRadius: 10,
            background: "hsl(0 0% 5%)", border: "1px solid hsl(0 0% 12%)",
            display: "flex", flexDirection: "column", gap: 6
          }}>
            <span style={{ fontSize: 10, color: "hsl(0 0% 45%)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Concurrent Agent Limit
            </span>
            {loading ? <Skeleton h={26} w="50%" /> : (
              <span style={{ fontSize: 26, fontWeight: 700, color: "#f0ebe3", transition: "all 300ms" }}>
                {budget?.concurrent_agents ?? "—"}
              </span>
            )}
            <span style={{ fontSize: 11, color: "hsl(0 0% 40%)" }}>max parallel ZIP agents</span>
          </div>

          {/* Gate status */}
          <div style={{
            padding: "16px 20px", borderRadius: 10,
            background: "hsl(0 0% 5%)", border: "1px solid hsl(0 0% 12%)",
            display: "flex", flexDirection: "column", gap: 6
          }}>
            <span style={{ fontSize: 10, color: "hsl(0 0% 45%)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Gate Status
            </span>
            {loading ? <Skeleton h={26} w="60%" /> : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, transition: "all 300ms" }}>
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: gateColor(budget?.gate_status),
                  boxShadow: `0 0 8px ${gateColor(budget?.gate_status)}88`
                }} />
                <span style={{
                  fontSize: 22, fontWeight: 700,
                  color: gateColor(budget?.gate_status)
                }}>
                  {budget?.gate_status ?? "—"}
                </span>
              </div>
            )}
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 99,
              background: gateBg(budget?.gate_status),
              color: gateColor(budget?.gate_status),
              width: "fit-content", fontWeight: 600
            }}>
              {budget?.gate_status === "accelerated" ? "Full speed" :
               budget?.gate_status === "throttled"   ? "Rate limited" : "Normal operation"}
            </span>
          </div>

          {/* Revenue 7d */}
          <div style={{
            padding: "16px 20px", borderRadius: 10,
            background: "hsl(0 0% 5%)", border: "1px solid hsl(0 0% 12%)",
            display: "flex", flexDirection: "column", gap: 6
          }}>
            <span style={{ fontSize: 10, color: "hsl(0 0% 45%)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Revenue (7-day)
            </span>
            {loading ? <Skeleton h={26} w="60%" /> : (
              <span style={{ fontSize: 26, fontWeight: 700, color: "#00e5a0", transition: "all 300ms" }}>
                {budget?.revenue_7d != null ? fmtUSD(budget.revenue_7d) : "—"}
              </span>
            )}
            <span style={{ fontSize: 11, color: "hsl(0 0% 40%)" }}>rolling 7-day window</span>
          </div>
        </div>
      </Panel>

      {/* ══════════════════════════════════════════════════════════
          SECTION E — AGENTIC VISIBILITY
          ══════════════════════════════════════════════════════════ */}
      <SectionDiv icon={Globe} letter="E" title="Agentic Visibility" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 8 }}>
        {VISIBILITY_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <a
              key={card.name}
              href={card.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <div style={{
                background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)",
                borderRadius: 12, padding: "16px 18px",
                transition: "border-color 200ms, box-shadow 200ms",
                cursor: "pointer",
                display: "flex", flexDirection: "column", gap: 10
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = `${card.statusColor}44`;
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 16px ${card.statusColor}14`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(0 0% 14%)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${card.statusColor}18`, border: `1px solid ${card.statusColor}30`,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <Icon size={15} style={{ color: card.statusColor }} />
                  </div>
                  <ExternalLink size={11} style={{ color: "hsl(0 0% 35%)", marginTop: 4 }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f0ebe3", marginBottom: 2 }}>
                    {card.name}
                  </div>
                  <div style={{ fontSize: 10, color: "hsl(0 0% 40%)", marginBottom: 8 }}>
                    {card.category}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    padding: "2px 8px", borderRadius: 99,
                    background: `${card.statusColor}18`, color: card.statusColor
                  }}>
                    {card.status}
                  </span>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION F — LIVE CALL LOG
          ══════════════════════════════════════════════════════════ */}
      <div style={{ marginTop: 24 }}>
        <SectionDiv icon={Activity} letter="F" title="Live Call Log" />
      </div>

      <div style={{
        background: "hsl(0 0% 5%)",
        border: "1px solid hsl(0 0% 12%)",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 24,
      }}>
        {/* Header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "100px 1fr 90px 80px 60px 52px",
          gap: 8,
          padding: "8px 14px",
          borderBottom: "1px solid hsl(0 0% 10%)",
          fontSize: 9,
          color: "hsl(0 0% 38%)",
          textTransform: "uppercase" as const,
          letterSpacing: "0.06em",
          fontWeight: 600,
        }}>
          <span>Time</span>
          <span>Tool</span>
          <span>Caller</span>
          <span>ZIP · Intent</span>
          <span>Latency</span>
          <span>Cost</span>
        </div>

        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ padding: "8px 14px", borderBottom: "1px solid hsl(0 0% 8%)" }}>
              <Skeleton h={10} w={`${60 + (i % 3) * 15}%`} />
            </div>
          ))
        ) : !callLog || callLog.calls.length === 0 ? (
          <div style={{ padding: "20px 14px", fontSize: 12, color: "hsl(0 0% 35%)", textAlign: "center" as const }}>
            No calls logged yet — make a tool call to see it here.
          </div>
        ) : (
          callLog.calls.map((c, i) => {
            const tool = c.tool.replace("local_intel_", "");
            const ts   = c.ts ? new Date(c.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
            const entryColor = c.entry === "x402-premium" ? "#eab308" : c.entry === "x402" ? "#22c55e" : "hsl(0 0% 40%)";
            return (
              <div key={i} style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr 90px 80px 60px 52px",
                gap: 8,
                padding: "7px 14px",
                borderBottom: "1px solid hsl(0 0% 8%)",
                alignItems: "center",
              }}>
                <span style={{ fontSize: 10, color: "hsl(0 0% 40%)", fontFamily: "monospace" }}>{ts}</span>

                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#f0ebe3", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                    {tool}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 99,
                    background: `${entryColor}18`, color: entryColor, whiteSpace: "nowrap" as const,
                  }}>
                    {c.entry}
                  </span>
                </div>

                <span style={{
                  fontSize: 10, color: c.caller === "unknown" ? "hsl(0 0% 35%)" : "#00e5a0",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
                }}>
                  {c.caller}
                </span>

                <div style={{ overflow: "hidden" }}>
                  {c.zip && <span style={{ fontSize: 10, color: "hsl(0 0% 55%)", fontFamily: "monospace" }}>{c.zip}</span>}
                  {c.intent && <span style={{ fontSize: 9, color: "hsl(0 0% 38%)", display: "block", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{c.intent.replace(/_/g, " ")}</span>}
                </div>

                <span style={{ fontSize: 10, color: c.latency && c.latency > 1000 ? "#eab308" : "hsl(0 0% 45%)", fontFamily: "monospace" }}>
                  {c.latency != null ? `${c.latency}ms` : "—"}
                </span>

                <span style={{ fontSize: 10, fontWeight: 600, color: c.cost > 0 ? "#00e5a0" : "hsl(0 0% 35%)", fontFamily: "monospace" }}>
                  {c.cost > 0 ? `$${c.cost.toFixed(3)}` : "free"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
