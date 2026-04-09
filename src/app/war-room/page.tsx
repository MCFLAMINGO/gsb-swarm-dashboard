"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Brain, Zap, Wallet, TrendingUp, Search, BarChart2,
  Users, FileText, AlertTriangle, Clock, CheckCircle,
  XCircle, Play, Square, RefreshCw, ChevronRight,
  Activity, DollarSign
} from "lucide-react";

const EXECUTOR_BASE = process.env.NEXT_PUBLIC_EXECUTOR_URL || "https://gsb-swarm-production.up.railway.app";

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
      const r = await fetch(`${EXECUTOR_BASE}/api/strategy/status`);
      if (!r.ok) return;
      const d = await r.json();
      if (d.wallets?.wallets) setWallets(d.wallets.wallets);
      if (d.playbook)         setPlaybook(d.playbook);
      if (d.feed)             setFeed(d.feed);
    } catch { /* silent */ }
  }, []);

  const fetchUMA = useCallback(async () => {
    try {
      const r = await fetch(`${EXECUTOR_BASE}/uma/pending`);
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
      const r = await fetch(`${EXECUTOR_BASE}/api/strategy/cook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeHorizon }),
      });
      const d = await r.json();
      if (d.playbook) {
        setPlaybook(d.playbook);
        setFeed(prev => [{ type: "playbook_ready", message: `Playbook ready — ${d.playbook.steps.length} steps, est. $${d.playbook.totalExpectedPnl}`, severity: "success", ts: new Date().toISOString() }, ...prev]);
        toast.success(`Playbook ready — ${d.playbook.steps.length} steps`);
        if (d.playbook.requiresBoardApproval) {
          toast.warning("⚠️ Board approval required for 1+ steps > $1000");
          setAutoFire(false);
        }
      }
    } catch (e: unknown) {
      toast.error("Cook failed");
      setAutoFire(false);
    } finally {
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
      const r = await fetch(`${EXECUTOR_BASE}/api/strategy/execute/${step.step}`, {
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
                  const r = await fetch(`${EXECUTOR_BASE}/trigger/tempo_yield`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
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
          <div className="space-y-3">
            <div className="bg-zinc-800 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">How it works</div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Wallet Profiler detects when smart money wallets accumulate a token. 
                Copy trade fires automatically within the 2h timeframe. Position size: $25 default.
              </p>
            </div>
            <div className="bg-zinc-800 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Signal Status</div>
              <div className="text-xs text-zinc-400">Monitoring active wallets. Signal auto-feeds into playbook when detected.</div>
            </div>
            <button
              onClick={async () => {
                try {
                  const r = await fetch(`${EXECUTOR_BASE}/trigger/copy_trade`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ signal: { token: "VIRTUAL", chain: "base", amount: 25 } }),
                  });
                  toast.success("Copy trade triggered");
                } catch { toast.error("Failed"); }
              }}
              className="w-full bg-blue-700 hover:bg-blue-600 text-white text-xs py-2 rounded-lg transition-all"
            >
              Manual Copy Trade Trigger
            </button>
          </div>
        </Panel>

        {/* Panel 9 — Funding Rate Arb */}
        <Panel title="Funding Rate Arb" subtitle="Hyperliquid / Bybit / Tempo rate comparison" icon={DollarSign} iconColor="text-emerald-400">
          <div className="space-y-3">
            <div className="bg-zinc-800 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Strategy</div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Scans funding rates across perpetual venues. When rate differential &gt;0.1% favors a direction, 
                opens delta-neutral position to capture the spread. Auto-closes when rate normalizes.
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  await fetch(`${EXECUTOR_BASE}/trigger/funding_rate_arb`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
                  toast.success("Funding rate arb triggered");
                } catch { toast.error("Failed"); }
              }}
              className="w-full bg-emerald-700 hover:bg-emerald-600 text-white text-xs py-2 rounded-lg transition-all"
            >
              Scan Rates Now
            </button>
          </div>
        </Panel>

        {/* Panel 10 — Revenue Streams */}
        <Panel title="Revenue Streams" subtitle="Raiders + bleeding.cash + new opportunities" icon={DollarSign} iconColor="text-pink-400">
          <div className="space-y-2">
            <div className="bg-zinc-800 rounded-lg p-2">
              <div className="text-xs font-semibold text-pink-300 mb-0.5">⚔️ Raiders of the Chain</div>
              <p className="text-xs text-zinc-500">Agents identify trending tokens → launch coordinated raids → collect raid kit fees. Thread Writer posts raid signal.</p>
              <a href="https://raiders-of-the-chain.vercel.app" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 flex items-center gap-1 mt-1">Launch <ChevronRight size={10} /></a>
            </div>
            <div className="bg-zinc-800 rounded-lg p-2">
              <div className="text-xs font-semibold text-red-300 mb-0.5">💊 bleeding.cash</div>
              <p className="text-xs text-zinc-500">Restaurant financial triage. CEO agent can refer leads. $24.95/report.</p>
              <a href="https://www.bleeding.cash" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 flex items-center gap-1 mt-1">View <ChevronRight size={10} /></a>
            </div>
            <div className="bg-zinc-800 rounded-lg p-2">
              <div className="text-xs font-semibold text-amber-300 mb-0.5">💡 New Opportunities</div>
              <p className="text-xs text-zinc-500">CEO surfaces agentically-friendly digital product ideas in morning brief. No physical shipping unless exceptional.</p>
            </div>
          </div>
        </Panel>

      </div>
    </div>
  );
}
