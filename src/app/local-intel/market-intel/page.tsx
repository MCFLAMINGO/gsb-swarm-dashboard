"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle,
  BarChart2, Zap, Eye, Clock, ChevronDown, ChevronUp
} from "lucide-react";

const RAILWAY = "https://gsb-swarm-production.up.railway.app";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TradeSignal {
  id: number;
  ticker: string;
  company: string;
  direction: "LONG" | "SHORT" | "WATCH";
  confidence: number;
  thesis: string;
  signal_source: string;
  signal_value: string;
  data_vintage: string;
  options_note: string | null;
  risk_note: string;
  status: string;
  scored_at: string;
  expires_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function directionStyle(d: string) {
  if (d === "LONG")  return { bg: "bg-green-500/10",  text: "text-green-400",  border: "border-green-500/20"  };
  if (d === "SHORT") return { bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/20"    };
  return               { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" };
}

function confidenceBar(score: number) {
  const color = score >= 65 ? "bg-green-500" : score >= 45 ? "bg-yellow-500" : "bg-red-500";
  return { width: `${score}%`, color };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function DirectionIcon({ d }: { d: string }) {
  if (d === "LONG")  return <TrendingUp  className="w-4 h-4 text-green-400" />;
  if (d === "SHORT") return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-yellow-400" />;
}

// ── Data fetch ────────────────────────────────────────────────────────────────

async function fetchSignals(): Promise<TradeSignal[]> {
  const res = await fetch(`${RAILWAY}/api/local-intel/trade-signals`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.signals ?? [];
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MarketIntelPage() {
  const [signals, setSignals]     = useState<TradeSignal[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<number | null>(null);
  const [filter, setFilter]       = useState<"ALL" | "LONG" | "SHORT" | "WATCH">("ALL");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSignals();
      setSignals(data);
      setLastRefresh(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Auto-retry up to 3× with 5s delay when DB is still warming at boot
    let retries = 0;
    async function loadWithRetry() {
      await load();
      // If we got 0 signals and no hard error, retry — DB may still be booting
      setSignals(prev => {
        if (prev.length === 0 && retries < 3) {
          retries++;
          setTimeout(loadWithRetry, 5000);
        }
        return prev;
      });
    }
    loadWithRetry();
  }, []);

  const filtered = filter === "ALL" ? signals : signals.filter(s => s.direction === filter);
  const longs    = signals.filter(s => s.direction === "LONG").length;
  const shorts   = signals.filter(s => s.direction === "SHORT").length;
  const watches  = signals.filter(s => s.direction === "WATCH").length;
  const avgConf  = signals.length > 0
    ? Math.round(signals.reduce((s, r) => s + r.confidence, 0) / signals.length)
    : 0;

  return (
    <div className="flex-1 overflow-y-auto">

      {/* Header */}
      <div className="border-b border-border px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary" />
            Market Intel
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            FL-concentrated equity signals scored against LocalIntel Postgres data · Updated weekly
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* Disclaimer */}
        <div className="flex items-start gap-2.5 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-xs text-yellow-200/70 leading-relaxed">
            These are data-driven hypotheses, not financial advice. Signals are scored against
            FL-specific LocalIntel data (permits, BFS formation, NES operators, migration).
            All positions carry risk. Options can go to zero. Do your own research.
          </p>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Long",    value: longs,    color: "text-green-400",  icon: TrendingUp  },
            { label: "Short",   value: shorts,   color: "text-red-400",    icon: TrendingDown },
            { label: "Watch",   value: watches,  color: "text-yellow-400", icon: Eye         },
            { label: "Avg Conf",value: `${avgConf}`, color: avgConf >= 60 ? "text-green-400" : "text-yellow-400", icon: Zap },
          ].map(t => (
            <div key={t.label} className="rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{t.label}</span>
                <t.icon className={`w-3.5 h-3.5 ${t.color}`} />
              </div>
              <p className={`text-2xl font-bold ${t.color}`}>{t.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {(["ALL","LONG","SHORT","WATCH"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              {f}
            </button>
          ))}
          <span className="ml-2 text-xs text-muted-foreground">{filtered.length} signals</span>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-400">
            Failed to load signals: {error} — tradeSignalWorker may not have run yet.
          </div>
        )}

        {/* Loading state */}
        {loading && !error && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-border bg-secondary/20 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-secondary/20 px-6 py-12 text-center">
            <BarChart2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No signals yet.</p>
            <p className="text-xs text-muted-foreground mt-1">tradeSignalWorker runs weekly after macro data populates.</p>
          </div>
        )}

        {/* Signal cards */}
        {!loading && filtered.map(s => {
          const dir    = directionStyle(s.direction);
          const bar    = confidenceBar(s.confidence);
          const isOpen = expanded === s.id;

          return (
            <div key={s.id}
              className={`rounded-xl border ${dir.border} ${dir.bg} overflow-hidden transition-all`}>

              {/* Main row */}
              <button
                onClick={() => setExpanded(isOpen ? null : s.id)}
                className="w-full text-left px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <DirectionIcon d={s.direction} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold font-mono">{s.ticker}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dir.bg} ${dir.text} border ${dir.border}`}>
                          {s.direction}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{s.company}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${bar.color}`} style={{ width: bar.width }} />
                        </div>
                        <span className={`text-sm font-bold ${dir.text}`}>{s.confidence}</span>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Thesis preview */}
                <p className="text-xs text-muted-foreground/80 mt-2 leading-relaxed line-clamp-2">
                  {s.thesis}
                </p>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-border/50 px-5 py-4 space-y-4 bg-background/30">

                  {/* Thesis */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Thesis</p>
                    <p className="text-sm leading-relaxed">{s.thesis}</p>
                  </div>

                  {/* Signal value */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">LocalIntel Signal</p>
                    <p className="text-xs font-mono bg-secondary/50 rounded-lg px-3 py-2 leading-relaxed">
                      {s.signal_value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Source: {s.signal_source}</p>
                  </div>

                  {/* Options note */}
                  {s.options_note && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                      <p className="text-xs font-semibold text-primary mb-0.5">Options Play</p>
                      <p className="text-xs leading-relaxed">{s.options_note}</p>
                    </div>
                  )}

                  {/* Risk */}
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                    <p className="text-xs font-semibold text-red-400 mb-0.5">Key Risk</p>
                    <p className="text-xs text-red-300/70 leading-relaxed">{s.risk_note}</p>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground/50">
                    <span>Scored {timeAgo(s.scored_at)} · data: {s.data_vintage}</span>
                    <span>Expires {new Date(s.expires_at).toLocaleDateString()}</span>
                  </div>

                </div>
              )}
            </div>
          );
        })}

        {/* Footer note */}
        {!loading && signals.length > 0 && (
          <p className="text-xs text-muted-foreground/40 text-center pb-4">
            Signals scored by tradeSignalWorker reading LocalIntel Postgres data.
            Ask your LLM: "read trade_signals and build a $1k options plan" for full reasoning.
          </p>
        )}
      </div>
    </div>
  );
}
