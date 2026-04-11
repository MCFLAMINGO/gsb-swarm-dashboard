"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Brain, Zap, Wallet, TrendingUp, Search, BarChart2,
  Users, FileText, AlertTriangle, CheckCircle,
  XCircle, Play, Square, RefreshCw, ChevronRight,
  Activity, DollarSign, ArrowRightLeft
} from "lucide-react";

// ACP agents live in gsb-swarm; executor/trades live in gsb-yield-swarm
const EXECUTOR_BASE = process.env.NEXT_PUBLIC_EXECUTOR_URL || "https://gsb-yield-swarm-production.up.railway.app";
const ACP_BASE = process.env.NEXT_PUBLIC_ACP_URL || "https://gsb-swarm-production.up.railway.app";

// ─── Types ────────────────────────────────────────────────────────────────
interface PlaybookStep {
  step: number;
  agentId: string;
  action: string;
  token: string;
  chain: string;
  amount: number;
  timeframe: string;
  expectedPnl: number;
  confidence: number;
  reasoning: string;
  requiresApproval: boolean;
  status: "pending" | "running" | "completed" | "failed";
}

interface Playbook {
  steps: PlaybookStep[];
  conflicts: { a: string; b: string; token: string }[];
  entanglementWarnings: { message: string }[];
  totalExpectedPnl: string;
  requiresBoardApproval: boolean;
  generatedAt: string;
}

interface WalletState {
  balance: number;
  currency: string;
  status: "healthy" | "low" | "bankrupt" | "not_configured" | "error" | "unknown";
  address?: string;
  lastUpdated?: string;
}

interface FeedEvent {
  type: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  ts: string;
  step?: PlaybookStep;
}

interface UMAAssertion {
  assertionId: string;
  signal: { token: string; chain: string; direction: string; amount: number };
  expiresAt: number;
  settled: boolean;
}

interface Price {
  token: string;
  price: number | null;
  error?: string;
}

// ─── Agent definitions ────────────────────────────────────────────────────
const AGENTS = [
  { id: "alpha_scanner",    label: "Alpha Scanner",    icon: Search,    color: "text-violet-400",  desc: "Scans trending tokens, volume spikes, new launches" },
  { id: "wallet_profiler",  label: "Wallet Profiler",  icon: Users,     color: "text-blue-400",    desc: "Tracks smart money wallets, detects DCA patterns" },
  { id: "token_analyst",    label: "Token Analyst",    icon: BarChart2, color: "text-emerald-400", desc: "Deep token analysis, liquidity, whale monitoring" },
  { id: "thread_writer",    label: "Thread Writer",    icon: FileText,  color: "text-pink-400",    desc: "Writes alpha threads, market updates, X posts" },
  { id: "ceo",              label: "CEO Agent",        icon: Brain,     color: "text-amber-400",   desc: "Aggregates all strategies, resolves conflicts, directs" },
];

const TIME_HORIZONS = [
  { value: "immediate", label: "Right Now",  desc: "Execute immediately available opportunities" },
  { value: "2h",        label: "2 Hours",    desc: "Plan across next 2 hours" },
  { value: "8h",        label: "8 Hours",    desc: "Full trading session plan" },
  { value: "2d",        label: "2 Days",     desc: "Multi-day strategy" },
  { value: "3d",        label: "3 Days",     desc: "Max horizon — discuss if longer needed" },
];

const CHAIN_COLORS: Record<string, string> = {
  base:   "bg-blue-900/60 text-blue-300",
  solana: "bg-violet-900/60 text-violet-300",
  tempo:  "bg-amber-900/60 text-amber-300",
};

const STATUS_COLORS: Record<string, string> = {
  healthy:        "text-green-400",
  low:            "text-amber-400",
  bankrupt:       "text-red-400",
  not_configured: "text-zinc-500",
  error:          "text-red-400",
  unknown:        "text-zinc-500",
};

const SEVERITY_COLORS: Record<string, string> = {
  info:    "border-zinc-700 text-zinc-300",
  success: "border-green-800 text-green-300",
  warning: "border-amber-800 text-amber-300",
  error:   "border-red-800 text-red-300",
};

// ─── Panel wrapper ─────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------
// LiveTradesPanel — consolidated view of all open positions across all strategies
// ---------------------------------------------------------------------------
function LiveTradesPanel() {
  const EXEC = process.env.NEXT_PUBLIC_EXECUTOR_URL || "https://gsb-yield-swarm-production.up.railway.app";
  const [data, setData] = React.useState<any>(null);
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch(`${EXEC}/api/positions`);
      if (r.ok) { const d = await r.json(); setData(d); setLastUpdated(new Date().toLocaleTimeString()); }
    } catch {}
  };

  React.useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  const TYPE_COLORS: Record<string, string> = {
    copy_trade:  "bg-blue-900/60 text-blue-300",
    funding_arb: "bg-emerald-900/60 text-emerald-300",
    tempo_yield: "bg-violet-900/60 text-violet-300",
  };

  const TYPE_LABELS: Record<string, string> = {
    copy_trade:  "Copy",
    funding_arb: "Arb",
    tempo_yield: "Yield",
  };

  // flatten all open positions
  const allPositions: any[] = [];
  if (data?.summary) {
    for (const [type, summary] of Object.entries(data.summary) as [string, any][]) {
      if (summary?.positions) {
        for (const p of summary.positions) allPositions.push({ ...p, _type: type });
      }
    }
  }
  allPositions.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: "Total Exposure", val: data ? `$${data.totalExposureUsd}` : "—", color: "text-white" },
          { label: "Unrealized P&L", val: data ? `$${data.totalUnrealizedPnl}` : "—", color: Number(data?.totalUnrealizedPnl) >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Open Positions", val: allPositions.length, color: "text-white" },
          { label: "Updated", val: lastUpdated || "—", color: "text-zinc-400" },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-zinc-800 rounded-lg p-2 text-center">
            <div className="text-xs text-zinc-500">{label}</div>
            <div className={`text-xs font-bold ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Per-strategy mini-stats */}
      {data?.summary && (
        <div className="grid grid-cols-3 gap-1.5">
          {Object.entries(data.summary).map(([type, s]: [string, any]) => (
            <div key={type} className="bg-zinc-800 rounded-lg p-2">
              <div className={`text-xs font-semibold px-1.5 py-0.5 rounded inline-block mb-1 ${TYPE_COLORS[type] || "bg-zinc-700 text-zinc-300"}`}>{TYPE_LABELS[type] || type}</div>
              <div className="text-xs text-zinc-300">{s.openCount} open · ${s.exposureUsd}</div>
              <div className={`text-xs ${Number(s.unrealizedPnl) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                P&L {Number(s.unrealizedPnl) >= 0 ? "+" : ""}{s.unrealizedPnl}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live position rows */}
      {allPositions.length > 0 ? (
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {allPositions.map((p: any) => (
            <div key={p.id} className="bg-zinc-800 rounded px-2 py-1.5 flex items-center gap-2">
              <span className={`text-xs px-1 py-0.5 rounded shrink-0 ${TYPE_COLORS[p._type] || "bg-zinc-700 text-zinc-300"}`}>
                {TYPE_LABELS[p._type] || p._type}
              </span>
              <span className="text-xs text-zinc-200 font-medium">{p.tokenIn} → {p.tokenOut}</span>
              <span className="text-xs text-zinc-500">{p.chain}</span>
              <span className="text-xs text-zinc-400 ml-auto">${p.amount}</span>
              <span className={`text-xs ${(p.unrealizedPnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {(p.unrealizedPnl || 0) >= 0 ? "+" : ""}{(p.unrealizedPnl || 0).toFixed(2)}
              </span>
              <span className="text-xs text-zinc-600">{new Date(p.openedAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-zinc-500 bg-zinc-800 rounded-lg p-3 text-center">
          {data ? "No open positions — executor is idle" : "Connecting to executor…"}
        </div>
      )}

      <button onClick={load} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs py-1.5 rounded-lg transition-all">
        Refresh
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PositionPanel — shared component for Copy Trader + Funding Rate Arb
// Shows live positions, P&L, exposure, and throttle controls
// ---------------------------------------------------------------------------
function PositionPanel({ type, triggerPath, triggerBody, triggerLabel, triggerColor }: {
  type: string;
  triggerPath: string;
  triggerBody: object;
  triggerLabel: string;
  triggerColor: string;
}) {
  const EXECUTOR_BASE = process.env.NEXT_PUBLIC_EXECUTOR_URL || "https://gsb-yield-swarm-production.up.railway.app";
  const [positions, setPositions] = React.useState<any>(null);
  const [throttle, setThrottleState] = React.useState<any>(null);
  const [editing, setEditing] = React.useState(false);
  const [maxSize, setMaxSize] = React.useState("");

  const load = async () => {
    try {
      const r = await fetch(`${EXECUTOR_BASE}/api/positions`);
      const d = await r.json();
      const s = d.summary?.[type];
      if (s) { setPositions(s); setThrottleState(s.throttle); setMaxSize(String(s.throttle?.maxPositionUsd || "")); }
    } catch {}
  };

  React.useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const saveThrottle = async (enabled?: boolean) => {
    try {
      await fetch(`${EXECUTOR_BASE}/api/positions/throttle`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, enabled: enabled ?? throttle?.enabled, maxPositionUsd: Number(maxSize) }),
      });
      toast.success("Throttle updated");
      setEditing(false);
      load();
    } catch { toast.error("Failed to update throttle"); }
  };

  const colorMap: Record<string, string> = {
    blue: "bg-blue-700 hover:bg-blue-600",
    emerald: "bg-emerald-700 hover:bg-emerald-600",
  };
  const btnCls = colorMap[triggerColor] || "bg-zinc-700 hover:bg-zinc-600";

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        {[{label:"Open",val:positions?.openCount??"—"},{label:"Exposure",val:positions?`$${positions.exposureUsd}`:"—"},{label:"Unreal. P&L",val:positions?`$${positions.unrealizedPnl}`:"—"}].map(({label,val})=>(
          <div key={label} className="bg-zinc-800 rounded-lg p-2 text-center">
            <div className="text-xs text-zinc-500">{label}</div>
            <div className="text-sm font-bold text-white">{val}</div>
          </div>
        ))}
      </div>

      {/* Open positions list */}
      {positions?.positions?.length > 0 ? (
        <div className="space-y-1 max-h-28 overflow-y-auto">
          {positions.positions.map((p: any) => (
            <div key={p.id} className="bg-zinc-800 rounded px-2 py-1 flex justify-between items-center">
              <span className="text-xs text-zinc-300">{p.tokenOut} <span className="text-zinc-500">{p.chain}</span></span>
              <span className="text-xs text-zinc-400">${p.amount}</span>
              <span className={`text-xs ${(p.unrealizedPnl||0)>=0?"text-emerald-400":"text-red-400"}`}>
                {(p.unrealizedPnl||0)>=0?"+":""}{(p.unrealizedPnl||0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-zinc-500 bg-zinc-800 rounded-lg p-2 text-center">No open positions</div>
      )}

      {/* Throttle controls */}
      <div className="bg-zinc-800 rounded-lg p-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-400">Throttle</span>
          <div className="flex items-center gap-2">
            <button onClick={() => saveThrottle(!throttle?.enabled)}
              className={`text-xs px-2 py-0.5 rounded ${throttle?.enabled?"bg-emerald-700 text-emerald-200":"bg-zinc-700 text-zinc-400"}`}>
              {throttle?.enabled ? "ON" : "OFF"}
            </button>
            <button onClick={() => setEditing(!editing)} className="text-xs text-zinc-500 hover:text-zinc-300">Edit</button>
          </div>
        </div>
        {editing && (
          <div className="flex gap-2 mt-1">
            <input value={maxSize} onChange={e => setMaxSize(e.target.value)}
              className="flex-1 bg-zinc-700 text-white text-xs rounded px-2 py-1 w-full"
              placeholder="Max $ per position" />
            <button onClick={() => saveThrottle()} className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 rounded">Save</button>
          </div>
        )}
        <div className="text-xs text-zinc-600 mt-1">Max: ${throttle?.maxPositionUsd} • Max open: {throttle?.maxOpenPositions}</div>
      </div>

      {/* Trigger button */}
      <button onClick={async () => {
        try {
          await fetch(`${EXECUTOR_BASE}${triggerPath}`, {
            method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(triggerBody),
          });
          toast.success("Triggered");
          setTimeout(load, 2000);
        } catch { toast.error("Failed"); }
      }} className={`w-full ${btnCls} text-white text-xs py-2 rounded-lg transition-all`}>
        {triggerLabel}
      </button>
    </div>
  );
}

function Panel({ title, subtitle, icon: Icon, iconColor = "text-zinc-400", children, className = "" }: {
  title: string; subtitle?: string; icon: React.ElementType;
  iconColor?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden ${className}`}>
      <div className="px-4 pt-4 pb-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <Icon size={16} className={iconColor} />
          <span className="text-sm font-semibold text-zinc-100">{title}</span>
        </div>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5 ml-6">{subtitle}</p>}
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

// ─── Main War Room ─────────────────────────────────────────────────────────
export default function WarRoom() {
  const [cooking, setCooking]           = useState(false);
  const [aborting, setAborting]         = useState(false);
  const [timeHorizon, setTimeHorizon]   = useState("immediate");
  const [playbook, setPlaybook]         = useState<Playbook | null>(null);
  const [feed, setFeed]                 = useState<FeedEvent[]>([]);
  const [wallets, setWallets]           = useState<Record<string, WalletState>>({});
  const [uma, setUma]                   = useState<UMAAssertion[]>([]);
  const [prices, setPrices]             = useState<Price[]>([]);
  const [executingStep, setExecutingStep] = useState<number | null>(null);
  const [autoFire, setAutoFire]         = useState(false);
  const autoFireRef                     = useRef(false);
  autoFireRef.current                   = autoFire;

  // ── Data fetchers ────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${ACP_BASE}/api/strategy/status`);
      if (!r.ok) return;
      const d = await r.json();
      if (d.wallets?.wallets) setWallets(d.wallets.wallets);
      if (d.playbook)         setPlaybook(d.playbook);
      if (d.feed)             setFeed(d.feed);
    } catch { /* silent */ }
    // Fetch hot wallet balances directly from executor
    try {
      const wr = await fetch(`${EXECUTOR_BASE}/api/debug/balances`);
      if (wr.ok) {
        const wd = await wr.json();
        // wd is { base: {...}, solana: {...}, tempo: {...} }
        if (wd && typeof wd === 'object' && !wd.error) setWallets(wd);
      }
    } catch { /* silent */ }
  }, []);

  const fetchUMA = useCallback(async () => {
    try {
      const r = await fetch(`${ACP_BASE}/uma/pending`);
      if (r.ok) { const d = await r.json(); setUma(d.assertions || []); }
    } catch { /* silent */ }
  }, []);

  const fetchPrices = useCallback(async () => {
    const tokens = ["BTC", "ETH", "SOL"];
    const results = await Promise.all(tokens.map(async (t) => {
      try {
        const r = await fetch(`${EXECUTOR_BASE}/api/price/${t}`);
        if (r.ok) { const d = await r.json(); return { token: t, price: d.price }; }
        return { token: t, price: null, error: "unavailable" };
      } catch { return { token: t, price: null, error: "error" }; }
    }));
    // also fetch SOL from executor's /api/price/SOL — already included above
    setPrices(results);
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchUMA();
    fetchPrices();
    const iv = setInterval(() => { fetchStatus(); fetchUMA(); fetchPrices(); }, 30000);
    return () => clearInterval(iv);
  }, [fetchStatus, fetchUMA, fetchPrices]);

  // ── Let Agents Cook ──────────────────────────────────────────────────────
  const handleCook = async () => {
    setCooking(true);
    setAutoFire(true);
    toast.info(`Agents cooking — horizon: ${timeHorizon}`);
    try {
      const r = await fetch(`${ACP_BASE}/api/strategy/cook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeHorizon }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Cook failed");

      // Backend fires workers async — poll /api/strategy/status until latestBrief appears
      const pollStart = Date.now();
      const poll = setInterval(async () => {
        try {
          const sr = await fetch(`${ACP_BASE}/api/strategy/status`, {
            headers: { "x-gsb-token": localStorage.getItem("gsb_token") || "" },
          });
          const sd = await sr.json();
          // Update feed from workers as they report in
          if (sd.feed) setFeed(sd.feed);
          if (sd.latestBrief) {
            clearInterval(poll);
            setCooking(false);
            const brief = sd.latestBrief;
            // Map brief into playbook shape the UI expects
            const steps: PlaybookStep[] = Object.entries(brief.results || {}).map(([worker, res]: [string, any], i) => ({
              step: i + 1,
              agentId: worker,
              action: res.raw ? res.raw.slice(0, 120) + "…" : (res.error || "No result"),
              token: "",
              chain: "base",
              amount: 0,
              timeframe: "immediate",
              expectedPnl: 0,
              confidence: 0,
              reasoning: res.raw || res.error || "",
              requiresApproval: false,
              status: res.error ? "failed" as const : "pending" as const,
            }));
            const synthesized = brief.ceoSynthesis?.recommendation || brief.ceoSynthesis?.raw || "";
            const pb: Playbook = {
              steps,
              totalExpectedPnl: "0",
              conflicts: [],
              entanglementWarnings: [],
              generatedAt: new Date().toISOString(),
              requiresBoardApproval: false,
            };
            setPlaybook(pb);
            setFeed(prev => [{ type: "playbook_ready", message: `Playbook ready — ${steps.length} workers reported`, severity: "success", ts: new Date().toISOString() }, ...prev]);
            toast.success(`Playbook ready — ${steps.length} workers reported`);
          } else if (Date.now() - pollStart > 120000) {
            // Timeout after 2 min
            clearInterval(poll);
            setCooking(false);
            toast.warning("Agents still cooking — check back shortly");
          }
        } catch { /* silent */ }
      }, 4000);

    } catch (e: unknown) {
      toast.error("Cook failed");
      setAutoFire(false);
      setCooking(false);
    }
  };

  const handleAbort = () => {
    setAborting(true);
    setAutoFire(false);
    setFeed(prev => [{ type: "abort", message: "Playbook aborted by board.", severity: "warning", ts: new Date().toISOString() }, ...prev]);
    toast.warning("Playbook aborted");
    setTimeout(() => setAborting(false), 1000);
  };

  const executeStep = async (step: PlaybookStep) => {
    if (step.requiresApproval) {
      toast.warning(`Step ${step.step} requires board approval (>$1000). Confirm in Railway or approve via dashboard.`);
      return;
    }
    setExecutingStep(step.step);
    try {
      const r = await fetch(`${ACP_BASE}/api/strategy/execute/${step.step}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(`Step ${step.step} completed`);
        setFeed(prev => [{ type: "step_completed", message: `Step ${step.step}: ${step.action} ${step.token} — done`, severity: "success", ts: new Date().toISOString() }, ...prev]);
        setPlaybook(prev => prev ? { ...prev, steps: prev.steps.map(s => s.step === step.step ? { ...s, status: "completed" } : s) } : prev);
      }
    } catch { toast.error(`Step ${step.step} failed`); }
    finally { setExecutingStep(null); }
  };

  const totalBalance = Object.values(wallets).reduce((s, w) => s + (w.balance || 0), 0);
  const bankruptWallets = Object.entries(wallets).filter(([, w]) => w.status === "bankrupt");

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 px-6 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">⚔️ GSB War Room</h1>
          <p className="text-xs text-zinc-500">Game-theory strategy engine — all agents visible, all chains entangled</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time horizon */}
          <select
            value={timeHorizon}
            onChange={e => setTimeHorizon(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 rounded-lg px-3 py-2 focus:outline-none"
          >
            {TIME_HORIZONS.map(h => (
              <option key={h.value} value={h.value}>{h.label} — {h.desc}</option>
            ))}
          </select>

          {/* Abort */}
          {autoFire && (
            <button
              onClick={handleAbort}
              className="flex items-center gap-2 bg-red-700 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-xl transition-all"
            >
              <Square size={14} /> Abort
            </button>
          )}

          {/* Cook */}
          <button
            onClick={handleCook}
            disabled={cooking}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all shadow-lg"
          >
            {cooking ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
            {cooking ? "Cooking…" : "Let Agents Cook"}
          </button>
        </div>
      </div>

      {/* ── 10-Panel Grid ── */}
      <div className="flex-1 overflow-hidden p-4 grid gap-3" style={{ gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(3, 1fr)" }}>

        {/* Panel 1 — Hot Wallets */}
        <Panel title="Hot Wallets" subtitle="Self-contained — bankruptcy = no execution" icon={Wallet} iconColor="text-emerald-400">
          <div className="space-y-3">
            <div className="text-2xl font-mono font-bold text-emerald-400">${totalBalance.toFixed(2)}</div>
            <p className="text-xs text-zinc-500">Combined balance across all chains</p>
            {bankruptWallets.length > 0 && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-2 text-xs text-red-300">
                🚨 Bankrupt: {bankruptWallets.map(([c]) => c).join(", ")}
              </div>
            )}
            {Object.entries(wallets).map(([chain, w]) => (
              <div key={chain} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div>
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${CHAIN_COLORS[chain] || "bg-zinc-800 text-zinc-300"}`}>{chain}</span>
                  <span className="text-xs text-zinc-500 ml-2">{w.currency}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-semibold">${(w.balance || 0).toFixed(2)}</div>
                  <div className={`text-xs ${STATUS_COLORS[w.status]}`}>{w.status}</div>
                </div>
              </div>
            ))}
            {Object.keys(wallets).length === 0 && (
              <p className="text-xs text-zinc-600">Set HOT_WALLET_BASE/SOLANA/TEMPO in Railway</p>
            )}
          </div>
        </Panel>

        {/* Panel 2 — Chainlink Prices */}
        <Panel title="Chainlink Prices" subtitle="Live oracle feeds — Base network" icon={TrendingUp} iconColor="text-blue-400">
          <div className="space-y-4">
            {prices.length === 0 && <p className="text-xs text-zinc-600">Set CHAINLINK_* env vars in Railway</p>}
            {prices.map(p => (
              <div key={p.token} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div>
                  <div className="text-sm font-bold text-zinc-100">{p.token}/USD</div>
                  <div className="text-xs text-zinc-500">Chainlink Base feed</div>
                </div>
                <div className="text-right">
                  {p.price ? (
                    <div className="text-lg font-mono font-bold text-blue-300">${p.price.toLocaleString()}</div>
                  ) : (
                    <div className="text-xs text-zinc-600">{p.error || "loading"}</div>
                  )}
                </div>
              </div>
            ))}
            <p className="text-xs text-zinc-600 pt-1">Auto-refreshes every 30s. Breakout detector runs if price moves &gt;5%</p>
          </div>
        </Panel>

        {/* Panel 3 — UMA Assertions */}
        <Panel title="UMA Oracle" subtitle="Bonded assertions — Base OOv3" icon={AlertTriangle} iconColor="text-amber-400">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-zinc-800 rounded-lg p-2">
                <div className="text-lg font-mono font-bold text-amber-400">{uma.filter(a => !a.settled).length}</div>
                <div className="text-xs text-zinc-500">Active</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-2">
                <div className="text-lg font-mono font-bold text-green-400">{uma.filter(a => a.settled).length}</div>
                <div className="text-xs text-zinc-500">Settled</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-2">
                <div className="text-lg font-mono font-bold text-red-400">0</div>
                <div className="text-xs text-zinc-500">Disputed</div>
              </div>
            </div>
            {uma.length === 0 ? (
              <p className="text-xs text-zinc-600">No active assertions. Breakout detector posts automatically when signals fire.</p>
            ) : uma.slice(0, 3).map(a => (
              <div key={a.assertionId} className="bg-zinc-800 rounded-lg p-2">
                <div className="text-xs font-mono text-zinc-400">{a.assertionId.slice(0, 14)}…</div>
                <div className="text-xs text-zinc-500">{a.signal.direction} {a.signal.token} · ${a.signal.amount}</div>
                <div className={`text-xs mt-0.5 ${a.settled ? "text-green-400" : "text-amber-400"}`}>
                  {a.settled ? "Settled" : `Expires ${new Date(a.expiresAt).toLocaleTimeString()}`}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Panel 4 — Tempo Yield */}
        <Panel title="Tempo Yield" subtitle="DEX flip orders — continuous maker yield" icon={Activity} iconColor="text-violet-400">
          <div className="space-y-3">
            <div className="bg-zinc-800 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Position Size</div>
              <div className="text-2xl font-mono font-bold text-violet-400">$0.90</div>
              <div className="text-xs text-zinc-500 mt-1">pathUSD flip order — auto-switches buy↔sell on fill</div>
            </div>
            <div className="bg-zinc-800 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">How it works</div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Executor approves pathUSD → places flip order at tick 0 → when filled, order auto-reverses. 
                Earns maker spread continuously. Increases position size as balance grows.
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  const r = await fetch(`${"https://gsb-yield-swarm-production.up.railway.app"}/trigger/tempo_yield`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
                  const d = await r.json();
                  toast.success(d.result?.success ? "Flip order placed" : "Tempo yield triggered");
                } catch { toast.error("Failed to trigger Tempo yield"); }
              }}
              className="w-full bg-violet-700 hover:bg-violet-600 text-white text-xs py-2 rounded-lg transition-all"
            >
              Trigger Flip Order Manually
            </button>
          </div>
        </Panel>

        {/* Panel 5 — Agents */}
        <Panel title="Agent Roster" subtitle="Each agent runs its own strategy independently" icon={Brain} iconColor="text-pink-400">
          <div className="space-y-2">
            {AGENTS.map(a => (
              <div key={a.id} className="flex items-start gap-2 py-2 border-b border-zinc-800 last:border-0">
                <a.icon size={14} className={`${a.color} mt-0.5 shrink-0`} />
                <div>
                  <div className="text-xs font-semibold text-zinc-200">{a.label}</div>
                  <div className="text-xs text-zinc-500">{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Panel 6 — Playbook (spans 2 cols) */}
        <Panel title="CEO Playbook" subtitle="Nash equilibrium — agents' strategies resolved into ordered steps" icon={Zap} iconColor="text-amber-400" className="col-span-2">
          {!playbook ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3">
              <Brain size={32} className="text-zinc-700" />
              <p className="text-zinc-500 text-sm">No active playbook.</p>
              <p className="text-zinc-600 text-xs">Press <strong className="text-amber-400">Let Agents Cook</strong> to generate a strategy.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                <span>{playbook.steps.length} steps · Est. P&L: <strong className="text-green-400">${playbook.totalExpectedPnl}</strong></span>
                <span>{new Date(playbook.generatedAt).toLocaleTimeString()}</span>
              </div>
              {playbook.conflicts.length > 0 && (
                <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-2 text-xs text-amber-300 mb-2">
                  ⚔️ {playbook.conflicts.length} conflict(s) resolved via Nash equilibrium
                </div>
              )}
              {playbook.entanglementWarnings?.map((w, i) => (
                <div key={i} className="bg-red-900/20 border border-red-800/50 rounded-lg p-2 text-xs text-red-300 mb-2">
                  🪢 {w.message}
                </div>
              ))}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {playbook.steps.map(step => (
                  <div key={step.step} className={`border rounded-lg p-3 transition-all ${
                    step.status === "completed" ? "border-green-800 bg-green-900/10" :
                    step.status === "running"   ? "border-amber-800 bg-amber-900/10" :
                    step.status === "failed"    ? "border-red-800 bg-red-900/10" :
                    "border-zinc-800"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-zinc-500">#{step.step}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${CHAIN_COLORS[step.chain] || "bg-zinc-800 text-zinc-300"}`}>{step.chain}</span>
                        <span className="text-xs font-semibold text-zinc-100">{step.action} {step.token}</span>
                        {step.requiresApproval && <span className="text-xs bg-red-900/50 text-red-300 px-1.5 rounded">Board Approval</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">${step.amount} · +${step.expectedPnl}</span>
                        {step.status === "completed" ? <CheckCircle size={12} className="text-green-400" /> :
                         step.status === "failed"    ? <XCircle size={12} className="text-red-400" /> :
                         step.status === "running"   ? <RefreshCw size={12} className="text-amber-400 animate-spin" /> :
                         autoFire && !step.requiresApproval ? (
                           <button onClick={() => executeStep(step)} disabled={executingStep === step.step} className="text-xs bg-amber-700 hover:bg-amber-600 px-2 py-0.5 rounded transition-all disabled:opacity-50">
                             {executingStep === step.step ? "…" : "Fire"}
                           </button>
                         ) : (
                           <button onClick={() => executeStep(step)} className="text-xs bg-zinc-700 hover:bg-zinc-600 px-2 py-0.5 rounded transition-all">
                             <Play size={10} />
                           </button>
                         )}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 ml-6">{step.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* Panel 7 — Live Feed (spans 1 col, 2 rows) */}
        <Panel title="Live Feed" subtitle="Every agent action documented in real time" icon={Activity} iconColor="text-green-400" className="row-span-2">
          <div className="space-y-2">
            {feed.length === 0 && <p className="text-xs text-zinc-600">No events yet. Start cooking to see agent actions here.</p>}
            {feed.map((event, i) => (
              <div key={i} className={`border-l-2 pl-2 py-1 ${
                event.severity === "error"   ? "border-red-600" :
                event.severity === "warning" ? "border-amber-600" :
                event.severity === "success" ? "border-green-600" :
                "border-zinc-700"
              }`}>
                <div className={`text-xs font-medium ${
                  event.severity === "error"   ? "text-red-300" :
                  event.severity === "warning" ? "text-amber-300" :
                  event.severity === "success" ? "text-green-300" :
                  "text-zinc-300"
                }`}>{event.message}</div>
                <div className="text-xs text-zinc-600">{new Date(event.ts).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Panel 8 — Copy Trader */}
        <Panel title="Copy Trader" subtitle="Smart money signal copy — live positions" icon={Users} iconColor="text-blue-400">
          <PositionPanel type="copy_trade" triggerPath="/trigger/copy_trade"
            triggerBody={{ signal: { token: "VIRTUAL", chain: "base", amount: 25 } }}
            triggerLabel="Manual Copy Trade Trigger" triggerColor="blue" />
        </Panel>

        {/* Panel 9 — Funding Rate Arb */}
        <Panel title="Funding Rate Arb" subtitle="Hyperliquid / Bybit / Tempo rate comparison" icon={DollarSign} iconColor="text-emerald-400">
          <PositionPanel type="funding_arb" triggerPath="/trigger/funding_rate_arb"
            triggerBody={{}}
            triggerLabel="Scan Rates Now" triggerColor="emerald" />
        </Panel>

        {/* Panel 10 — Live Trades */}
        <Panel title="Live Trades" subtitle="All open positions — copy trader · funding arb · tempo yield" icon={ArrowRightLeft} iconColor="text-cyan-400">
          <LiveTradesPanel />
        </Panel>

      </div>
    </div>
  );
}
