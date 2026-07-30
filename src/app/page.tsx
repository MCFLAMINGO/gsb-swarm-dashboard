"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Brain, Network, Bot, Search, RefreshCw,
  CheckCircle2, AlertTriangle, GitBranch
} from "lucide-react";
import { toast } from "sonner";
import AgentPlaybook from "@/components/AgentPlaybook";

const TEAM = [
  { role: "Chief Analyst", name: "Elite / Equity Analyst", href: "/elite-deep-dive", note: "Thesis · desk voice · contrarian · ROI plan" },
  { role: "Token / On-chain", name: "Token Analyst + Alpha", href: "/team", note: "Liquidity, whales, early signals" },
  { role: "Wallet / Flow", name: "Wallet Profiler", href: "/team", note: "Holdings, smart money, DCA" },
  { role: "Macro / Nodes", name: "LocalIntel Node Model", href: "/macro", note: "FRED · ZIP · market intel → desk" },
  { role: "CEO Orchestrator", name: "ACP CEO", href: "/team", note: "Cook swarm · Virtuals hire" },
  { role: "Execution", name: "Robinhood · Copy · THROW", href: "/execute", note: "Review → place · copy · Tempo tape" },
];

export default function DeskHomePage() {
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [rhStatus, setRhStatus] = useState<any>(null);
  const [sources, setSources] = useState<any>(null);
  const [rhHorizon, setRhHorizon] = useState<"day" | "week" | "month" | "year">("week");
  const [rhNotional, setRhNotional] = useState("50");
  const [rhBusy, setRhBusy] = useState(false);
  const [rhResult, setRhResult] = useState<any>(null);
  const [rhError, setRhError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!pending) return;
    setElapsedSec(0);
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);

  async function runDesk() {
    const q = query.trim().toUpperCase();
    if (!q) {
      setError("Enter a ticker first (e.g. AAPL, TSLA, META)");
      return;
    }
    setError(null);
    setReport(null);
    setRhResult(null);
    setRhError(null);
    setPending(true);
    try {
      const res = await fetch("/api/elite-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, assetType: "auto", includeSynthesis: true }),
        signal: AbortSignal.timeout(280_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error ||
            (res.status === 504
              ? "Research timed out on the server — try again (often 45–90s)"
              : `HTTP ${res.status}`)
        );
      }
      if (!data.report) throw new Error("No report returned — Railway elite-analysis may have failed");
      setReport(data.report);
      if (data.sources) setSources((prev: any) => ({ ...(prev || {}), ...data.sources }));
      setTimeout(() => {
        document.getElementById("desk-summation")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (e) {
      const msg = (e as Error).name === "TimeoutError"
        ? "Research timed out after ~4.5 minutes — try again"
        : (e as Error).message;
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  async function executeOnRobinhood(live: boolean) {
    if (!report?.resolved_symbol && !query.trim()) return;
    setRhError(null);
    setRhResult(null);
    setRhBusy(true);
    try {
      const res = await fetch("/api/robinhood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: report?.resolved_symbol || query.trim(),
          trade_plan: report?.trade_plan || undefined,
          horizon: rhHorizon,
          notionalUsd: Number(rhNotional) || 50,
          dryRun: !live,
          confirm: live,
          orderType: "market",
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.order && !data.order_preview) {
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
      }
      setRhResult(data);
      toast.success(live ? "Live order submitted" : "Order reviewed (dry-run)");
      const st = await fetch("/api/robinhood?action=status", { cache: "no-store" });
      setRhStatus(await st.json());
    } catch (e) {
      setRhError((e as Error).message);
      toast.error("Robinhood action failed", { description: (e as Error).message });
    } finally {
      setRhBusy(false);
    }
  }

  async function executeOptionOverlay(overlay: any, live: boolean) {
    if (!overlay) return;
    setRhError(null);
    setRhResult(null);
    setRhBusy(true);
    try {
      const res = await fetch("/api/robinhood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "options",
          overlay,
          dryRun: !live,
          confirm: live,
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.order && !data.order_preview && !data.review) {
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
      }
      setRhResult(data);
      toast.success(live ? "Options order submitted" : "Options order reviewed (dry-run)");
      const st = await fetch("/api/robinhood?action=status", { cache: "no-store" });
      setRhStatus(await st.json());
    } catch (e) {
      setRhError((e as Error).message);
      toast.error("Options action failed", { description: (e as Error).message });
    } finally {
      setRhBusy(false);
    }
  }

  const verdict = report?.verdict?.verdict;
  const contra = report?.trade_plan?.contrarian_play || report?.institutional?.contrarian_play;
  const week = report?.trade_plan?.horizons?.week;
  const sleeve = report?.institutional?.portfolio_fit?.suggested_sleeve_pct;
  const verdictColor =
    String(verdict).includes("BUY") ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/15"
      : String(verdict).includes("AVOID") || String(verdict).includes("RISKY") ? "text-red-300 border-red-500/40 bg-red-500/15"
        : "text-amber-200 border-amber-500/40 bg-amber-500/15";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 md:p-8 space-y-6 max-w-5xl">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/70">GSB Trading Desk</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Research → thesis → trade
          </h1>
          <p className="text-base text-foreground/85 max-w-2xl">
            Type a ticker, run the desk, read the summation, then engage a strategy below
            (Robinhood review/live, Copy, or THROW).
          </p>
        </header>

        {/* Run */}
        <section className="rounded-lg border border-primary/35 bg-primary/10 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> 1. Run research
            </h2>
            <div className="flex items-center gap-3 text-sm text-foreground/80">
              <span className="inline-flex items-center gap-1">
                {sources?.fred ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                FRED
              </span>
              <span className="inline-flex items-center gap-1">
                {sources?.nvidia_nim ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                NIM
              </span>
              <span className="inline-flex items-center gap-1">
                {rhStatus?.configured ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                Robinhood {rhStatus?.live_trading_enabled ? "(LIVE)" : ""}
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-foreground/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runDesk()}
                placeholder="Type any ticker — AAPL, TSLA, META…"
                className="w-full rounded-md border border-border bg-secondary pl-11 pr-3 py-3 text-base outline-none focus:border-primary/50"
              />
            </div>
            <button
              onClick={runDesk}
              disabled={pending || !query.trim()}
              className="rounded-md bg-primary text-primary-foreground px-6 py-3 text-base font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {pending ? `Researching… ${elapsedSec}s` : "Run Elite Desk"}
            </button>
          </div>
          {pending && (
            <p className="text-base text-amber-200">
              Still working — usually 45–90 seconds. Keep this tab open. Summation appears below when done.
            </p>
          )}
          {error && <p className="text-base text-red-300">{error}</p>}
          {!report && !pending && !error && (
            <p className="text-base text-foreground/75">
              Enter a ticker and run. Summation, thesis, positions, and trade buttons appear after research finishes.
            </p>
          )}
        </section>

        {report && (
          <>
            {/* Summation */}
            <section id="desk-summation" className="rounded-lg border border-primary/35 bg-card p-5 md:p-6 space-y-3 scroll-mt-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className={`rounded-md border px-4 py-2 text-lg font-bold ${verdictColor}`}>
                  {verdict || "NO VERDICT"}
                </div>
                <div className="text-base text-foreground/90">
                  <span className="font-semibold">{report.resolved_symbol}</span>
                  {" · "}Bias <span className="font-semibold">{report.trade_plan?.bias || "—"}</span>
                  {week && <> · Week target {week.target_roi_pct > 0 ? "+" : ""}{week.target_roi_pct}%</>}
                </div>
              </div>
              <h2 className="text-xl font-semibold">2. Research summation</h2>
              <div className="text-base leading-relaxed text-foreground whitespace-pre-wrap max-h-[420px] overflow-y-auto rounded-md border border-border bg-secondary/30 p-4">
                {report.analyst_memo || report.institutional?.investment_thesis || "No memo returned."}
              </div>
              <Link href="/elite-deep-dive" className="inline-block text-base text-accent hover:underline font-medium">
                Open full Elite Research (all evidence) →
              </Link>
            </section>

            {/* Thesis */}
            <section className="rounded-lg border border-border bg-card p-5 space-y-3">
              <h2 className="text-xl font-semibold">3. Thesis — why we think this</h2>
              <p className="text-base leading-relaxed text-foreground">
                {report.institutional?.investment_thesis || "Thesis not available."}
              </p>
              {(report.verdict?.reasons || []).length > 0 && (
                <ol className="list-decimal pl-5 space-y-2">
                  {(report.verdict.reasons as string[]).map((r, i) => (
                    <li key={i} className="text-base text-foreground/90">{r}</li>
                  ))}
                </ol>
              )}
            </section>

            {/* Positions */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">4. Positions laid out</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-5 space-y-2">
                  <div className="flex justify-between gap-2">
                    <h3 className="text-lg font-semibold">Primary</h3>
                    <span className="text-sm font-bold text-emerald-200">{week?.action || report.trade_plan?.bias}</span>
                  </div>
                  <p className="text-base text-foreground/90">{week?.thesis}</p>
                  <Row label="Entry" value={fmt(week?.entry_price ?? report.trade_plan?.mark_price)} />
                  <Row label="Target" value={fmt(week?.target_price)} />
                  <Row label="Stop" value={fmt(week?.stop_price)} />
                  <Row label="Target ROI" value={fmtPct(week?.target_roi_pct)} />
                  <Row label="Sleeve" value={sleeve != null ? `${sleeve}% of book` : null} />
                </div>
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-5 space-y-2">
                  <div className="flex justify-between gap-2">
                    <h3 className="text-lg font-semibold">Contrarian</h3>
                    <span className="text-sm font-bold text-amber-100">{contra?.action || "FADE"}</span>
                  </div>
                  <p className="text-base text-foreground/90">{contra?.thesis}</p>
                  <Row label="Trigger" value={contra?.setup?.entry_trigger} />
                  <Row label="Entry" value={fmt(contra?.setup?.entry_price)} />
                  <Row label="Target" value={fmt(contra?.setup?.target_price)} />
                  <Row label="Stop" value={fmt(contra?.setup?.stop_price)} />
                  <Row label="Target ROI" value={fmtPct(contra?.setup?.target_roi_pct)} />
                </div>
              </div>
            </section>

            {/* 5. Agent playbook + engage */}
            <div id="engage-strategies" className="scroll-mt-4 space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-xl font-semibold">5. Engage — agent directions</h2>
                <div className="flex gap-2 items-center">
                  <select
                    value={rhHorizon}
                    onChange={(e) => setRhHorizon(e.target.value as typeof rhHorizon)}
                    className="rounded-md border border-border bg-secondary px-3 py-2 text-sm"
                  >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                    <option value="year">Year</option>
                  </select>
                  <input
                    value={rhNotional}
                    onChange={(e) => setRhNotional(e.target.value)}
                    className="w-24 rounded-md border border-border bg-secondary px-3 py-2 text-sm"
                    title="Notional USD"
                  />
                </div>
              </div>

              <AgentPlaybook
                playbook={report.agent_playbook}
                rhBusy={rhBusy}
                liveEnabled={Boolean(rhStatus?.live_trading_enabled)}
                optionsEnabled={rhStatus?.options_trading_enabled !== false}
                biasNeutral={report.trade_plan?.bias === "NEUTRAL"}
                onReview={() => executeOnRobinhood(false)}
                onLive={() => {
                  if (window.confirm(`Place LIVE buy ${report.resolved_symbol} for $${rhNotional}?`)) {
                    executeOnRobinhood(true);
                  }
                }}
                onOptionReview={(overlay) => executeOptionOverlay(overlay, false)}
                onOptionLive={(overlay) => {
                  const preview = overlay?.what_flows_to_robinhood?.order_preview;
                  const leg = preview?.legs?.[0];
                  const label = leg
                    ? `${preview.strategy || overlay.id}: ${leg.side} ${leg.right} ${leg.strike} ${leg.expiration}`
                    : overlay?.title || overlay?.id;
                  if (window.confirm(`Place LIVE options order?\n${label}`)) {
                    executeOptionOverlay(overlay, true);
                  }
                }}
              />

              {rhError && <p className="text-base text-red-300">{rhError}</p>}
              {rhResult && (
                <pre className="text-sm text-foreground/90 whitespace-pre-wrap max-h-48 overflow-auto rounded border border-border bg-background/60 p-3">
                  {JSON.stringify({
                    mode: rhResult.mode,
                    message: rhResult.message,
                    order: rhResult.order || rhResult.order_preview,
                    review: rhResult.review?.parsed || rhResult.review?.text || rhResult.review,
                    placed: rhResult.placed?.parsed || rhResult.placed?.text || rhResult.placed,
                  }, null, 2)}
                </pre>
              )}

              <p className="text-sm text-foreground/70">
                Copy Trader / THROW are separate rails (yield & Tempo tape) — not part of this Robinhood equity directive.
                <Link href="/execute" className="text-accent ml-1 hover:underline">Execute rail →</Link>
              </p>
            </div>
          </>
        )}

        {/* Team / macro — secondary */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Bot className="h-4 w-4 text-accent" /> Trading team
            </h2>
            <Link href="/team" className="text-sm text-foreground/75 hover:text-foreground">
              Team console →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {TEAM.map((t) => (
              <Link
                key={t.role}
                href={t.href}
                className="rounded-md border border-border bg-card p-3 hover:border-primary/40 transition-colors space-y-1"
              >
                <div className="text-xs uppercase tracking-wider text-foreground/65">{t.role}</div>
                <div className="text-base font-medium text-foreground">{t.name}</div>
                <div className="text-sm text-foreground/75">{t.note}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Network className="h-4 w-4 text-accent" /> Macro nodes
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/macro" className="rounded-md border border-border bg-secondary px-3 py-2 text-sm">Node map →</Link>
            <Link href="/local-intel/market-intel" className="rounded-md border border-border bg-secondary px-3 py-2 text-sm">Market intel</Link>
            <Link href="/local-intel/zip-intel" className="rounded-md border border-border bg-secondary px-3 py-2 text-sm">ZIP intel</Link>
          </div>
        </section>

        <p className="text-sm text-foreground/70 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5" />
          Desk → Railway elite-analysis → Robinhood Agentic / Copy / THROW
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between gap-3 text-base border-b border-border/40 pb-1">
      <span className="text-foreground/70">{label}</span>
      <span className="font-medium text-foreground text-right">{value == null || value === "" ? "—" : String(value)}</span>
    </div>
  );
}

function fmt(n: unknown) {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  if (Math.abs(n) >= 1e3) return `$${n.toFixed(2)}`;
  return n < 2 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

function fmtPct(n: unknown) {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}
