"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Brain, Crosshair, Network, Bot, Search, RefreshCw,
  CheckCircle2, AlertTriangle, GitBranch, Zap, Activity
} from "lucide-react";

const TEAM = [
  { role: "Chief Analyst", name: "Elite / Equity Analyst", href: "/elite-deep-dive", note: "Thesis · desk voice · contrarian · ROI plan" },
  { role: "Token / On-chain", name: "Token Analyst + Alpha", href: "/team", note: "Liquidity, whales, early signals" },
  { role: "Wallet / Flow", name: "Wallet Profiler", href: "/team", note: "Holdings, smart money, DCA" },
  { role: "Macro / Nodes", name: "LocalIntel Node Model", href: "/macro", note: "FRED · ZIP · market intel → desk" },
  { role: "CEO Orchestrator", name: "ACP CEO", href: "/team", note: "Cook swarm · Virtuals hire" },
  { role: "Execution", name: "Robinhood · Copy · THROW", href: "/execute", note: "Review → place · copy · Tempo tape" },
];

export default function DeskHomePage() {
  const [query, setQuery] = useState("NVDA");
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [rhStatus, setRhStatus] = useState<any>(null);
  const [sources, setSources] = useState<any>(null);

  useEffect(() => {
    fetch("/api/elite-analysis", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSources(d.sources || null))
      .catch(() => undefined);
    fetch("/api/robinhood?action=status", { cache: "no-store" })
      .then((r) => r.json())
      .then(setRhStatus)
      .catch(() => setRhStatus({ configured: false }));
  }, []);

  function runDesk() {
    const q = query.trim();
    if (!q) return;
    setError(null);
    setReport(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/elite-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, assetType: "auto", includeSynthesis: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setReport(data.report);
        if (data.sources) setSources((prev: any) => ({ ...(prev || {}), ...data.sources }));
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  async function connectRobinhood() {
    try {
      const res = await fetch("/api/robinhood?action=connect", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.authorize_url) window.open(data.authorize_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const verdict = report?.verdict?.verdict;
  const contra = report?.trade_plan?.contrarian_play || report?.institutional?.contrarian_play;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 md:p-8 space-y-6 max-w-5xl">
        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">GSB Trading Desk</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Your team. One loop.
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Macro in → Elite decides → ACP team debates → Execute on Robinhood / Copy / THROW.
            LocalIntel nodes feed the desk — they are not a second product.
          </p>
        </header>

        {/* Desk run */}
        <section className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> Chief Analyst — Run desk
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {sources?.fred ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <AlertTriangle className="h-3 w-3 text-amber-400" />}
                FRED
              </span>
              <span className="inline-flex items-center gap-1">
                {sources?.nvidia_nim ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <AlertTriangle className="h-3 w-3 text-amber-400" />}
                NIM
              </span>
              <span className="inline-flex items-center gap-1">
                {rhStatus?.configured ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <AlertTriangle className="h-3 w-3 text-amber-400" />}
                Robinhood
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runDesk()}
                placeholder="NVDA, AAPL, $VIRTUAL…"
                className="w-full rounded-md border border-border bg-secondary pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary/50"
              />
            </div>
            <button
              onClick={runDesk}
              disabled={pending}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Running…" : "Run Elite Desk"}
            </button>
            <Link
              href={`/elite-deep-dive`}
              className="rounded-md border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground text-center"
            >
              Full research →
            </Link>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          {report && (
            <div className="grid md:grid-cols-2 gap-3 pt-1">
              <div className="rounded-md border border-border bg-card/80 p-3 space-y-1.5">
                <div className="text-[10px] uppercase text-muted-foreground">Primary</div>
                <div className="text-lg font-semibold text-foreground">
                  {report.resolved_symbol} · {verdict || "—"}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {report.institutional?.investment_thesis || report.analyst_memo?.slice(0, 220)}
                </p>
                <div className="text-[11px] text-accent">
                  Bias {report.trade_plan?.bias || "—"}
                  {report.trade_plan?.horizons?.week && (
                    <> · Week target +{report.trade_plan.horizons.week.target_roi_pct}%</>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
                <div className="text-[10px] uppercase text-amber-400/90">Contrarian (always on)</div>
                <div className="text-sm font-medium text-foreground">
                  {contra?.action || "—"}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {contra?.thesis || "Contrarian play loads with every desk run."}
                </p>
                {contra?.setup && (
                  <div className="text-[11px] text-amber-300">
                    Week fade target +{contra.setup.target_roi_pct}% · stop {contra.setup.stop_loss_pct}%
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Team roster */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-accent" /> Trading team
            </h2>
            <Link href="/team" className="text-xs text-muted-foreground hover:text-foreground">
              Open team console →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {TEAM.map((t) => (
              <Link
                key={t.role}
                href={t.href}
                className="rounded-md border border-border bg-card p-3 hover:border-primary/40 transition-colors space-y-1"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.role}</div>
                <div className="text-sm font-medium text-foreground">{t.name}</div>
                <div className="text-[11px] text-muted-foreground">{t.note}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Execute + Macro strips */}
        <div className="grid md:grid-cols-2 gap-4">
          <section className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-3">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-emerald-400" /> Execute
            </h2>
            <p className="text-xs text-muted-foreground">
              Robinhood Agentic {rhStatus?.configured ? "connected" : "not connected"}
              {rhStatus?.live_trading_enabled ? " · LIVE ON" : " · live off"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={connectRobinhood}
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-3 py-1.5 text-xs"
              >
                {rhStatus?.configured ? "Reconnect Robinhood" : "Connect Robinhood"}
              </button>
              <Link href="/execute" className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Execute rail →
              </Link>
              <Link href="/copy-trader" className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <Activity className="h-3 w-3" /> Copy
              </Link>
              <Link href="/throw" className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <Zap className="h-3 w-3" /> THROW
              </Link>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Network className="h-4 w-4 text-accent" /> Macro nodes
            </h2>
            <p className="text-xs text-muted-foreground">
              LocalIntel node model supplies the macro/ZIP tape the Elite desk prices in.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/macro" className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs hover:text-foreground">
                Node map →
              </Link>
              <Link href="/local-intel/market-intel" className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs">
                Market intel
              </Link>
              <Link href="/local-intel/zip-intel" className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs">
                ZIP intel
              </Link>
            </div>
          </section>
        </div>

        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <GitBranch className="h-3 w-3" />
          ACP wire: Dashboard → Railway elite-analysis / fire-job → optional Virtuals offering.
          <button
            type="button"
            onClick={() => {
              fetch("/api/elite-analysis", { cache: "no-store" })
                .then((r) => r.json())
                .then((d) => setSources(d.sources || null));
              fetch("/api/robinhood?action=status", { cache: "no-store" })
                .then((r) => r.json())
                .then(setRhStatus);
            }}
            className="inline-flex items-center gap-1 hover:text-foreground ml-1"
          >
            <RefreshCw className="h-3 w-3" /> Refresh status
          </button>
        </p>
      </div>
    </div>
  );
}
